import { compareBlastGroupTiebreak, mergeBlastFullRanking, neustadtlScore } from "./blastStandings.js";
import { getBlastPhaseSizes } from "./formatGenerator.js";

function blastGroupKeyFromStageKey(stageKey) {
  const match = String(stageKey || "").match(/^blast-group-([a-h])$/i);
  return match ? match[1].toUpperCase() : null;
}

/** Display / standings bucket for a league match (Group A–H when BLAST). */
export function blastGroupLabelFromMatch(match) {
  const gk = match.meta?.groupKey;
  if (gk && /^[A-H]$/i.test(String(gk))) return `Group ${String(gk).toUpperCase()}`;
  const fromStage = blastGroupKeyFromStageKey(match.stageKey);
  if (fromStage) return `Group ${fromStage}`;
  return match.stageKey;
}

export function isBlastGroupMatch(match) {
  return Boolean(blastGroupKeyFromStageKey(match?.stageKey));
}

export function blastGroupMatches(matches) {
  return (matches || []).filter(isBlastGroupMatch);
}

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

/**
 * n=10 and n=12 BLAST brackets seed from in-group rank (`Group A/B #n`) only.
 * Merged global standings would conflict with bracket slots — skip for those sizes.
 * @param {number} teamCount
 */
export function blastBracketUsesGroupRanksOnly(teamCount) {
  const sizes = getBlastPhaseSizes(teamCount);
  if (!sizes) return false;
  if (sizes.mainPlayoffPath === "ten_qf_seconds") return true;
  if (sizes.mainPlayoffPath === "tiered_merged_standings" && teamCount === 12) return true;
  return false;
}

export function buildStandings(teams, matches, format, options = {}) {
  const blastGroupStandings = format === "blast" && options.blastGroupStandings === true;

  if (format === "blast" && !blastGroupStandings) {
    const grouped = buildGroupedStandings(teams, matches, format);
    const gA = grouped.find((group) => group.label === "Group A");
    const gB = grouped.find((group) => group.label === "Group B");
    const teamCount = (gA?.rows?.length || 0) + (gB?.rows?.length || 0);
    if (blastBracketUsesGroupRanksOnly(teamCount)) {
      return [];
    }
    if (gA?.rows?.length && gB?.rows?.length) {
      const order = mergeBlastFullRanking(gA.rows, gB.rows);
      const rowByTeam = new Map([...gA.rows, ...gB.rows].map((row) => [row.team, row]));
      return order.map((teamName) => ({
        ...rowByTeam.get(teamName),
        status: "in_progress",
      }));
    }
    matches = blastGroupMatches(matches);
  }

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
      const tb = compareBlastGroupTiebreak(a, b, entries, finishedGroupMatches);
      if (tb !== 0) return tb;
    }
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.tiebreakScore - a.tiebreakScore;
  });

  if (format === "blast") {
    if (blastGroupStandings) {
      const groupSize = entries.length;
      entries.forEach((entry, index) => {
        if (groupSize === 6) {
          if (index === 0) entry.status = "advancing";
          else if (index === 1) entry.status = "play_in_cross";
          else if (index <= 3) entry.status = "play_in_middle";
          else entry.status = "last_chance";
        } else if (groupSize === 5) {
          if (index === 0) entry.status = "advancing";
          else if (index === 1) entry.status = "playoff_qf";
          else if (index === 2) entry.status = "play_in";
          else entry.status = "last_chance";
        } else {
          entry.status = index < 2 ? "advancing" : "in_progress";
        }
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
  const leagueStages = new Set(["league", "group-stage", "swiss"]);

  matches
    .filter((match) => {
      const stageKey = match.stageKey || "";
      return (
        leagueStages.has(stageKey) ||
        /^blast-group-[a-h]$/i.test(stageKey) ||
        /^group-[a-h]$/i.test(stageKey) ||
        match.meta?.groupKey
      );
    })
    .forEach((match) => {
      const key = blastGroupLabelFromMatch(match);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(match);
    });

  return Object.entries(grouped).map(([label, groupMatches]) => {
    const rosterForGroup =
      format === "blast" && /^Group [A-H]$/.test(label)
        ? teamsParticipatingInGroupMatches(teams, groupMatches)
        : teams;
    const rows = buildStandings(rosterForGroup, groupMatches, format, {
      blastGroupStandings: format === "blast" && /^Group [A-H]$/.test(label),
    });
    return {
      id: label.toLowerCase().replaceAll(" ", "-"),
      label,
      rows,
    };
  });
}
