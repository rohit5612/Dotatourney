import { computeGroupSizes, resolveGroupStageConfig } from "../lib/engineGroupConfig.js";
import { normalizeEngineStageSeeding } from "./engineStageSeeding.js";
import {
  getBlastPhaseSizesUi,
  getBlastSeriesRuleTemplates,
  mergeBlastSeriesRules,
  seriesRuleTemplates,
} from "../constants/tournament.js";
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
  const sizes = getBlastPhaseSizesUi(n);
  return normalizeEngineStageSeeding({
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
    seriesRules: mergeBlastSeriesRules({}, n, seriesType),
    blastPhasePath: sizes?.mainPlayoffPath || null,
  });
}

function stageTypeSchedulePhase(stageType, format) {
  return STAGE_TYPE_TO_PHASE[stageType] || SCHEDULE_PHASE_PLAYOFFS;
}

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
        shortLabel: label.length > 20 ? label.split(/\s+/).slice(0, 2).join(" ") : label,
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
          label: section.label.includes("&") ? section.label : "Last Chance & Play-In",
          shortLabel: "Qualifiers",
          tabIds: [
            "blast-qualifiers",
            ...section.tabIds.filter((id) => id !== "blast-lastchance" && id !== "blast-playin"),
          ],
          stageKeys: section.tabIds,
        };
      }
      return section;
    });
  }

  return sections;
}

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
  return seriesRuleTemplates[format] || [];
}

const STAGE_TYPES_WITHOUT_SERIES_RULE = new Set(["last_chance", "play_in", "crossover"]);

export function stageUsesSeriesRule(stage) {
  return stage && !STAGE_TYPES_WITHOUT_SERIES_RULE.has(stage.type);
}

/** Friendly dropdown options for the stage pipeline (no raw rule keys in the UI). */
export function seriesRuleOptionsForStage(stage, engineConfig) {
  if (!stageUsesSeriesRule(stage)) return [];

  const format = String(engineConfig?.format || "").toLowerCase();
  const templates = getSeriesRuleTemplatesForConfig(engineConfig);
  if (!templates.length) return [];

  if (format === "blast") {
    if (stage.type === "group_round_robin") {
      return templates.filter((rule) => rule.key === "blast-group-bo1");
    }
    if (stage.type === "single_elimination") {
      return templates.filter((rule) => rule.key.startsWith("blast-po-"));
    }
    return templates;
  }

  if (stage.type === "group_round_robin" || stage.type === "round_robin") {
    const groupish = templates.filter((rule) => /group|league|rr|swiss/i.test(rule.key));
    return groupish.length ? groupish : templates;
  }
  if (stage.type === "single_elimination") {
    const playoffish = templates.filter((rule) => /playoff|final|quarter|semi|upper-r1/i.test(rule.key));
    return playoffish.length ? playoffish : templates;
  }
  if (stage.type === "double_elimination") {
    return templates;
  }

  return templates;
}

export function resolveStageSeriesRuleKey(stage, engineConfig) {
  const options = seriesRuleOptionsForStage(stage, engineConfig);
  if (!options.length) return "";
  const current = stage?.seriesRuleKey;
  if (current && options.some((rule) => rule.key === current)) return current;
  return options[0].key;
}

export function defaultSeriesRuleKeyForStage(stage, engineConfig) {
  return resolveStageSeriesRuleKey(stage, engineConfig);
}

/** Bracket block sections for public schedule (one div per engine stage group). */
export function resolveBracketViewSections(engineConfig, format, bracketTabs) {
  const engineSections = resolveEngineScheduleSections(engineConfig, format);
  if (!engineSections.length) {
    return (bracketTabs || []).map((tab) => ({
      id: tab.id,
      label: tab.label,
      tabIds: [tab.id],
    }));
  }

  const tabById = Object.fromEntries((bracketTabs || []).map((tab) => [tab.id, tab]));
  return engineSections
    .map((section) => {
      const ids =
        section.id === "blast-qualifiers"
          ? ["blast-qualifiers"]
          : section.tabIds.filter((id) => tabById[id] || id === "blast-qualifiers");
      if (!ids.length) return null;
      const label =
        section.id === "blast-qualifiers"
          ? tabById["blast-qualifiers"]?.label || section.label
          : ids.length === 1
            ? tabById[ids[0]]?.label || section.label
            : section.label;
      return { id: section.id, label, tabIds: ids };
    })
    .filter(Boolean);
}
