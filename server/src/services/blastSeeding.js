import { getBlastPhaseSizes } from "./formatGenerator.js";
import { mergeBlastFullRanking } from "./blastStandings.js";
import {
  blastGroupSlotResyncAllowed,
  blastGroupSlotsForMatch,
  resolveBlastGroupTeam,
} from "./blastGroupSlots.js";
import { mergeQualifierSeedingOverrides } from "./blastQualifierSeeding.js";
import { buildGroupedStandings } from "./standingsEngine.js";

export function blastGroupStageKeys(matches) {
  const keys = new Set();
  for (const match of matches || []) {
    if (/^blast-group-[a-h]$/i.test(match.stageKey || "")) keys.add(match.stageKey);
  }
  return [...keys];
}

export function blastGroupStageFinished(matches) {
  const stageKeys = blastGroupStageKeys(matches);
  if (!stageKeys.length) return false;
  return stageKeys.every((stageKey) => {
    const groupMatches = matches.filter((m) => m.stageKey === stageKey);
    return groupMatches.length > 0 && groupMatches.every((m) => m.winner);
  });
}

/**
 * Builds placeholder → team name map when both BLAST groups are fully decided.
 *
 * - **n=10**: Group A/B standings fill `Group A #n` / `Group B #n` only.
 * - **n=12**: Same group labels for all six ranks; no separate BLR/MID/BLC keys.
 * - **n≥11 (not 12) tiered**: merged global standings → BLR1–4*, MID*, BLC*.
 *
 * Group A/B #N always mirror in-group standings (for display).
 * @param {{ name: string }[]} teams
 * @param {object[]} matches
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string> | null}
 */
export function computeBlastPlaceholderToTeamMap(teams, matches, overrides = null) {
  if (!blastGroupStageFinished(matches)) return null;

  const grouped = buildGroupedStandings(teams, matches, "blast");
  if (!grouped.length) return null;

  const gA = grouped.find((g) => g.label === "Group A");
  const gB = grouped.find((g) => g.label === "Group B");
  const n = grouped.reduce((sum, group) => sum + (group.rows?.length || 0), 0);
  const sizes = getBlastPhaseSizes(n);
  if (!sizes) return null;

  /** @type {Record<string, string>} */
  const map = {};
  for (const group of grouped) {
    const labelMatch = group.label.match(/^Group ([A-H])$/);
    if (!labelMatch) continue;
    const key = labelMatch[1];
    for (let i = 0; i < group.rows.length; i += 1) {
      map[`Group ${key} #${i + 1}`] = group.rows[i].team;
    }
  }

  if (!gA || !gB) return mergeQualifierSeedingOverrides(map, overrides);

  const winnerA = gA.rows[0]?.team;
  const winnerB = gB.rows[0]?.team;
  if (!winnerA || !winnerB) return mergeQualifierSeedingOverrides(map, overrides);

  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    return mergeQualifierSeedingOverrides(map, overrides);
  }

  if (sizes.mainPlayoffPath === "tiered_merged_standings" && n === 12) {
    return mergeQualifierSeedingOverrides(map, overrides);
  }

  if (sizes.mainPlayoffPath === "tiered_merged_standings" && grouped.length === 2) {
    const fullRank = mergeBlastFullRanking(gA.rows, gB.rows);
    if (fullRank.length !== n) return null;
    const lc = sizes.lcEntrants;
    const mid = sizes.middleBracketEntrants ?? 0;

    map.BLR1 = fullRank[0];
    map.BLR2 = fullRank[1];
    map.BLR3 = fullRank[2];
    map.BLR4 = fullRank[3];
    for (let i = 0; i < mid; i += 1) {
      map[`MID${i + 1}`] = fullRank[4 + i];
    }
    const lcStart = n - lc;
    for (let j = 0; j < lc; j += 1) {
      map[`BLC${j + 1}`] = fullRank[lcStart + j];
    }
    return mergeQualifierSeedingOverrides(map, overrides);
  }

  return mergeQualifierSeedingOverrides(map, overrides);
}

/**
 * Replaces BLAST qualifier placeholders with real teams after groups complete.
 * @param {{ name: string }[]} teams
 * @param {object[]} matches
 * @param {Record<string, string>} [overrides]
 */
export function applyBlastGroupSeeding(teams, matches, overrides = null) {
  const placeholderMap = computeBlastPlaceholderToTeamMap(teams, matches, overrides);
  if (!placeholderMap) {
    return { matches, changedIds: [] };
  }

  const grouped = buildGroupedStandings(teams, matches, "blast");
  const gA = grouped.find((g) => g.label === "Group A");
  const gB = grouped.find((g) => g.label === "Group B");
  const teamCount = (gA?.rows?.length || 0) + (gB?.rows?.length || 0);

  const changedIds = new Set();
  const next = matches.map((m) => {
    const slots = blastGroupSlotsForMatch(m, teamCount);
    const hasGroupSlot = slots.blastSlot1 || slots.blastSlot2 || m.team1 in placeholderMap || m.team2 in placeholderMap;
    if (!hasGroupSlot) return m;

    const canResync = blastGroupSlotResyncAllowed(m);
    const t1 = canResync
      ? resolveBlastGroupTeam(m.team1, slots.blastSlot1, placeholderMap)
      : resolveBlastGroupTeam(m.team1, undefined, placeholderMap);
    const t2 = canResync
      ? resolveBlastGroupTeam(m.team2, slots.blastSlot2, placeholderMap)
      : resolveBlastGroupTeam(m.team2, undefined, placeholderMap);

    const meta = { ...(m.meta || {}) };
    if (slots.blastSlot1) meta.blastSlot1 = slots.blastSlot1;
    if (slots.blastSlot2) meta.blastSlot2 = slots.blastSlot2;

    if (t1 === m.team1 && t2 === m.team2 && meta.blastSlot1 === m.meta?.blastSlot1 && meta.blastSlot2 === m.meta?.blastSlot2) {
      return m;
    }
    changedIds.add(String(m.id));
    return { ...m, team1: t1, team2: t2, meta };
  });

  return { matches: next, changedIds: [...changedIds] };
}

/**
 * When both BO1 groups are finished, replace `Group A/B #n` placeholders in existing
 * matches (Last chance, Play-In, playoffs) — no bracket regeneration required.
 * @param {string} tournamentId
 * @param {{ name: string }[]} teams
 * @param {object[]} matches
 * @param {(tournamentId: string, matchId: string, row: object) => Promise<unknown>} updateMatch
 * @param {Record<string, string>} [overrides]
 * @returns {Promise<{ matches: object[]; changed: boolean }>}
 */
export async function persistBlastGroupSeedingIfReady(tournamentId, teams, matches, updateMatch, overrides = null) {
  const { matches: seeded, changedIds } = applyBlastGroupSeeding(teams, matches, overrides);
  if (!changedIds.length) return { matches, changed: false };

  for (const matchId of changedIds) {
    const row = seeded.find((m) => String(m.id) === matchId);
    if (row) {
      await updateMatch(tournamentId, matchId, row);
    }
  }
  return { matches: seeded, changed: true };
}
