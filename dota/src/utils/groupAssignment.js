import {
  applySeedingDraft,
  computeGroupSizes,
  defaultGroupKeyForIndex,
  formatUsesGroupAssignment,
  formatUsesGroupAssignmentFromConfig,
  groupKeysForCount,
  isGroupAssignmentValid,
  previewGroupAssignments,
  resolveGroupStageConfig,
  SEEDING_MODES,
} from "../lib/engineGroupConfig.js";

export {
  applySeedingDraft,
  computeGroupSizes,
  defaultGroupKeyForIndex,
  formatUsesGroupAssignment,
  formatUsesGroupAssignmentFromConfig,
  groupKeysForCount,
  isGroupAssignmentValid,
  previewGroupAssignments,
  resolveGroupStageConfig,
  SEEDING_MODES,
};

export function expectedGroupSizes(teamCount, engineConfig = null) {
  const plan = resolveGroupStageConfig(
    engineConfig || { teamCount, format: "blast", groupStage: { enabled: true, groupCount: 2 } },
  );
  if (plan.groupKeys.length === 2) {
    return { groupA: plan.groupSizes[0], groupB: plan.groupSizes[1] };
  }
  return Object.fromEntries(plan.groupKeys.map((key, index) => [key, plan.groupSizes[index]]));
}
