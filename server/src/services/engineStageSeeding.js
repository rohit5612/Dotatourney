import { resolveGroupStageConfig } from "./engineGroupConfig.js";
import { blastLastChanceRanks } from "./engineStages.js";

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

function defaultStageElimination(stage) {
  if (stage?.elimination != null) return Boolean(stage.elimination);
  return ELIMINATION_STAGE_TYPES.has(stage?.type);
}

function matchIsElimination(stage, match) {
  if (match?.elimination != null) return Boolean(match.elimination);
  return defaultStageElimination(stage);
}

function groupKeysPair(config) {
  const plan = resolveGroupStageConfig(config);
  return plan.groupKeys.length >= 2 ? plan.groupKeys.slice(0, 2) : ["A", "B"];
}

function buildDefaultLastChanceMatches(config) {
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

function blastMainPlayoffPath(teamCount) {
  const n = Number(teamCount) || 0;
  if (n === 10) return "ten_qf_seconds";
  if (n >= 11) return "tiered_merged_standings";
  return null;
}

function buildDefaultPlayInMatches(config) {
  const mainPath = blastMainPlayoffPath(config.teamCount);
  const [gA, gB] = groupKeysPair(config);
  const lcKey = (config.stages || []).find((stage) => stage.type === "last_chance")?.key || "last_chance";

  if (mainPath === "ten_qf_seconds") {
    return [
      {
        matchKey: "m0",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 3) },
          { side: 2, source: encodeStageWinner(lcKey, 1) },
        ],
      },
      {
        matchKey: "m1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 3) },
          { side: 2, source: encodeStageWinner(lcKey, 0) },
        ],
      },
    ];
  }

  if (mainPath === "tiered_merged_standings" && config.teamCount === 12) {
    return [
      {
        matchKey: "m0",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 3) },
          { side: 2, source: encodeGroupRank(gB, 4) },
        ],
      },
      {
        matchKey: "m1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 3) },
          { side: 2, source: encodeGroupRank(gA, 4) },
        ],
      },
      {
        matchKey: "m2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 2) },
          { side: 2, source: encodeStageWinner(lcKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 2) },
          { side: 2, source: encodeStageWinner(lcKey, 1) },
        ],
      },
    ];
  }

  return [];
}

function buildDefaultPlayoffMatches(config) {
  const mainPath = blastMainPlayoffPath(config.teamCount);
  const [gA, gB] = groupKeysPair(config);
  const piKey = (config.stages || []).find((stage) => stage.type === "play_in" || stage.type === "crossover")?.key;
  const playInKey = piKey || "play_in";
  const poKey = (config.stages || []).find((stage) => stage.type === "single_elimination")?.key || "playoffs";

  if (mainPath === "ten_qf_seconds") {
    return [
      {
        matchKey: "m0",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 2) },
          { side: 2, source: encodeStageWinner(playInKey, 0) },
        ],
      },
      {
        matchKey: "m1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 2) },
          { side: 2, source: encodeStageWinner(playInKey, 1) },
        ],
      },
      {
        matchKey: "m2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 1) },
          { side: 2, source: encodeStageWinner(poKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 1) },
          { side: 2, source: encodeStageWinner(poKey, 1) },
        ],
      },
      {
        matchKey: "m4",
        roundIndex: 2,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(poKey, 2) },
          { side: 2, source: encodeStageWinner(poKey, 3) },
        ],
      },
    ];
  }

  if (mainPath === "tiered_merged_standings" && config.teamCount === 12) {
    return [
      {
        matchKey: "m0",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(playInKey, 0) },
          { side: 2, source: encodeStageWinner(playInKey, 3) },
        ],
      },
      {
        matchKey: "m1",
        roundIndex: 0,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(playInKey, 1) },
          { side: 2, source: encodeStageWinner(playInKey, 2) },
        ],
      },
      {
        matchKey: "m2",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gA, 1) },
          { side: 2, source: encodeStageWinner(poKey, 0) },
        ],
      },
      {
        matchKey: "m3",
        roundIndex: 1,
        elimination: true,
        slots: [
          { side: 1, source: encodeGroupRank(gB, 1) },
          { side: 2, source: encodeStageWinner(poKey, 1) },
        ],
      },
      {
        matchKey: "m4",
        roundIndex: 2,
        elimination: true,
        slots: [
          { side: 1, source: encodeStageWinner(poKey, 2) },
          { side: 2, source: encodeStageWinner(poKey, 3) },
        ],
      },
    ];
  }

  return [];
}

