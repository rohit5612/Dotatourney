import "../styles/group-assignment.css";

/** @param {object[]} matches */
export function blastCompletedGroupLetters(matches) {
  /** @type {string[]} */
  const letters = [];
  const stageKeys = new Set();
  for (const match of matches || []) {
    if (/^blast-group-[a-h]$/i.test(match.stageKey || "")) stageKeys.add(match.stageKey);
  }
  for (const stageKey of stageKeys) {
    const match = String(stageKey).match(/^blast-group-([a-h])$/i);
    const letter = match ? match[1].toUpperCase() : null;
    if (!letter) continue;
    const groupMatches = (matches || []).filter((m) => m.stageKey === stageKey);
    if (groupMatches.length > 0 && groupMatches.every((m) => m.winner)) {
      letters.push(letter);
    }
  }
  return letters.sort();
}

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

/** @param {object[]} matches */
export function blastAnyGroupStageFinished(matches) {
  return blastCompletedGroupLetters(matches).length > 0;
}

/**
 * @param {Array<{ key: string, autoTeam?: string, team?: string, editable?: boolean }>} slots
 * @param {Record<string, string>} draft
 */
export function buildQualifierAssignmentPayload(slots, draft) {
  /** @type {Record<string, string>} */
  const assignments = {};
  for (const slot of slots || []) {
    if (slot.editable === false) continue;
    const value = draft[slot.key] ?? slot.team ?? slot.autoTeam ?? "";
    if (String(value).trim()) assignments[slot.key] = String(value).trim();
  }
  return assignments;
}
