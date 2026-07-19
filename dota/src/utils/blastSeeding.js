import { groupLabelSortRank, parseGroupLetterFromLabel } from "./teamPage.js";

const GROUP_PLACEHOLDER = /^Group [A-H] #\d+$/i;

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
 * Build Group A–H #n → team name map when all BO1 groups are fully decided.
 * @param {object[]} groupedStandings
 * @param {string} [format]
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string> | null}
 */
export function computeBlastPlaceholderMap(groupedStandings, format, overrides = null) {
  if (format !== "blast") return null;
  const groups = [...(groupedStandings || [])]
    .filter((group) => parseGroupLetterFromLabel(group.label))
    .sort((a, b) => groupLabelSortRank(a.label) - groupLabelSortRank(b.label));
  if (!groups.length) return null;
  if (!groups.every((group) => isGroupTableComplete(group.rows))) return null;

  /** @type {Record<string, string>} */
  const map = {};
  for (const group of groups) {
    const letter = parseGroupLetterFromLabel(group.label);
    group.rows.forEach((row, index) => {
      map[`Group ${letter} #${index + 1}`] = row.team;
    });
  }
  if (!overrides || !Object.keys(overrides).length) return map;
  return { ...map, ...overrides };
}

export function applyBlastPlaceholderMap(matches, placeholderMap, groupedStandings) {
  if (!placeholderMap || !matches?.length) return matches || [];

  const teamCount = (groupedStandings || []).reduce((sum, group) => sum + (group.rows?.length || 0), 0);

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
 * @param {Record<string, string> | { qualifierSeedingOverrides?: Record<string, string> } | null} [overridesOrEngineConfig]
 * @returns {object[]}
 */
export function resolveBlastBracketMatches(matches, groupedStandings, format, overridesOrEngineConfig = null) {
  const overrides =
    overridesOrEngineConfig?.qualifierSeedingOverrides && typeof overridesOrEngineConfig.qualifierSeedingOverrides === "object"
      ? overridesOrEngineConfig.qualifierSeedingOverrides
      : overridesOrEngineConfig || null;
  const baseMap = computeBlastPlaceholderMap(groupedStandings, format, null) || {};
  const mergedOverrides =
    overrides && typeof overrides === "object"
      ? Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, String(value || "").trim()]).filter(([, value]) => value))
      : {};
  const map =
    Object.keys(baseMap).length || Object.keys(mergedOverrides).length
      ? { ...baseMap, ...mergedOverrides }
      : null;
  return applyBlastPlaceholderMap(matches, map, groupedStandings);
}

export function isBlastGroupPlaceholder(name) {
  return GROUP_PLACEHOLDER.test(String(name || "").trim());
}
