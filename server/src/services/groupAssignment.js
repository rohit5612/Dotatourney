import {
  assignTeamsToGroups,
  buildGroupIndices,
  defaultGroupKeysForTeams as engineDefaultGroupKeys,
  formatUsesGroupAssignmentFromConfig,
  resolveGroupStageConfig,
  validateGroupAssignment as validateEngineGroupAssignment,
} from "./engineGroupConfig.js";

const LEGACY_GROUP_FORMATS = new Set(["blast"]);

export function formatUsesGroupAssignment(format, engineConfig = null) {
  if (engineConfig) return formatUsesGroupAssignmentFromConfig(engineConfig);
  return LEGACY_GROUP_FORMATS.has(format);
}

export function expectedGroupSizes(teamCount, engineConfig = null) {
  const plan = resolveGroupStageConfig(
    engineConfig || { teamCount, format: "blast", groupStage: { enabled: true, groupCount: 2 } },
  );
  if (plan.groupKeys.length === 2) {
    return { groupA: plan.groupSizes[0], groupB: plan.groupSizes[1] };
  }
  return Object.fromEntries(plan.groupKeys.map((key, index) => [`group${key}`, plan.groupSizes[index]]));
}

export function defaultGroupKeysForTeams(teams, engineConfig = null) {
  const config =
    engineConfig ||
    { teamCount: teams.length, format: "blast", groupStage: { enabled: true, groupCount: 2, seedingMode: "seed_order" } };
  return engineDefaultGroupKeys(teams, config);
}

export function validateGroupAssignment(teams, engineConfig = null) {
  if (engineConfig) return validateEngineGroupAssignment(teams, engineConfig);
  return validateEngineGroupAssignment(teams, {
    teamCount: teams?.length || 0,
    format: "blast",
    groupStage: { enabled: true, groupCount: 2 },
  });
}

export { buildGroupIndices, resolveGroupStageConfig, assignTeamsToGroups };
