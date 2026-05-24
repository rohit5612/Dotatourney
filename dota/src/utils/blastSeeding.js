const GROUP_PLACEHOLDER = /^Group [AB] #\d+$/;

/** Mirrors server `blastGroupSlots.js` for display-time resync. */
const BLAST_N12_GROUP_SLOT_TEMPLATES = [
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #5", blastSlot2: "Group B #6" },
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 1, blastSlot1: "Group A #6", blastSlot2: "Group B #5" },
  {
    stageKey: "blast-playin",
    roundIndex: 0,
    matchIndex: 0,
    seriesRuleKey: "blast-mp-semifinal",
    blastSlot1: "Group A #3",
    blastSlot2: "Group B #4",
  },
  {
    stageKey: "blast-playin",
    roundIndex: 0,
    matchIndex: 1,
    seriesRuleKey: "blast-mp-semifinal",
    blastSlot1: "Group B #3",
    blastSlot2: "Group A #4",
  },
  { stageKey: "blast-playin", seriesRuleKey: "blast-playin-cross", matchIndex: 0, blastSlot1: "Group A #2" },
  { stageKey: "blast-playin", seriesRuleKey: "blast-playin-cross", matchIndex: 1, blastSlot1: "Group B #2" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, blastSlot1: "Group A #1" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 1, blastSlot1: "Group B #1" },
];

const BLAST_N10_GROUP_SLOT_TEMPLATES = [
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #4", blastSlot2: "Group B #5" },
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 1, blastSlot1: "Group A #5", blastSlot2: "Group B #4" },
  { stageKey: "blast-playin", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #3", blastSlot2: "Group B #3" },
  { stageKey: "blast-playoffs", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #2" },
  { stageKey: "blast-playoffs", roundIndex: 0, matchIndex: 1, blastSlot1: "Group B #2" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, blastSlot1: "Group A #1" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 1, blastSlot1: "Group B #1" },
];

function blastGroupSlotTemplatesForTeamCount(teamCount) {
  if (teamCount === 12) return BLAST_N12_GROUP_SLOT_TEMPLATES;
  if (teamCount === 10) return BLAST_N10_GROUP_SLOT_TEMPLATES;
  return [];
}

function templateMatchesMatch(match, rule) {
  if (match.stageKey !== rule.stageKey) return false;
  if (rule.seriesRuleKey != null && match.meta?.seriesRuleKey !== rule.seriesRuleKey) return false;
  if (rule.roundIndex != null && (match.roundIndex ?? 0) !== rule.roundIndex) return false;
  if (rule.matchIndex != null && (match.matchIndex ?? 0) !== rule.matchIndex) return false;
  return true;
}

function blastGroupSlotsForMatch(match, teamCount) {
  const fromMeta = { blastSlot1: match.meta?.blastSlot1, blastSlot2: match.meta?.blastSlot2 };
  if (fromMeta.blastSlot1 || fromMeta.blastSlot2) return fromMeta;
  for (const rule of blastGroupSlotTemplatesForTeamCount(teamCount)) {
    if (templateMatchesMatch(match, rule)) return rule;
  }
  return {};
}

function resolveBlastGroupTeam(current, slotKey, placeholderMap) {
  if (slotKey && placeholderMap[slotKey]) return placeholderMap[slotKey];
  if (current in placeholderMap) return placeholderMap[current];
  return current;
}

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

export function applyBlastPlaceholderMap(matches, placeholderMap, groupedStandings) {
  if (!placeholderMap || !matches?.length) return matches || [];

  const gA = findBlastGroup(groupedStandings, "A");
  const gB = findBlastGroup(groupedStandings, "B");
  const teamCount = (gA?.rows?.length || 0) + (gB?.rows?.length || 0);

  return matches.map((match) => {
    const slots = blastGroupSlotsForMatch(match, teamCount);
    const canResync = !match.winner && match.status !== "finished";
    const team1 = canResync
      ? resolveBlastGroupTeam(match.team1, slots.blastSlot1, placeholderMap)
      : resolveBlastGroupTeam(match.team1, undefined, placeholderMap);
    const team2 = canResync
      ? resolveBlastGroupTeam(match.team2, slots.blastSlot2, placeholderMap)
      : resolveBlastGroupTeam(match.team2, undefined, placeholderMap);
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
  return applyBlastPlaceholderMap(matches, map, groupedStandings);
}

export function isBlastGroupPlaceholder(name) {
  return GROUP_PLACEHOLDER.test(String(name || "").trim());
}
