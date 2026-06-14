import { getBlastPhaseSizesUi } from "../constants/tournament.js";
import { computeGroupSizes, resolveGroupStageConfig } from "../lib/engineGroupConfig.js";
import { blastLastChanceRanks } from "./engineStages.js";

/** @typedef {{ matchKey: string, label?: string, roundIndex?: number, elimination?: boolean, slots: { side: 1 | 2, source: string }[] }} StageMatchDef */

const ELIMINATION_STAGE_TYPES = new Set([
  "last_chance",
  "play_in",
  "crossover",
  "single_elimination",
  "double_elimination",
]);

export function encodeGroupRank(groupKey, rank) {
  return `group:${groupKey}:${rank}`;
}

export function encodeStageWinner(stageKey, matchIndex) {
  return `winner:${stageKey}:${matchIndex}`;
}

export function parseSeedSource(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(":");
  if (parts[0] === "group" && parts.length >= 3) {
    return { type: "group", groupKey: parts[1], rank: Number(parts[2]) };
  }
  if (parts[0] === "winner" && parts.length >= 3) {
    return { type: "winner", stageKey: parts[1], matchIndex: Number(parts[2]) };
  }
  return { type: "raw", value };
}

export function seedSourceToPlaceholder(source) {
  const parsed = parseSeedSource(source);
  if (parsed?.type === "group") return `Group ${parsed.groupKey} #${parsed.rank}`;
  return null;
}

export function stageUsesMatchBuilder(stage, stageIndex) {
  if (!stage || stageIndex === 0) return false;
  return stage.type !== "group_round_robin" && stage.type !== "round_robin";
}

export function defaultStageElimination(stage) {
  if (stage?.elimination != null) return Boolean(stage.elimination);
  return ELIMINATION_STAGE_TYPES.has(stage?.type);
}

export function matchIsElimination(stage, match) {
  if (match?.elimination != null) return Boolean(match.elimination);
  return defaultStageElimination(stage);
}

export function listGroupRankSources(groupPlan) {
  const sources = [];
  for (let gi = 0; gi < groupPlan.groupKeys.length; gi += 1) {
    const key = groupPlan.groupKeys[gi];
    const size = groupPlan.groupSizes[gi] || 0;
    for (let rank = 1; rank <= size; rank += 1) {
      sources.push({
        value: encodeGroupRank(key, rank),
        label: `Group ${key} — #${rank}`,
      });
    }
  }
  return sources;
}

function mergeStageMatches(stage, stageIndex, stages, config) {
  const saved = stage?.matches ?? stage?.seedPlan;
  const defaults = defaultStageMatches(stage, stageIndex, stages, config);
  return normalizeSavedMatches(saved, defaults);
}

function priorEliminationMatches(stageIndex, matchIndex, stages, config) {
  const rows = [];

  for (let si = 0; si <= stageIndex; si += 1) {
    const stage = stages[si];
    if (!stage || !stageUsesMatchBuilder(stage, si)) continue;
    const matches = mergeStageMatches(stage, si, stages, config);
    const limit = si === stageIndex ? matchIndex : matches.length;
    const stageLabel = stage.label || stage.key || `Stage ${si + 1}`;
    matches.slice(0, limit).forEach((match, mi) => {
      if (!matchIsElimination(stage, match)) return;
      rows.push({
        stageKey: stage.key,
        matchIndex: mi,
        label: `${stageLabel} — ${match.label || `match ${mi + 1}`} winner`,
      });
    });
  }
  return rows;
}

export function listWinnerSources(stageIndex, matchIndex, stages, config) {
  return priorEliminationMatches(stageIndex, matchIndex, stages, config).map((row) => ({
    value: encodeStageWinner(row.stageKey, row.matchIndex),
    label: row.label,
  }));
}

export function listSeedSourceOptions(stageIndex, matchIndex, stages, config) {
  const plan = resolveGroupStageConfig(config);
  const groupSources = plan.enabled ? listGroupRankSources(plan) : [];
  const winnerSources = listWinnerSources(stageIndex, matchIndex, stages, config);
  return [...groupSources, ...winnerSources];
}

