import { getBlastPhaseSizes } from "./formatGenerator.js";
import { mergeBlastRemainder } from "./blastStandings.js";
import { buildGroupedStandings } from "./standingsEngine.js";

function blastGroupStageFinished(matches) {
  const ga = matches.filter((m) => m.stageKey === "blast-group-a");
  const gb = matches.filter((m) => m.stageKey === "blast-group-b");
  if (!ga.length || !gb.length) return false;
  return ga.every((m) => m.winner) && gb.every((m) => m.winner);
}

/**
 * Builds placeholder → team name map when both BLAST groups are fully decided.
 * Group winners seed Group A/B #1. For n=10 and n=12, group runners-up are reserved for the main path and are
 * excluded from the Last Chance / Play-In pool. Remainder is merged (wins, Neustadtl, group); best playInFromGroups
 * → BPI*, next lcEntrants → BLC*.
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

  const alsoEx =
    n === 10 || n === 12
      ? [gA.rows[1]?.team, gB.rows[1]?.team].filter((t) => typeof t === "string" && t.length > 0)
      : [];
  const merged = mergeBlastRemainder(gA.rows, gB.rows, winnerA, winnerB, alsoEx);
  if (merged.length !== sizes.remainder) return null;

  const bpiTeams = merged.slice(0, sizes.playInFromGroups);
  const blcTeams = merged.slice(sizes.playInFromGroups, sizes.playInFromGroups + sizes.lcEntrants);

  if (bpiTeams.length !== sizes.playInFromGroups || blcTeams.length !== sizes.lcEntrants) return null;

  for (let i = 0; i < bpiTeams.length; i += 1) {
    map[`BPI${i + 1}`] = bpiTeams[i];
  }
  for (let j = 0; j < blcTeams.length; j += 1) {
    map[`BLC${j + 1}`] = blcTeams[j];
  }

  return map;
}

/**
 * Replaces BPI/BLC and Group A/B #N placeholders with real teams after groups complete.
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
