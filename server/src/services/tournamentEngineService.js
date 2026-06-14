import { buildDefaultSeriesRules } from "./formatPresetsSeriesRules.js";
import { FORMAT_PRESETS, resolveFormatPreset } from "./formatPresets.js";
import { resolveGroupStageConfig } from "./engineGroupConfig.js";
import { buildBlastEngineConfig, normalizedBlastBracketTabsFromEngine } from "./engineStages.js";
import { engineHasCompiledMatches } from "./engineStageSeeding.js";
import { buildBlastSeriesRules } from "./blastSeriesRules.js";

const STAGE_TYPES = new Set([
  "group_round_robin",
  "last_chance",
  "play_in",
  "crossover",
  "single_elimination",
  "double_elimination",
  "round_robin",
]);

export function defaultEngineConfig(presetId = "BLAST-12") {
  const preset = resolveFormatPreset(presetId);
  if (!preset) {
    return {
      version: 1,
      presetId: null,
      teamCount: 12,
      format: "blast",
      seriesType: "bo3",
      stages: [],
      seriesRules: buildDefaultSeriesRules("blast", "bo3"),
    };
  }
  const groupCount = preset.groupCount || 2;
  const perGroup = Math.ceil(preset.teamCount / groupCount);
  const groupSizes = Array.from({ length: groupCount }, (_, i) =>
    i === groupCount - 1 ? preset.teamCount - perGroup * (groupCount - 1) : perGroup,
  );
  if (preset.format === "blast") {
    return buildBlastEngineConfig(preset.teamCount, preset.seriesType);
  }
  if (preset.format === "dse") {
    return {
      version: 1,
      presetId: preset.id,
      teamCount: preset.teamCount,
      format: preset.format,
      seriesType: preset.seriesType,
      stages: [
        {
          key: "upper",
          label: "Upper Bracket",
          type: "double_elimination",
          seriesRuleKey: "upper-r1",
        },
      ],
      seriesRules: preset.seriesRules,
    };
  }
  return {
    version: 1,
    presetId: preset.id,
    teamCount: preset.teamCount,
    format: preset.format,
    seriesType: preset.seriesType,
    stages: [
      {
        key: "main",
        label: "Main Bracket",
        type: preset.format === "rr" ? "round_robin" : "single_elimination",
        seriesRuleKey: preset.format === "rr" ? "rr-all" : "upper-r1",
      },
    ],
    seriesRules: preset.seriesRules,
  };
}

export function normalizeEngineConfig(config) {
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

export function validateEngineConfig(config) {
  const normalized = normalizeEngineConfig(config);
  const errors = [];
  if (!normalized || typeof normalized !== "object") {
    return { valid: false, errors: ["Engine config is required"] };
  }
  const teamCount = Number(normalized.teamCount);
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    errors.push("Team count must be at least 2");
  }
  const format = String(normalized.format || "").trim();
  if (!format) errors.push("Format is required");
  const stages = Array.isArray(normalized.stages) ? normalized.stages : [];
  if (!stages.length) errors.push("At least one stage is required");
  for (const stage of stages) {
    if (!stage?.key) errors.push("Each stage needs a key");
    if (!STAGE_TYPES.has(stage?.type)) errors.push(`Unknown stage type: ${stage?.type}`);
  }
  const groupPlan = resolveGroupStageConfig(normalized);
  if (groupPlan.enabled) {
    if (groupPlan.groupCount < 2) errors.push("Group stage requires at least 2 groups");
    const sizeSum = groupPlan.groupSizes.reduce((acc, value) => acc + value, 0);
    if (sizeSum !== teamCount) {
      errors.push(`Group sizes must sum to ${teamCount} teams (currently ${sizeSum})`);
    }
    if (format === "blast" && groupPlan.groupCount !== 2 && !engineHasCompiledMatches(normalized)) {
      errors.push(
        `BLAST with ${groupPlan.groupCount} groups requires qualifier/playoff match seeding in the tournament engine`,
      );
    }
  }
  let seriesRules = normalized.seriesRules && typeof normalized.seriesRules === "object" ? normalized.seriesRules : {};
  if (format === "blast") {
    seriesRules = buildBlastSeriesRules(teamCount, normalized.seriesType || "bo3", seriesRules);
    normalized.seriesRules = seriesRules;
  }
  if (!Object.keys(seriesRules).length) errors.push("Series rules are required");
  return { valid: errors.length === 0, errors, config: normalized };
}

/** Build engine config for legacy tournaments created before engine_config existed. */
export function inferEngineConfigFromTournament(tournament) {
  const format = String(tournament?.format || "").trim().toLowerCase();
  const teamCount = Math.max(2, Number(tournament?.team_count ?? tournament?.teamCount) || 12);
  const seriesType = tournament?.series_type || tournament?.seriesType || "bo3";
  const rawRules = tournament?.series_rules ?? tournament?.seriesRules;
  const seriesRules =
    rawRules && typeof rawRules === "object" && !Array.isArray(rawRules) ? rawRules : {};

  const presets = Object.values(FORMAT_PRESETS);
  const presetId =
    presets.find((preset) => preset.format === format && preset.teamCount === teamCount)?.id ||
    presets.find((preset) => preset.format === format)?.id ||
    (format === "dse"
      ? "DSE"
      : format === "rr"
        ? "RR-6"
        : format === "se"
          ? "SE-8"
            : "BLAST-12");

  if (format === "blast") {
    const base = buildBlastEngineConfig(teamCount, seriesType);
    return {
      ...base,
      seriesRules: Object.keys(seriesRules).length ? buildBlastSeriesRules(teamCount, seriesType, seriesRules) : base.seriesRules,
    };
  }

  const base = defaultEngineConfig(presetId);
  return {
    ...base,
    teamCount,
    format: format || base.format,
    seriesType,
    seriesRules: Object.keys(seriesRules).length ? seriesRules : base.seriesRules,
  };
}

