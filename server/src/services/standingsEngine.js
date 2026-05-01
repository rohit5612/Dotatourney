import { neustadtlScore } from "./blastStandings.js";

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

/** Sort helper: negative if a should rank above b (BO1 group head-to-head). */
function headToHeadNet(teamA, teamB, finishedMatches) {
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

export function buildStandings(teams, matches, format, options = {}) {
  const blastGroupStandings = format === "blast" && options.blastGroupStandings === true;
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

  const finishedGroupMatches = matches.filter((m) => m.winner);

  if (blastGroupStandings) {
    const winsByTeam = {};
    entries.forEach((e) => {
      winsByTeam[e.team] = e.wins;
    });
    entries.forEach((e) => {
      e.neustadtl = neustadtlScore(e.team, finishedGroupMatches, winsByTeam);
    });
  }

  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (blastGroupStandings) {
      const h = headToHeadNet(a.team, b.team, finishedGroupMatches);
      if (h !== 0) return h;
      if ((b.neustadtl ?? 0) !== (a.neustadtl ?? 0)) return (b.neustadtl ?? 0) - (a.neustadtl ?? 0);
    }
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.tiebreakScore - a.tiebreakScore;
  });

  if (format === "blast") {
    if (blastGroupStandings) {
      entries.forEach((entry, index) => {
        entry.status = index < 2 ? "advancing" : "in_progress";
      });
    } else {
      entries.forEach((entry) => {
        entry.status = "in_progress";
      });
    }
    return entries;
  }

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

function teamsParticipatingInGroupMatches(teams, groupMatches) {
  const names = new Set();
  for (const m of groupMatches) {
    names.add(m.team1);
    names.add(m.team2);
  }
  return teams.filter((t) => names.has(t.name));
}

export function buildGroupedStandings(teams, matches, format) {
  const grouped = {};
  const leagueStages = new Set(["league", "group-stage", "group-a", "group-b", "swiss", "blast-group-a", "blast-group-b"]);

  matches
    .filter((match) => leagueStages.has(match.stageKey) || match.meta?.groupKey)
    .forEach((match) => {
      const key = match.meta?.groupKey ? `Group ${match.meta.groupKey}` : match.stageKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(match);
    });

  return Object.entries(grouped).map(([label, groupMatches]) => {
    const rosterForGroup =
      format === "blast" && /^Group [AB]$/.test(label) ? teamsParticipatingInGroupMatches(teams, groupMatches) : teams;
    const rows = buildStandings(rosterForGroup, groupMatches, format, {
      blastGroupStandings: format === "blast" && /^Group [AB]$/.test(label),
    });
    return {
      id: label.toLowerCase().replaceAll(" ", "-"),
      label,
      rows,
    };
  });
}
