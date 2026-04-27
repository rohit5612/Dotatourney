function ensureStats(statMap, name) {
  if (!statMap[name]) {
    statMap[name] = {
      team: name,
      wins: 0,
      losses: 0,
      played: 0,
      winPct: 0,
      status: "in_progress",
      tiebreakScore: 0,
    };
  }
}

export function buildStandings(teams, matches, format) {
  const stats = {};
  teams.forEach((team) => ensureStats(stats, team.name));

  matches.forEach((match) => {
    if (!match.winner) {
      return;
    }

    const loser = match.winner === match.team1 ? match.team2 : match.team1;
    ensureStats(stats, match.winner);
    ensureStats(stats, loser);

    stats[match.winner].wins += 1;
    stats[match.winner].played += 1;
    stats[loser].losses += 1;
    stats[loser].played += 1;
  });

  const entries = Object.values(stats).map((entry) => {
    const winPct = entry.played ? entry.wins / entry.played : 0;
    const tiebreakScore = entry.wins * 100 - entry.losses * 10;
    return {
      ...entry,
      winPct,
      tiebreakScore,
    };
  });

  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.tiebreakScore - a.tiebreakScore;
  });

  const cutoff = format === "rr" ? 4 : Math.ceil(entries.length / 2);
  entries.forEach((entry, index) => {
    if (index < cutoff) entry.status = "advancing";
    if (entry.losses >= 3 && format !== "se") entry.status = "eliminated";
    if (format === "se" || format === "dse" || format === "hybrid") {
      entry.status = entry.losses > 0 ? "in_progress" : "advancing";
    }
  });

  return entries;
}

export function buildGroupedStandings(teams, matches, format) {
  const grouped = {};
  const leagueStages = new Set(["league", "group-stage", "group-a", "group-b", "swiss"]);

  matches
    .filter((match) => leagueStages.has(match.stageKey) || match.meta?.groupKey)
    .forEach((match) => {
      const key = match.meta?.groupKey ? `Group ${match.meta.groupKey}` : match.stageKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(match);
    });

  return Object.entries(grouped).map(([label, groupMatches]) => ({
    id: label.toLowerCase().replaceAll(" ", "-"),
    label,
    rows: buildStandings(teams, groupMatches, format),
  }));
}