export function labelSeedSource(source, stages) {
  const parsed = parseSeedSource(source);
  if (parsed?.type === "group") return `Group ${parsed.groupKey} — #${parsed.rank}`;
  if (parsed?.type === "winner") {
    const stage = (stages || []).find((row) => row.key === parsed.stageKey);
    const stageLabel = stage?.label || parsed.stageKey;
    return `${stageLabel} — match ${parsed.matchIndex + 1} winner`;
  }
  return source || "—";
}

function groupKeysPair(config) {
  const plan = resolveGroupStageConfig(config);
  const keys = plan.groupKeys.length >= 2 ? plan.groupKeys.slice(0, 2) : ["A", "B"];
  return keys;
}

function buildDefaultLastChanceMatches(stage, config) {
  const ranks = blastLastChanceRanks(config.teamCount);
  const [gA, gB] = groupKeysPair(config);
  return ranks.map((rank, index) => ({
    matchKey: `m${index}`,
    label: `Match ${index + 1}`,
    roundIndex: 0,
    elimination: true,
    slots: [
      { side: 1, source: encodeGroupRank(gA, rank) },
      { side: 2, source: encodeGroupRank(gB, ranks[ranks.length - 1 - index]) },
    ],
  }));
}

function buildDefaultPlayInMatches(config) {
  const sizes = getBlastPhaseSizesUi(config.teamCount);
  const [gA, gB] = groupKeysPair(config);
  const lcKey = (config.stages || []).find((row) => row.type === "last_chance")?.key || "last_chance";

  if (sizes?.mainPlayoffPath === "ten_qf_seconds") {
    return [
      {
        matchKey: "m0",
        label: "Match 1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 3) },
          { side: 2, source: encodeStageWinner(lcKey, 1) },
        ],
      },
      {
        matchKey: "m1",
        label: "Match 2",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 3) },
          { side: 2, source: encodeStageWinner(lcKey, 0) },
        ],
      },
    ];
  }

  if (sizes?.mainPlayoffPath === "tiered_merged_standings" && config.teamCount === 12) {
    return [
      {
        matchKey: "m0",
        label: "Middle — match 1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 3) },
          { side: 2, source: encodeGroupRank(gB, 4) },
        ],
      },
      {
        matchKey: "m1",
        label: "Middle — match 2",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 3) },
          { side: 2, source: encodeGroupRank(gA, 4) },
        ],
      },
      {
        matchKey: "m2",
        label: "Crossover — match 1",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 2) },
          { side: 2, source: encodeStageWinner(lcKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        label: "Crossover — match 2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 2) },
          { side: 2, source: encodeStageWinner(lcKey, 1) },
        ],
      },
    ];
  }

  return [
    {
      matchKey: "m0",
      label: "Match 1",
      roundIndex: 0,
      elimination: true,
      slots: [
        { side: 1, source: encodeGroupRank(gA, 3) },
        { side: 2, source: encodeGroupRank(gB, 3) },
      ],
    },
  ];
}

