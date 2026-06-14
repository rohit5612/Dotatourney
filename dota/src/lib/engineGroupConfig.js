/** Client mirror of server engine group/seeding helpers. */

export const SEEDING_MODES = [
  { id: "seed_order", label: "Seed order", hint: "Highest seeds fill Group A, then B, etc." },
  { id: "snake", label: "Snake draft", hint: "Serpentine distribution by seed (1→A, 2→B, 3→B, 4→A…)" },
  { id: "random", label: "Random draw", hint: "Shuffle teams randomly into groups" },
  { id: "manual", label: "Manual", hint: "Assign groups on the Bracket page before generating" },
];

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
  const balance = groupStage.balance === "custom" ? "custom" : "equal";
  const customSizes =
    balance === "custom" && Array.isArray(groupStage.groupSizes) ? groupStage.groupSizes : null;
  const groupSizes = computeGroupSizes(teamCount, groupCount, customSizes);
  const groupKeys = groupKeysForCount(groupCount);
  const seedingMode = ["manual", "seed_order", "random", "snake"].includes(groupStage.seedingMode)
    ? groupStage.seedingMode
    : "seed_order";

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

function distributeInOrder(orderedTeams, groupKeys, groupSizes) {
  const assignments = [];
  let cursor = 0;
  for (let groupIndex = 0; groupIndex < groupKeys.length; groupIndex += 1) {
    const size = groupSizes[groupIndex] || 0;
    for (let slot = 0; slot < size; slot += 1) {
      const team = orderedTeams[cursor];
      if (!team) break;
      assignments.push({ groupKey: groupKeys[groupIndex] });
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
    } else break;
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
    (buckets[key] || []).map(() => ({ groupKey: key })),
  );
}

export function previewGroupAssignments(teamCount, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  const mockTeams = Array.from({ length: teamCount }, (_, index) => ({ id: `t${index}`, seed: index + 1, name: `Team ${index + 1}` }));
  const sorted = sortTeamsBySeed(mockTeams);
  if (plan.seedingMode === "snake") return distributeSnake(sorted, plan.groupKeys, plan.groupSizes);
  return distributeInOrder(sorted, plan.groupKeys, plan.groupSizes);
}

export function isGroupAssignmentValid(teams, engineConfig) {
  if (!teams?.length) return false;
  const plan = resolveGroupStageConfig(engineConfig);
  if (!plan.enabled) return true;
  const counts = Object.fromEntries(plan.groupKeys.map((key) => [key, 0]));
  for (const team of teams) {
    if (!plan.groupKeys.includes(team.groupKey)) return false;
    counts[team.groupKey] += 1;
  }
  return plan.groupKeys.every((key, index) => counts[key] === plan.groupSizes[index]);
}

export function defaultGroupKeyForIndex(index, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig);
  let cursor = 0;
  for (let groupIndex = 0; groupIndex < plan.groupKeys.length; groupIndex += 1) {
    const size = plan.groupSizes[groupIndex] || 0;
    if (index < cursor + size) return plan.groupKeys[groupIndex];
    cursor += size;
  }
  return plan.groupKeys[0] || "A";
}

function distributeInOrderWithIds(orderedTeams, groupKeys, groupSizes) {
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

function distributeSnakeWithIds(orderedTeams, groupKeys, groupSizes) {
  const buckets = Object.fromEntries(groupKeys.map((key) => [key, []]));
  const capacities = Object.fromEntries(groupKeys.map((key, index) => [key, groupSizes[index] || 0]));
  let direction = 1;
  let groupIndex = 0;

  for (const team of orderedTeams) {
    const key = groupKeys[groupIndex];
    if ((buckets[key]?.length || 0) < (capacities[key] || 0)) {
      buckets[key].push(team);
    } else break;
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

export function applySeedingDraft(teams, engineConfig, modeOverride = null) {
  const plan = resolveGroupStageConfig(engineConfig);
  const mode = modeOverride || plan.seedingMode;
  const sorted = sortTeamsBySeed(teams);
  let assignments = [];
  if (mode === "random") {
    const shuffled = [...sorted].sort(() => Math.random() - 0.5);
    assignments = distributeInOrderWithIds(shuffled, plan.groupKeys, plan.groupSizes);
  } else if (mode === "snake") {
    assignments = distributeSnakeWithIds(sorted, plan.groupKeys, plan.groupSizes);
  } else {
    assignments = distributeInOrderWithIds(sorted, plan.groupKeys, plan.groupSizes);
  }
  const byId = Object.fromEntries(assignments.map((entry) => [entry.teamId, entry.groupKey]));
  return teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    abbr: team.abbr,
    groupKey: byId[team.id] || plan.groupKeys[0],
  }));
}