function defaultStageMatches(stage, stageIndex, stages, config) {
  if (stageIndex === 0) return [];
  if (stage.type === "group_round_robin" || stage.type === "round_robin") return [];
  const format = String(config?.format || "").toLowerCase();
  if (format !== "blast") return [];
  if (stage.type === "last_chance") return buildDefaultLastChanceMatches(config);
  if (stage.type === "play_in" || stage.type === "crossover") return buildDefaultPlayInMatches(config);
  if (stage.type === "single_elimination") return buildDefaultPlayoffMatches(config);
  return [];
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

export function resolveStageMatches(stage, stageIndex, stages, config) {
  const saved = stage?.matches ?? stage?.seedPlan;
  return normalizeSavedMatches(saved, defaultStageMatches(stage, stageIndex, stages, config));
}

function stageBracketKey(stage, format) {
  const fmt = String(format || "").toLowerCase();
  if (fmt === "blast") {
    if (stage.type === "last_chance") return "blast-lastchance";
    if (stage.type === "play_in" || stage.type === "crossover") return "blast-playin";
    if (stage.type === "single_elimination") return "blast-playoffs";
  }
  if (stage.type === "single_elimination") return "playoffs";
  return stage.key || stage.type;
}

function tokenPrefix(stage) {
  if (stage.type === "last_chance") return "LCR";
  if (stage.type === "play_in" || stage.type === "crossover") return "PIR";
  return "STG";
}

function seriesRuleKeyForMatch(stage, match, roundIndex, config) {
  if (match.seriesRuleKey) return match.seriesRuleKey;
  if (stage.seriesRuleKey) return stage.seriesRuleKey;
  const format = String(config?.format || "").toLowerCase();
  if (format !== "blast") return stage.seriesRuleKey || "upper-r1";
  if (stage.type === "last_chance") return "blast-lc-semifinal";
  if (stage.type === "play_in" || stage.type === "crossover") {
    return (match.roundIndex ?? roundIndex) > 0 ? "blast-playin-cross" : "blast-mp-semifinal";
  }
  if (stage.type === "single_elimination") {
    if (roundIndex >= 2) return "blast-po-final";
    if (roundIndex >= 1) return "blast-po-semifinal";
    return "blast-po-quarterfinal";
  }
  return "blast-po-quarterfinal";
}

function playoffTokenPrefix(roundIndex, matchIndex) {
  if (roundIndex >= 2) return "CHAMPION";
  if (roundIndex >= 1) return `SFR1M${matchIndex + 1}W`;
  return `QFR1M${matchIndex + 1}W`;
}

function buildWinToken(stage, match, matchIndex, roundIndex) {
  if (!matchIsElimination(stage, match)) return undefined;
  if (stage.type === "single_elimination") {
    const token = playoffTokenPrefix(roundIndex, matchIndex);
    return token;
  }
  const prefix = tokenPrefix(stage);
  return `${prefix}${roundIndex + 1}M${matchIndex + 1}W`;
}

/**
 * Compile all non-group stage matches from engine_config.
 * @param {object} engineConfig
 * @param {(team1: string, team2: string, stageKey: string, roundIndex: number, matchIndex: number, seriesRuleKey: string, meta: object) => object} addMatchFn
 */
export function compileEngineStageMatches(engineConfig, addMatchFn) {
  const stages = engineConfig?.stages || [];
  const format = engineConfig?.format || "blast";
  const tokenBySource = new Map();

  function resolveSource(source) {
    const placeholder = seedSourceToPlaceholder(source);
    if (placeholder) return placeholder;
    const parsed = parseSeedSource(source);
    if (parsed?.type === "winner") {
      const key = encodeStageWinner(parsed.stageKey, parsed.matchIndex);
      return tokenBySource.get(key) || key;
    }
    return source;
  }

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    if (stage.type === "group_round_robin" || stage.type === "round_robin") continue;

    const stageKey = stageBracketKey(stage, format);
    const plan = resolveStageMatches(stage, stageIndex, stages, engineConfig);
    const roundMatchCounter = new Map();

    for (let matchIndex = 0; matchIndex < plan.length; matchIndex += 1) {
      const matchDef = plan[matchIndex];
      const roundIndex = matchDef.roundIndex ?? 0;
      const roundCount = roundMatchCounter.get(roundIndex) || 0;
      roundMatchCounter.set(roundIndex, roundCount + 1);
      const matchIndexInRound = roundCount;

      const slot1 = matchDef.slots.find((slot) => slot.side === 1);
      const slot2 = matchDef.slots.find((slot) => slot.side === 2);
      if (!slot1?.source || !slot2?.source) continue;

      const team1 = resolveSource(slot1.source);
      const team2 = resolveSource(slot2.source);
      const winToken = buildWinToken(stage, matchDef, matchIndexInRound, roundIndex);
      const seriesRuleKey = seriesRuleKeyForMatch(stage, matchDef, roundIndex, engineConfig);

      const meta = {};
      if (winToken) {
        meta.winToken = winToken;
        tokenBySource.set(encodeStageWinner(stage.key, matchIndex), winToken);
      }
      const parsed2 = parseSeedSource(slot2.source);
      if (parsed2?.type === "winner") {
        meta.team2Feed = resolveSource(slot2.source);
      }
      const parsed1 = parseSeedSource(slot1.source);
      if (parsed1?.type === "winner") {
        meta.team1Feed = resolveSource(slot1.source);
      }

      addMatchFn(team1, team2, stageKey, roundIndex, matchIndexInRound, seriesRuleKey, meta);
    }
  }
}

export function engineHasCompiledMatches(engineConfig) {
  const stages = engineConfig?.stages || [];
  return stages.some(
    (stage, index) =>
      index > 0 &&
      stage.type !== "group_round_robin" &&
      stage.type !== "round_robin" &&
      resolveStageMatches(stage, index, stages, engineConfig).length > 0,
  );
}
