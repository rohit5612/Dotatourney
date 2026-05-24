/**
 * Pairwise head-to-head: negative if teamA ranks above teamB.
 * @param {string} teamA
 * @param {string} teamB
 * @param {object[]} finishedMatches
 */
export function headToHeadNet(teamA, teamB, finishedMatches) {
  let aWins = 0;
  let bWins = 0;
  for (const m of finishedMatches) {
    if (!m.winner) continue;
    if (m.team1 === teamA && m.team2 === teamB) {
      if (m.winner === teamA) aWins += 1;
      else bWins += 1;
    } else if (m.team1 === teamB && m.team2 === teamA) {
      if (m.winner === teamA) aWins += 1;
      else bWins += 1;
    }
  }
  if (aWins > bWins) return -1;
  if (bWins > aWins) return 1;
  return 0;
}

/**
 * Wins within the tied pool only (mini-league among teams on equal overall wins).
 * @param {string} teamName
 * @param {string[]} tiedTeamNames
 * @param {object[]} finishedMatches
 */
export function miniLeagueWins(teamName, tiedTeamNames, finishedMatches) {
  const tied = new Set(tiedTeamNames);
  let wins = 0;
  for (const m of finishedMatches) {
    if (!m.winner) continue;
    if (!tied.has(m.team1) || !tied.has(m.team2)) continue;
    if (m.winner === teamName) wins += 1;
  }
  return wins;
}

/**
 * BLAST group tiebreak: mini-league among tied teams, direct H2H, then Neustadtl.
 * Returns negative if `a` should rank above `b` (same contract as Array.sort).
 * @param {{ team: string, wins: number, neustadtl?: number }} a
 * @param {{ team: string, wins: number, neustadtl?: number }} b
 * @param {{ team: string, wins: number }[]} entries — full group rows (same win totals bucketed)
 * @param {object[]} finishedMatches
 */
export function compareBlastGroupTiebreak(a, b, entries, finishedMatches) {
  const tied = entries.filter((e) => e.wins === a.wins).map((e) => e.team);
  if (tied.length <= 1) return 0;

  const aMini = miniLeagueWins(a.team, tied, finishedMatches);
  const bMini = miniLeagueWins(b.team, tied, finishedMatches);
  if (aMini > bMini) return -1;
  if (bMini > aMini) return 1;

  const h = headToHeadNet(a.team, b.team, finishedMatches);
  if (h !== 0) return h;

  const na = a.neustadtl ?? 0;
  const nb = b.neustadtl ?? 0;
  if (nb !== na) return nb - na;
  return 0;
}

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

/**
 * Merge full Group A and Group B standings (already sorted best-first per group)
 * into one global BO1 ranking: wins, Neustadtl, group key (A before B), tiebreak.
 * @param {object[]} rowsA
 * @param {object[]} rowsB
 * @returns {string[]} team names, best-first
 */
export function mergeBlastFullRanking(rowsA, rowsB) {
  const merged = [
    ...rowsA.map((r) => ({ ...r, groupKey: "A" })),
    ...rowsB.map((r) => ({ ...r, groupKey: "B" })),
  ];
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
