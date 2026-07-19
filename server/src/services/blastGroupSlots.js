/** @typedef {{ stageKey: string, roundIndex?: number, matchIndex?: number, seriesRuleKey?: string, blastSlot1?: string, blastSlot2?: string }} BlastGroupSlotTemplate */

/** n=12 — fixed group-rank slots (crossover roundIndex may vary; match on seriesRuleKey). */
export const BLAST_N12_GROUP_SLOT_TEMPLATES = [
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
  {
    stageKey: "blast-playin",
    seriesRuleKey: "blast-playin-cross",
    matchIndex: 0,
    blastSlot1: "Group A #2",
  },
  {
    stageKey: "blast-playin",
    seriesRuleKey: "blast-playin-cross",
    matchIndex: 1,
    blastSlot1: "Group B #2",
  },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, blastSlot1: "Group A #1" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 1, blastSlot1: "Group B #1" },
];

/** n=10 — #2 seeds enter main quarterfinals (not crossover). */
export const BLAST_N10_GROUP_SLOT_TEMPLATES = [
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #4", blastSlot2: "Group B #5" },
  { stageKey: "blast-lastchance", roundIndex: 0, matchIndex: 1, blastSlot1: "Group A #5", blastSlot2: "Group B #4" },
  { stageKey: "blast-playin", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #3", blastSlot2: "Group B #3" },
  { stageKey: "blast-playoffs", roundIndex: 0, matchIndex: 0, blastSlot1: "Group A #2" },
  { stageKey: "blast-playoffs", roundIndex: 0, matchIndex: 1, blastSlot1: "Group B #2" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, blastSlot1: "Group A #1" },
  { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 1, blastSlot1: "Group B #1" },
];

/**
 * @param {number} teamCount
 * @returns {BlastGroupSlotTemplate[]}
 */
export function blastGroupSlotTemplatesForTeamCount(teamCount) {
  if (teamCount === 12) return BLAST_N12_GROUP_SLOT_TEMPLATES;
  if (teamCount === 10) return BLAST_N10_GROUP_SLOT_TEMPLATES;
  return [];
}

/**
 * @param {object} match
 * @param {BlastGroupSlotTemplate} rule
 */
function templateMatchesMatch(match, rule) {
  if (match.stageKey !== rule.stageKey) return false;
  if (rule.seriesRuleKey != null && match.meta?.seriesRuleKey !== rule.seriesRuleKey) return false;
  if (rule.roundIndex != null && (match.roundIndex ?? 0) !== rule.roundIndex) return false;
  if (rule.matchIndex != null && (match.matchIndex ?? 0) !== rule.matchIndex) return false;
  return true;
}

/**
 * Resolve persisted `meta.blastSlot*` or legacy template for a side bracket match.
 * @param {object} match
 * @param {number} teamCount
 * @returns {{ blastSlot1?: string, blastSlot2?: string }}
 */
export function blastGroupSlotsForMatch(match, teamCount) {
  const fromMeta = {
    blastSlot1: match.meta?.blastSlot1,
    blastSlot2: match.meta?.blastSlot2,
  };
  if (fromMeta.blastSlot1 || fromMeta.blastSlot2) return fromMeta;

  for (const rule of blastGroupSlotTemplatesForTeamCount(teamCount)) {
    if (templateMatchesMatch(match, rule)) return rule;
  }
  return {};
}

/**
 * @param {string} current
 * @param {string | undefined} slotKey
 * @param {Record<string, string>} placeholderMap
 */
export function resolveBlastGroupTeam(current, slotKey, placeholderMap) {
  if (slotKey) {
    if (placeholderMap[slotKey]) return placeholderMap[slotKey];
    return slotKey;
  }
  if (current in placeholderMap) return placeholderMap[current];
  return current;
}

/** Group-rank slots may be corrected until the match has a result. */
export function blastGroupSlotResyncAllowed(match) {
  return !match.winner && match.status !== "finished";
}
