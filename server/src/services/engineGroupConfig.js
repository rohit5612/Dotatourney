/** Group stage + seeding helpers driven by engine_config. */

export const SEEDING_MODES = ["manual", "seed_order", "random", "snake"];
export const GROUP_BALANCE_MODES = ["equal", "custom"];

export function groupKeyAt(index) {
  return String.fromCharCode(65 + index);
}

export function groupKeysForCount(groupCount) {
  const count = Math.max(1, Math.min(8, Number(groupCount) || 2));
  return Array.from({ length: count }, (_, index) => groupKeyAt(index));
}

export function computeGroupSizes(teamCount, groupCount, customSizes = null) {
  const teams = Math.max(2, Number(teamCount) || 2);
  const groups = Math.max(1, Math.min(8, Number(groupCount) || 2));
  if (Array.isArray(customSizes) && customSizes.length === groups) {
    const sizes = customSizes.map((value) => Math.max(0, Number(value) || 0));
    const sum = sizes.reduce((acc, value) => acc + value, 0);
    if (sum === teams) return sizes;
  }
  const base = Math.floor(teams / groups);
  const remainder = teams % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function resolveGroupStageConfig(engineConfig) {
  const config = engineConfig && typeof engineConfig === "object" ? engineConfig : {};
  const groupStage = config.groupStage && typeof config.groupStage === "object" ? config.groupStage : {};
  const groupStageFromLegacy = (config.stages || []).find((stage) => stage.type === "group_round_robin");

  const teamCount = Math.max(2, Number(config.teamCount) || 12);
  const enabled =
    groupStage.enabled !== false &&
    Boolean(groupStageFromLegacy || groupStage.enabled === true || config.format === "blast");
  const groupCount = Math.max(
    2,
    Math.min(8, Number(groupStage.groupCount ?? groupStageFromLegacy?.groupCount) || 2),
  );
  const balance = GROUP_BALANCE_MODES.includes(groupStage.balance) ? groupStage.balance : "equal";
  const customSizes =
    balance === "custom" && Array.isArray(groupStage.groupSizes) ? groupStage.groupSizes : null;
  const groupSizes = computeGroupSizes(teamCount, groupCount, customSizes);
  const groupKeys = groupKeysForCount(groupCount);
  const seedingMode = SEEDING_MODES.includes(groupStage.seedingMode) ? groupStage.seedingMode : "seed_order";

  return {
    enabled,
    teamCount,
    groupCount,
    groupSizes,
    groupKeys,
    balance,
    seedingMode,
    format: String(config.format || "").toLowerCase(),
    requiresManualAssignment: seedingMode === "manual",
  };
}

export function formatUsesGroupAssignmentFromConfig(engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  return plan.enabled && plan.groupCount >= 2;
}

export function formatUsesGroupAssignment(format, engineConfig = null) {
  if (engineConfig) return formatUsesGroupAssignmentFromConfig(engineConfig);
  return String(format || "").toLowerCase() === "blast";
}

function sortTeamsBySeed(teams) {
  return [...teams].sort((a, b) => {
    const seedA = Number.isFinite(Number(a.seed)) ? Number(a.seed) : 9999;
    const seedB = Number.isFinite(Number(b.seed)) ? Number(b.seed) : 9999;
    if (seedA !== seedB) return seedA - seedB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function shuffleTeams(teams) {
  const arr = [...teams];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distributeInOrder(orderedTeams, groupKeys, groupSizes) {
  const assignments = [];
  let cursor = 0;
  for (let groupIndex = 0; groupIndex < groupKeys.length; groupIndex += 1) {
    const size = groupSizes[groupIndex] || 0;
    for (let slot = 0; slot < size; slot += 1) {
      const team = orderedTeams[cursor];
      if (!team) break;
      assignments.push({ teamId: team.id, groupKey: groupKeys[groupIndex] });
      cursor += 1;
    }
  }
  return assignments;
}

function distributeSnake(orderedTeams, groupKeys, groupSizes) {
  const buckets = Object.fromEntries(groupKeys.map((key) => [key, []]));
  const capacities = Object.fromEntries(groupKeys.map((key, index) => [key, groupSizes[index] || 0]));
  let direction = 1;
  let groupIndex = 0;

  for (const team of orderedTeams) {
    const key = groupKeys[groupIndex];
    if ((buckets[key]?.length || 0) < (capacities[key] || 0)) {
      buckets[key].push(team);
    } else {
      break;
    }
    if (groupKeys.length <= 1) continue;
    groupIndex += direction;
    if (groupIndex >= groupKeys.length) {
      groupIndex = groupKeys.length - 1;
      direction = -1;
    } else if (groupIndex < 0) {
      groupIndex = 0;
      direction = 1;
    }
  }

  return groupKeys.flatMap((key) =>
    (buckets[key] || []).map((team) => ({ teamId: team.id, groupKey: key })),
  );
}

export function assignTeamsToGroups(teams, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  if (!plan.enabled) return [];

  const sorted = sortTeamsBySeed(teams);
  let ordered = sorted;
  if (plan.seedingMode === "random") ordered = shuffleTeams(sorted);
  if (plan.seedingMode === "snake") {
    return distributeSnake(sorted, plan.groupKeys, plan.groupSizes);
  }
  if (plan.seedingMode === "manual") return [];
  return distributeInOrder(ordered, plan.groupKeys, plan.groupSizes);
}

export function validateGroupAssignment(teams, engineConfig) {
  if (!teams?.length) return "No teams to assign";
  const plan = resolveGroupStageConfig(engineConfig);
  if (!plan.enabled) return "";

  const counts = Object.fromEntries(plan.groupKeys.map((key) => [key, 0]));
  for (const team of teams) {
    const key = team.groupKey;
    if (!plan.groupKeys.includes(key)) {
      return `Every team must be assigned to one of: ${plan.groupKeys.join(", ")}`;
    }
    counts[key] += 1;
  }
  for (let index = 0; index < plan.groupKeys.length; index += 1) {
    const key = plan.groupKeys[index];
    const expected = plan.groupSizes[index];
    if (counts[key] !== expected) {
      return `Group ${key} must have ${expected} teams (currently ${counts[key]})`;
    }
  }
  return "";
}

/** Returns per-group team indices plus legacy idxA/idxB aliases. */
export function buildGroupIndices(teams, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  const indices = Object.fromEntries(plan.groupKeys.map((key) => [key, []]));
  teams.forEach((team, index) => {
    if (indices[team.groupKey]) indices[team.groupKey].push(index);
  });
  return {
    idxA: indices.A || [],
    idxB: indices.B || [],
    byGroup: indices,
    groupKeys: plan.groupKeys,
  };
}

export function defaultGroupKeysForTeams(teams, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  if (plan.requiresManualAssignment) return [];
  const assignments = assignTeamsToGroups(teams, engineConfig);
  if (assignments.length) return assignments;
  return distributeInOrder(sortTeamsBySeed(teams), plan.groupKeys, plan.groupSizes);
}