export function resolveEngineConfigForApproval(tournament) {
  const existing = normalizeEngineConfig(tournament?.engine_config ?? tournament?.engineConfig ?? null);
  const existingValidation = validateEngineConfig(existing);
  if (existingValidation.valid) {
    return { config: existingValidation.config, backfilled: false };
  }

  const inferred = inferEngineConfigFromTournament(tournament);
  const inferredValidation = validateEngineConfig(inferred);
  if (!inferredValidation.valid) {
    return { config: null, backfilled: false, errors: inferredValidation.errors };
  }

  return { config: inferredValidation.config, backfilled: true };
}

export function compileEngineConfigToGenerator(config) {
  const validated = validateEngineConfig(config);
  if (!validated.valid) {
    const err = new Error(validated.errors.join("; "));
    err.status = 400;
    throw err;
  }
  const normalized = validated.config;
  return {
    format: normalized.format,
    teamCount: Number(normalized.teamCount),
    seriesType: normalized.seriesType || "bo3",
    seriesRules: normalized.seriesRules || {},
    visibilityMode: "tournament",
    engineConfig: normalized,
  };
}

function seriesBoLabel(seriesRules, ruleKey, fallback = "BO1") {
  const value = ruleKey && seriesRules?.[ruleKey];
  return value ? String(value).toUpperCase() : fallback;
}

/** Map engine stages to bracket/schedule tab ids that match generated match stageKey values. */
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
        const bo = seriesBoLabel(seriesRules, stage.seriesRuleKey || "group-all", "BO1");
        for (const key of keys) {
          tabs.push({ id: `blast-group-${key.toLowerCase()}`, label: `Group ${key} (${bo})` });
        }
        continue;
      }
      if (format === "gsl" || format === "hybrid") {
        const keys = groupPlan.enabled ? groupPlan.groupKeys : ["A", "B"];
        for (const key of keys) {
          tabs.push({ id: `group-${key.toLowerCase()}`, label: `Group ${key}` });
        }
        continue;
      }
      tabs.push({ id: stage.key || "group-stage", label: stage.label || "Group Stage" });
      continue;
    }
    if (stage.type === "last_chance" && format === "blast") {
      tabs.push({ id: "blast-lastchance", label: stage.label || "Last Chance" });
      continue;
    }
    if ((stage.type === "play_in" || stage.type === "crossover") && format === "blast") {
      tabs.push({ id: "blast-playin", label: stage.label || "Play-In" });
      continue;
    }
    if (stage.type === "single_elimination" && format === "blast") {
      tabs.push({ id: "blast-playoffs", label: stage.label || "Playoffs" });
      continue;
    }
    if (stage.type === "double_elimination" && format === "dse") {
      tabs.push({ id: "upper", label: "Upper bracket" });
      tabs.push({ id: "lower", label: "Lower bracket" });
      tabs.push({ id: "grand", label: "Grand final" });
      continue;
    }
    if (stage.type === "round_robin" && format === "rr") {
      tabs.push({ id: "league", label: stage.label || "League stage" });
      continue;
    }
    if (stage.type === "single_elimination" && (format === "rr" || format === "swiss" || format === "gsl")) {
      tabs.push({ id: "playoffs", label: stage.label || "Playoffs" });
      continue;
    }
    tabs.push({ id: stage.key, label: stage.label || stage.key, schedulePhase: stageTypeSchedulePhase(stage.type, format) });
  }
  const withPhase = tabs.map((tab) => ({
    ...tab,
    schedulePhase: tab.schedulePhase || inferTabSchedulePhase(tab.id),
  }));
  return normalizedBlastBracketTabsFromEngine(withPhase, format);
}

function stageTypeSchedulePhase(stageType, format) {
  if (stageType === "group_round_robin") return "groups";
  if (stageType === "last_chance" || stageType === "play_in" || stageType === "crossover") return "qualifiers";
  if (stageType === "round_robin") return "groups";
  return "playoffs";
}

function inferTabSchedulePhase(tabId) {
  if (!tabId) return "playoffs";
  if (tabId === "blast-qualifiers" || tabId === "blast-lastchance" || tabId === "blast-playin") return "qualifiers";
  if (tabId.startsWith("blast-group-") || tabId.startsWith("group-")) return "groups";
  return "playoffs";
}

export function engineStageTabs(config) {
  return engineBracketTabs(config);
}

export function summarizeEngineConfig(config) {
  if (!config) return "No engine configured";
  const lines = [`${config.teamCount} teams · ${String(config.format || "").toUpperCase()}`];
  for (const stage of config.stages || []) {
    lines.push(`• ${stage.label || stage.key} (${stage.type})`);
  }
  return lines.join("\n");
}