function buildDefaultPlayoffMatches(config) {
  const sizes = getBlastPhaseSizesUi(config.teamCount);
  const [gA, gB] = groupKeysPair(config);
  const piKey = (config.stages || []).find((row) => row.type === "play_in" || row.type === "crossover")?.key || "play_in";
  const poKey = (config.stages || []).find((row) => row.type === "single_elimination")?.key || "playoffs";

  if (sizes?.mainPlayoffPath === "ten_qf_seconds") {
    return [
      {
        matchKey: "m0",
        label: "Quarterfinal 1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 2) },
          { side: 2, source: encodeStageWinner(piKey, 0) },
        ],
      },
      {
        matchKey: "m1",
        label: "Quarterfinal 2",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 2) },
          { side: 2, source: encodeStageWinner(piKey, 1) },
        ],
      },
      {
        matchKey: "m2",
        label: "Semifinal 1",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 1) },
          { side: 2, source: encodeStageWinner(poKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        label: "Semifinal 2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 1) },
          { side: 2, source: encodeStageWinner(poKey, 1) },
        ],
      },
      {
        matchKey: "m4",
        label: "Grand final",
        roundIndex: 2,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(poKey, 2) },
          { side: 2, source: encodeStageWinner(poKey, 3) },
        ],
      },
    ];
  }

  if (sizes?.mainPlayoffPath === "tiered_merged_standings" && config.teamCount === 12) {
    return [
      {
        matchKey: "m0",
        label: "Quarterfinal 1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(piKey, 0) },
          { side: 2, source: encodeStageWinner(piKey, 3) },
        ],
      },
      {
        matchKey: "m1",
        label: "Quarterfinal 2",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(piKey, 1) },
          { side: 2, source: encodeStageWinner(piKey, 2) },
        ],
      },
      {
        matchKey: "m2",
        label: "Semifinal 1",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 1) },
          { side: 2, source: encodeStageWinner(poKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        label: "Semifinal 2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 1) },
          { side: 2, source: encodeStageWinner(poKey, 1) },
        ],
      },
      {
        matchKey: "m4",
        label: "Grand final",
        roundIndex: 2,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(poKey, 2) },
          { side: 2, source: encodeStageWinner(poKey, 3) },
        ],
      },
    ];
  }

  return [
    {
      matchKey: "m0",
      label: "Match 1",
      roundIndex: 0,
      elimination: true,
      slots: [
        { side: 1, source: encodeGroupRank(gA, 1) },
        { side: 2, source: encodeGroupRank(gB, 2) },
      ],
    },
  ];
}

export function defaultStageMatches(stage, stageIndex, stages, config) {
  if (!stageUsesMatchBuilder(stage, stageIndex)) return [];
  const format = String(config?.format || "").toLowerCase();

  if (format === "blast") {
    if (stage.type === "last_chance") return buildDefaultLastChanceMatches(stage, config);
    if (stage.type === "play_in" || stage.type === "crossover") return buildDefaultPlayInMatches(config);
    if (stage.type === "single_elimination") return buildDefaultPlayoffMatches(config);
  }

  if (stage.type === "single_elimination") {
    const [gA, gB] = groupKeysPair(config);
    return [
      {
        matchKey: "m0",
        label: "Match 1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 1) },
          { side: 2, source: encodeGroupRank(gB, 2) },
        ],
      },
    ];
  }

  return [
    {
      matchKey: "m0",
      label: "Match 1",
      roundIndex: 0,
      elimination: defaultStageElimination(stage),
      slots: [
        { side: 1, source: encodeGroupRank(groupKeysPair(config)[0], 1) },
        { side: 2, source: encodeGroupRank(groupKeysPair(config)[1], 2) },
      ],
    },
  ];
}

function normalizeSavedMatches(saved, defaults) {
  const rows = Array.isArray(saved) ? saved : [];
  if (!rows.length) return defaults;
  const byKey = Object.fromEntries(rows.map((match) => [match.matchKey, match]));
  const keys = [...new Set([...defaults.map((match) => match.matchKey), ...rows.map((match) => match.matchKey)])];
  return keys.map((matchKey, index) => {
    const base = byKey[matchKey] || defaults.find((match) => match.matchKey === matchKey);
    const fallback = defaults[index] || defaults[0];
    const merged = base || fallback;
    return {
      matchKey,
      label: merged.label || `Match ${index + 1}`,
      roundIndex: merged.roundIndex ?? fallback?.roundIndex ?? 0,
      elimination: merged.elimination ?? fallback?.elimination ?? true,
      slots: [1, 2].map((side) => {
        const slot = (merged.slots || []).find((row) => row.side === side);
        const fallbackSlot = (fallback?.slots || []).find((row) => row.side === side);
        return { side, source: slot?.source || fallbackSlot?.source || "" };
      }),
    };
  });
}

