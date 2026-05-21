const GROUP_FORMATS = new Set(["blast"]);

export function formatUsesGroupAssignment(format) {
  return GROUP_FORMATS.has(format);
}

export function expectedGroupSizes(teamCount) {
  const groupA = Math.ceil(teamCount / 2);
  return { groupA, groupB: teamCount - groupA };
}

export function defaultGroupKeysForTeams(teams) {
  const { groupA } = expectedGroupSizes(teams.length);
  return teams.map((team, index) => ({
    teamId: team.id,
    groupKey: index < groupA ? "A" : "B",
  }));
}

export function validateGroupAssignment(teams) {
  if (!teams?.length) return "No teams to assign";
  const { groupA, groupB } = expectedGroupSizes(teams.length);
  const counts = { A: 0, B: 0 };
  for (const team of teams) {
    if (team.groupKey !== "A" && team.groupKey !== "B") {
      return "Every team must be assigned to Group A or Group B";
    }
    counts[team.groupKey] += 1;
  }
  if (counts.A !== groupA || counts.B !== groupB) {
    return `Group A must have ${groupA} teams and Group B must have ${groupB} teams`;
  }
  return "";
}

export function buildGroupIndices(teams) {
  const idxA = [];
  const idxB = [];
  teams.forEach((team, index) => {
    if (team.groupKey === "A") idxA.push(index);
    else if (team.groupKey === "B") idxB.push(index);
  });
  return { idxA, idxB };
}
