import { computeGroupSizes, resolveGroupStageConfig } from "./engineGroupConfig.js";
import { buildBlastSeriesRules, getBlastSeriesRuleTemplates } from "./blastSeriesRules.js";
import { getBlastPhaseSizes } from "./formatGenerator.js";

export const SCHEDULE_PHASE_GROUPS = "groups";
export const SCHEDULE_PHASE_QUALIFIERS = "qualifiers";
export const SCHEDULE_PHASE_PLAYOFFS = "playoffs";

const STAGE_TYPE_TO_PHASE = {
  group_round_robin: SCHEDULE_PHASE_GROUPS,
  last_chance: SCHEDULE_PHASE_QUALIFIERS,
  play_in: SCHEDULE_PHASE_QUALIFIERS,
  crossover: SCHEDULE_PHASE_QUALIFIERS,
  single_elimination: SCHEDULE_PHASE_PLAYOFFS,
  double_elimination: SCHEDULE_PHASE_PLAYOFFS,
  round_robin: SCHEDULE_PHASE_GROUPS,
};

/** Group ranks that feed Last Chance for classic BLAST layouts. */
export function blastLastChanceRanks(teamCount) {
  const n = Math.max(10, Number(teamCount) || 12);
  if (n === 10) return [4, 5];
  if (n === 12) return [5, 6];
  const perGroup = Math.ceil(n / 2);
  return [perGroup - 1, perGroup].filter((rank) => rank >= 2);
}

export function buildBlastPipelineStages(teamCount) {
  const ranks = blastLastChanceRanks(teamCount);
  return [
    {
      key: "groups",
      label: "Group Stage",
      type: "group_round_robin",
      seriesRuleKey: "blast-group-bo1",
    },
    {
      key: "last_chance",
      label: "Last Chance",
      type: "last_chance",
      inputs: [{ fromStage: "groups", ranks }],
    },
    {
      key: "play_in",
      label: "Play-In",
      type: "play_in",
    },
    {
      key: "playoffs",
      label: "Playoffs",
      type: "single_elimination",
      seriesRuleKey: "blast-po-quarterfinal",
    },
  ];
}

export function buildBlastEngineConfig(teamCount, seriesType = "bo3") {
  const n = Math.max(10, Math.min(64, Number(teamCount) || 12));
  const groupCount = 2;
  const groupSizes = computeGroupSizes(n, groupCount);
  const sizes = getBlastPhaseSizes(n);
  return {
    version: 2,
    presetId: n === 10 ? "BLAST-10" : n === 12 ? "BLAST-12" : null,
    teamCount: n,
    format: "blast",
    seriesType,
    groupStage: {
      enabled: true,
      groupCount,
      balance: "equal",
      groupSizes,
      seedingMode: "seed_order",
    },
    stages: buildBlastPipelineStages(n),
    seriesRules: buildBlastSeriesRules(n, seriesType),
    blastPhasePath: sizes?.mainPlayoffPath || null,
  };
}

function stageTypeSchedulePhase(stageType, format) {
  if (format === "dse" && stageType === "double_elimination") return SCHEDULE_PHASE_PLAYOFFS;
  return STAGE_TYPE_TO_PHASE[stageType] || SCHEDULE_PHASE_PLAYOFFS;
}

/** Map engine stage → bracket tab ids that matches are stored under. */
export function stageToBracketTabIds(stage, engineConfig, format) {
  const fmt = String(format || engineConfig?.format || "").toLowerCase();
  if (stage.type === "group_round_robin") {
    if (fmt === "blast") {
      const groupPlan = resolveGroupStageConfig(engineConfig);
      const keys = groupPlan.enabled ? groupPlan.groupKeys : ["A", "B"];
      return keys.map((key) => `blast-group-${key.toLowerCase()}`);
    }
    if (fmt === "gsl" || fmt === "hybrid") {
      const groupPlan = resolveGroupStageConfig(engineConfig);
      const keys = groupPlan.enabled ? groupPlan.groupKeys : ["A", "B"];
      return keys.map((key) => `group-${key.toLowerCase()}`);
    }
    return [stage.key || "group-stage"];
  }
  if (stage.type === "last_chance" && fmt === "blast") return ["blast-lastchance"];
  if ((stage.type === "play_in" || stage.type === "crossover") && fmt === "blast") return ["blast-playin"];
  if (stage.type === "single_elimination" && fmt === "blast") return ["blast-playoffs"];
  if (stage.type === "double_elimination" && fmt === "dse") return ["upper", "lower", "grand"];
  if (stage.type === "round_robin" && fmt === "rr") return ["league"];
  if (stage.type === "single_elimination") return ["playoffs"];
  return [stage.key || stage.type];
}

