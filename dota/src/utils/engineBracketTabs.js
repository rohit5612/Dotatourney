import { resolveGroupStageConfig } from "../lib/engineGroupConfig.js";
import { normalizedBlastBracketTabsFromEngine } from "./engineStages.js";

function normalizeEngineConfig(config) {
  if (!config || typeof config !== "object") return null;
  const normalized = { ...config, version: Number(config.version) >= 2 ? 2 : 2 };
  const groupFromStage = (config.stages || []).find((stage) => stage.type === "group_round_robin");
  if (!normalized.groupStage && groupFromStage) {
    normalized.groupStage = {
      enabled: true,
      groupCount: groupFromStage.groupCount || 2,
      balance: "equal",
      groupSizes: groupFromStage.groupSizes || null,
      seedingMode: groupFromStage.seedingMode || "seed_order",
    };
  }
  if (normalized.groupStage && normalized.groupStage.enabled == null) {
    normalized.groupStage.enabled = true;
  }
  return normalized;
}

function seriesBoLabel(seriesRules, ruleKey, fallback = "BO1") {
  const value = ruleKey && seriesRules?.[ruleKey];
  return value ? String(value).toUpperCase() : fallback;
}

function stageTypeSchedulePhase(stageType) {
  if (stageType === "group_round_robin" || stageType === "round_robin") return "groups";
  if (stageType === "last_chance" || stageType === "play_in" || stageType === "crossover") return "qualifiers";
  return "playoffs";
}

/** Client mirror of server engineBracketTabs — bracket/schedule tab ids from engine_config. */
export function engineBracketTabs(config) {
  const normalized = normalizeEngineConfig(config);
  if (!normalized) return null;
  const stages = Array.isArray(normalized.stages) ? normalized.stages : [];
  if (!stages.length) return null;

  const format = String(normalized.format || "").toLowerCase();
  const seriesRules = normalized.seriesRules || {};
  const groupPlan = resolveGroupStageConfig(normalized);

  const tabs = [];
  for (const stage of stages) {
    if (stage.type === "group_round_robin") {
      if (format === "blast") {
        const keys = groupPlan.enabled ? groupPlan.groupKeys : ["A", "B"];
        const bo = seriesBoLabel(seriesRules, stage.seriesRuleKey || "blast-group-bo1", "BO1");
        for (const key of keys) {
          tabs.push({
            id: `blast-group-${key.toLowerCase()}`,
            label: `${stage.label || `Group ${key}`} (${bo})`,
            schedulePhase: "groups",
          });
        }
        continue;
      }
      if (format === "gsl" || format === "hybrid") {
        const keys = groupPlan.enabled ? groupPlan.groupKeys : ["A", "B"];
        for (const key of keys) {
          tabs.push({ id: `group-${key.toLowerCase()}`, label: stage.label || `Group ${key}`, schedulePhase: "groups" });
        }
        continue;
      }
      tabs.push({ id: stage.key || "group-stage", label: stage.label || "Group Stage", schedulePhase: "groups" });
      continue;
    }
    if (stage.type === "last_chance" && format === "blast") {
      tabs.push({ id: "blast-lastchance", label: stage.label || "Last Chance", schedulePhase: "qualifiers" });
      continue;
    }
    if ((stage.type === "play_in" || stage.type === "crossover") && format === "blast") {
      tabs.push({ id: "blast-playin", label: stage.label || "Play-In", schedulePhase: "qualifiers" });
      continue;
    }
    if (stage.type === "single_elimination" && format === "blast") {
      tabs.push({ id: "blast-playoffs", label: stage.label || "Playoffs", schedulePhase: "playoffs" });
      continue;
    }
    if (stage.type === "double_elimination" && format === "dse") {
      tabs.push({ id: "upper", label: "Upper bracket", schedulePhase: "playoffs" });
      tabs.push({ id: "lower", label: "Lower bracket", schedulePhase: "playoffs" });
      tabs.push({ id: "grand", label: "Grand final", schedulePhase: "playoffs" });
      continue;
    }
    if (stage.type === "round_robin" && format === "rr") {
      tabs.push({ id: "league", label: stage.label || "League stage", schedulePhase: "groups" });
      continue;
    }
    if (stage.type === "single_elimination" && (format === "rr" || format === "swiss" || format === "gsl")) {
      tabs.push({ id: "playoffs", label: stage.label || "Playoffs", schedulePhase: "playoffs" });
      continue;
    }
    tabs.push({
      id: stage.key,
      label: stage.label || stage.key,
      schedulePhase: stageTypeSchedulePhase(stage.type),
    });
  }
  return normalizedBlastBracketTabsFromEngine(tabs, format);
}

/** Resolve tabs from API payload or engine config. */
export function resolveBracketTabs(format, apiTabs, engineConfig) {
  if (apiTabs?.length) return apiTabs;
  return engineBracketTabs(engineConfig) || [];
}
