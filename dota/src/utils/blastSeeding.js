const GROUP_PLACEHOLDER = /^Group [AB] #\d+$/;

function findBlastGroup(groupedStandings, which) {
  const letter = which.toUpperCase();
  const lower = letter.toLowerCase();
  return (groupedStandings || []).find(
    (g) =>
      g.label === `Group ${letter}` ||
      g.id === `group-${lower}` ||
      g.label === `blast-group-${lower}`,
  );
}

function isGroupTableComplete(rows) {
  if (!rows?.length) return false;
  const expected = rows.length - 1;
  return rows.every((row) => row.played >= expected);
}

/**
 * Build Group A/B #n → team name map when both BO1 groups are fully decided.
 * Mirrors server `computeBlastPlaceholderToTeamMap` for n=10 / n=12 (group-rank placeholders).
 * @param {object[]} groupedStandings
 * @param {string} [format]
 * @returns {Record<string, string> | null}
 */
export function computeBlastPlaceholderMap(groupedStandings, format) {
  if (format !== "blast") return null;
  const gA = findBlastGroup(groupedStandings, "A");
  const gB = findBlastGroup(groupedStandings, "B");
  if (!gA?.rows?.length || !gB?.rows?.length) return null;
  if (!isGroupTableComplete(gA.rows) || !isGroupTableComplete(gB.rows)) return null;

  /** @type {Record<string, string>} */
  const map = {};
  gA.rows.forEach((row, index) => {
    map[`Group A #${index + 1}`] = row.team;
  });
  gB.rows.forEach((row, index) => {
    map[`Group B #${index + 1}`] = row.team;
  });
  return map;
}

/**
 * Replace BLAST group-rank placeholders in match slots for bracket display.
 * @param {object[]} matches
 * @param {Record<string, string> | null} placeholderMap
 * @returns {object[]}
 */
export function applyBlastPlaceholderMap(matches, placeholderMap) {
  if (!placeholderMap || !matches?.length) return matches || [];
  return matches.map((match) => {
    const team1 = placeholderMap[match.team1] ?? match.team1;
    const team2 = placeholderMap[match.team2] ?? match.team2;
    if (team1 === match.team1 && team2 === match.team2) return match;
    return { ...match, team1, team2 };
  });
}

/**
 * Resolve qualifier / playoff placeholders from live group standings (display-only safe).
 * @param {object[]} matches
 * @param {object[]} groupedStandings
 * @param {string} [format]
 * @returns {object[]}
 */
export function resolveBlastBracketMatches(matches, groupedStandings, format) {
  const map = computeBlastPlaceholderMap(groupedStandings, format);
  return applyBlastPlaceholderMap(matches, map);
}

export function isBlastGroupPlaceholder(name) {
  return GROUP_PLACEHOLDER.test(String(name || "").trim());
}
