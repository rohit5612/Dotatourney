/**
 * Neustadtl: sum of (wins of opponents defeated by this team) in the same group.
 * @param {string} teamName
 * @param {object[]} finishedMatches — blast-group matches with winner set
 * @param {Record<string, number>} winsByTeam
 */
export function neustadtlScore(teamName, finishedMatches, winsByTeam) {
  let sum = 0;
  for (const m of finishedMatches) {
    if (!m.winner || m.winner !== teamName) continue;
    const opp = m.team1 === teamName ? m.team2 : m.team1;
    sum += winsByTeam[opp] ?? 0;
  }
  return sum;
}

/**
 * Merge Group A and Group B rows (each already sorted best-first) excluding each group's #1.
 * Cross-group: wins, Neustadtl, then group key (A before B), then tiebreak.
 * @param {object[]} rowsA
 * @param {object[]} rowsB
 * @param {string} winnerAName
 * @param {string} winnerBName
 * @param {string[]} [alsoExcludeNames] — e.g. group runners-up when they skip the side pool (BLAST n=10 / 12).
 * @returns {string[]} team names, best-first among non-excluded teams
 */
export function mergeBlastRemainder(rowsA, rowsB, winnerAName, winnerBName, alsoExcludeNames = []) {
  const ex = new Set([winnerAName, winnerBName, ...alsoExcludeNames]);
  const restA = rowsA.filter((r) => !ex.has(r.team)).map((r) => ({ ...r, groupKey: "A" }));
  const restB = rowsB.filter((r) => !ex.has(r.team)).map((r) => ({ ...r, groupKey: "B" }));
  const merged = [...restA, ...restB];
  merged.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const na = a.neustadtl ?? 0;
    const nb = b.neustadtl ?? 0;
    if (nb !== na) return nb - na;
    if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
    return (b.tiebreakScore ?? 0) - (a.tiebreakScore ?? 0);
  });
  return merged.map((r) => r.team);
}
