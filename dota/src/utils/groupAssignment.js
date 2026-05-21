export function formatUsesGroupAssignment(format) {
  return format === "blast";
}

export function expectedGroupSizes(teamCount) {
  const groupA = Math.ceil(teamCount / 2);
  return { groupA, groupB: teamCount - groupA };
}

export function isGroupAssignmentValid(teams) {
  if (!teams?.length) return false;
  const { groupA, groupB } = expectedGroupSizes(teams.length);
  let countA = 0;
  let countB = 0;
  for (const team of teams) {
    if (team.groupKey === "A") countA += 1;
    else if (team.groupKey === "B") countB += 1;
    else return false;
  }
  return countA === groupA && countB === groupB;
}

export function defaultGroupKeyForIndex(index, teamCount) {
  const { groupA } = expectedGroupSizes(teamCount);
  return index < groupA ? "A" : "B";
}
