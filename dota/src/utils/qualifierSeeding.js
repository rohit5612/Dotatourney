import "../styles/group-assignment.css";

/** @param {object[]} matches */
export function blastGroupStageFinished(matches) {
  const keys = new Set();
  for (const match of matches || []) {
    if (/^blast-group-[a-h]$/i.test(match.stageKey || "")) keys.add(match.stageKey);
  }
  if (!keys.size) return false;
  return [...keys].every((stageKey) => {
    const groupMatches = (matches || []).filter((m) => m.stageKey === stageKey);
    return groupMatches.length > 0 && groupMatches.every((m) => m.winner);
  });
}

/**
 * @param {Array<{ key: string, autoTeam?: string, team?: string }>} slots
 * @param {Record<string, string>} draft
 */
export function buildQualifierAssignmentPayload(slots, draft) {
  /** @type {Record<string, string>} */
  const assignments = {};
  for (const slot of slots || []) {
    const value = draft[slot.key] ?? slot.team ?? slot.autoTeam ?? "";
    if (String(value).trim()) assignments[slot.key] = String(value).trim();
  }
  return assignments;
}