function sanitizeMatchSources(match, stageIndex, matchIndex, stages, config) {
  const options = listSeedSourceOptions(stageIndex, matchIndex, stages, config);
  const optionValues = new Set(options.map((option) => option.value));
  return {
    ...match,
    slots: match.slots.map((slot) => {
      let source = slot.source;
      if (!optionValues.has(source)) {
        const parsed = parseSeedSource(source);
        if (parsed?.type === "group") {
          const candidate = encodeGroupRank(parsed.groupKey, parsed.rank);
          if (optionValues.has(candidate)) source = candidate;
        }
        if (parsed?.type === "winner") {
          const candidate = encodeStageWinner(parsed.stageKey, parsed.matchIndex);
          if (optionValues.has(candidate)) source = candidate;
        }
      }
      if (!optionValues.has(source)) source = options[0]?.value || source;
      return { ...slot, source };
    }),
  };
}

export function resolveStageMatches(stage, stageIndex, stages, config) {
  return mergeStageMatches(stage, stageIndex, stages, config).map((match, matchIndex) =>
    sanitizeMatchSources(match, stageIndex, matchIndex, stages, config),
  );
}

export function createStageMatch(stageIndex, stages, config) {
  const stage = stages[stageIndex];
  const existing = resolveStageMatches(stage, stageIndex, stages, config);
  const matchIndex = existing.length;
  const options = listSeedSourceOptions(stageIndex, matchIndex, stages, config);
  return {
    matchKey: `m${matchIndex}-${Date.now()}`,
    label: `Match ${matchIndex + 1}`,
    roundIndex: existing[existing.length - 1]?.roundIndex ?? 0,
    elimination: defaultStageElimination(stage),
    slots: [
      { side: 1, source: options[0]?.value || "" },
      { side: 2, source: options[1]?.value || options[0]?.value || "" },
    ],
  };
}

export function normalizeEngineStageSeeding(config) {
  const stages = Array.isArray(config?.stages) ? config.stages : [];
  const nextStages = stages.map((stage, index) => {
    if (!stageUsesMatchBuilder(stage, index)) {
      const { matches, seedPlan, ...rest } = stage;
      return rest;
    }
    const matches = resolveStageMatches(stage, index, stages, config);
    const elimination = defaultStageElimination(stage);
    return { ...stage, elimination, matches };
  });
  return { ...config, stages: nextStages };
}

export function mergePreservedStageFields(nextStages, prevStages, config) {
  const prevByKey = Object.fromEntries((prevStages || []).map((stage) => [stage.key, stage]));
  return nextStages
    .map((stage) => {
      const prev = prevByKey[stage.key];
      const merged = { ...stage };
      if (prev?.matches) merged.matches = prev.matches;
      else if (prev?.seedPlan) merged.matches = prev.seedPlan;
      if (prev?.elimination != null) merged.elimination = prev.elimination;
      if (prev?.label && prev.label !== stage.label) merged.label = prev.label;
      if (prev?.seriesRuleKey) merged.seriesRuleKey = prev.seriesRuleKey;
      return merged;
    })
    .map((stage, index, all) => {
      if (!stageUsesMatchBuilder(stage, index)) return stage;
      return {
        ...stage,
        matches: resolveStageMatches(stage, index, all, { ...config, stages: all }),
      };
    });
}

export function rebalanceStageSeedingOnGroupChange(config) {
  const plan = resolveGroupStageConfig(config);
  const groupCount = plan.groupCount;
  const groupSizes = computeGroupSizes(config.teamCount, groupCount, plan.balance === "custom" ? plan.groupSizes : null);
  return normalizeEngineStageSeeding({
    ...config,
    groupStage: { ...config.groupStage, groupCount, groupSizes },
  });
}

// Back-compat aliases used elsewhere
export const resolveStageSeedPlan = resolveStageMatches;
export const stageHasSeedPlanner = stageUsesMatchBuilder;