/**
 * Merge adjacent LC + play_in engine stages into one qualifiers tab bucket (matches generator UI).
 */
export function normalizedBlastBracketTabsFromEngine(tabs, format) {
  if (String(format || "").toLowerCase() !== "blast" || !Array.isArray(tabs) || !tabs.length) return tabs;
  const hasMerged = tabs.some((tab) => tab.id === "blast-qualifiers");
  const iLC = tabs.findIndex((tab) => tab.id === "blast-lastchance");
  const iPI = tabs.findIndex((tab) => tab.id === "blast-playin");
  if (!hasMerged && iLC >= 0 && iPI >= 0 && iPI === iLC + 1) {
    const lcLabel = tabs[iLC].label || "Last Chance";
    const piLabel = tabs[iPI].label || "Play-In";
    const next = [...tabs];
    next.splice(iLC, 2, {
      id: "blast-qualifiers",
      label: lcLabel === piLabel ? lcLabel : `${lcLabel} & ${piLabel}`,
      schedulePhase: SCHEDULE_PHASE_QUALIFIERS,
      sourceTabIds: ["blast-lastchance", "blast-playin"],
    });
    return next;
  }
  return tabs;
}

/**
 * Schedule / bracket section nav derived from engine_config.stages.
 * @returns {{ id: string, label: string, shortLabel: string, tabIds: string[], schedulePhase: string }[]}
 */
export function resolveEngineScheduleSections(engineConfig, format) {
  const fmt = String(format || engineConfig?.format || "").toLowerCase();
  const stages = Array.isArray(engineConfig?.stages) ? engineConfig.stages : [];
  if (!stages.length) return [];

  const sections = [];
  let bucket = null;

  function flush() {
    if (bucket?.tabIds?.length) sections.push(bucket);
    bucket = null;
  }

  for (const stage of stages) {
    const phase = stageTypeSchedulePhase(stage.type, fmt);
    const tabIds = stageToBracketTabIds(stage, engineConfig, fmt);
    const label = stage.label || stage.key || phase;
    if (!bucket || bucket.schedulePhase !== phase) {
      flush();
      bucket = {
        id: phase,
        label,
        shortLabel: label.length > 18 ? label.split(" ")[0] : label,
        tabIds: [...tabIds],
        schedulePhase: phase,
        stageKeys: [...tabIds],
      };
    } else {
      bucket.label = `${bucket.label} & ${label}`;
      bucket.tabIds.push(...tabIds);
      bucket.stageKeys.push(...tabIds);
    }
  }
  flush();

  if (fmt === "blast") {
    return sections.map((section) => {
      if (section.schedulePhase !== SCHEDULE_PHASE_QUALIFIERS) return section;
      const hasLc = section.tabIds.includes("blast-lastchance");
      const hasPi = section.tabIds.includes("blast-playin");
      if (hasLc && hasPi) {
        return {
          ...section,
          id: "blast-qualifiers",
          tabIds: ["blast-qualifiers", ...section.tabIds.filter((id) => id !== "blast-lastchance" && id !== "blast-playin")],
          stageKeys: section.tabIds,
        };
      }
      return section;
    });
  }

  return sections;
}

/** stageKey → schedule phase; uses engine sections when available. */
export function getSchedulePhaseForStageKey(stageKey, engineConfig, format) {
  const sections = resolveEngineScheduleSections(engineConfig, format);
  if (sections.length) {
    for (const section of sections) {
      if (section.stageKeys?.includes(stageKey)) return section.schedulePhase;
      if (section.id === "blast-qualifiers" && (stageKey === "blast-lastchance" || stageKey === "blast-playin")) {
        return SCHEDULE_PHASE_QUALIFIERS;
      }
    }
  }
  const sk = stageKey || "";
  if (sk === "blast-lastchance" || sk === "blast-playin" || sk === "blast-qualifiers-playin") {
    return SCHEDULE_PHASE_QUALIFIERS;
  }
  if (sk.startsWith("blast-group-") || sk.startsWith("group-")) return SCHEDULE_PHASE_GROUPS;
  return SCHEDULE_PHASE_PLAYOFFS;
}

export function getSeriesRuleTemplatesForConfig(engineConfig) {
  const format = String(engineConfig?.format || "").toLowerCase();
  const teamCount = Number(engineConfig?.teamCount) || 12;
  if (format === "blast") return getBlastSeriesRuleTemplates(teamCount);
  return [];
}
