import { getBlastPhaseSizes } from "./formatGenerator.js";
import { mergeBlastFullRanking } from "./blastStandings.js";
import { buildGroupedStandings } from "./standingsEngine.js";

function blastGroupStageFinished(matches) {
  const ga = matches.filter((m) => m.stageKey === "blast-group-a");
  const gb = matches.filter((m) => m.stageKey === "blast-group-b");
  if (!ga.length || !gb.length) return false;
  return ga.every((m) => m.winner) && gb.every((m) => m.winner);
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
 * @returns {Record<string, string> | null}
 */
export function computeBlastPlaceholderToTeamMap(teams, matches) {
  if (!blastGroupStageFinished(matches)) return null;

  const grouped = buildGroupedStandings(teams, matches, "blast");
  const gA = grouped.find((g) => g.label === "Group A");
  const gB = grouped.find((g) => g.label === "Group B");
  if (!gA || !gB) return null;

  const n = gA.rows.length + gB.rows.length;
  const sizes = getBlastPhaseSizes(n);
  if (!sizes) return null;

  const winnerA = gA.rows[0]?.team;
  const winnerB = gB.rows[0]?.team;
  if (!winnerA || !winnerB) return null;

  /** @type {Record<string, string>} */
  const map = {};
  for (let i = 0; i < gA.rows.length; i += 1) {
    map[`Group A #${i + 1}`] = gA.rows[i].team;
  }
  for (let j = 0; j < gB.rows.length; j += 1) {
    map[`Group B #${j + 1}`] = gB.rows[j].team;
  }

  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    return map;
  }

  if (sizes.mainPlayoffPath === "tiered_merged_standings" && n === 12) {
    return map;
  }

  if (sizes.mainPlayoffPath === "tiered_merged_standings") {
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
    return map;
  }

  return null;
}

/**
 * Replaces BLAST qualifier placeholders with real teams after groups complete.
 * @param {{ name: string }[]} teams
 * @param {object[]} matches
 */
export function applyBlastGroupSeeding(teams, matches) {
  const placeholderMap = computeBlastPlaceholderToTeamMap(teams, matches);
  if (!placeholderMap) {
    return { matches, changedIds: [] };
  }

  const changedIds = new Set();
  const next = matches.map((m) => {
    const t1 = m.team1 in placeholderMap ? placeholderMap[m.team1] : m.team1;
    const t2 = m.team2 in placeholderMap ? placeholderMap[m.team2] : m.team2;
    if (t1 === m.team1 && t2 === m.team2) return m;
    changedIds.add(String(m.id));
    return { ...m, team1: t1, team2: t2 };
  });

  return { matches: next, changedIds: [...changedIds] };
}
