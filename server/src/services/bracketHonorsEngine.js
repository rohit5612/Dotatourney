/** BLAST-only bracket honors: placement badges, podium teams, champion / runner-up. */

const BLAST_GROUP_STAGES = new Set(["blast-group-a", "blast-group-b"]);

function matchDepth(match) {
  const stageKey = match?.stageKey || "";
  const round = match?.roundIndex ?? 0;

  if (BLAST_GROUP_STAGES.has(stageKey)) return 10;
  if (stageKey === "blast-lastchance") return 30 + round * 2;
  if (stageKey === "blast-playin" || stageKey === "blast-qualifiers-playin") return 50 + round * 2;
  if (stageKey === "blast-playoffs") return 70 + round * 10;
  return 0;
}

function isFinished(match) {
  return Boolean(match?.winner) || match?.status === "finished";
}

function teamInMatch(teamName, match) {
  return match?.team1 === teamName || match?.team2 === teamName;
}

function findBlastFinal(matches) {
  return (matches || []).find(
    (match) => match.stageKey === "blast-playoffs" && (match.roundIndex ?? 0) === 2 && (match.matchIndex ?? 0) === 0,
  );
}

function playoffMatches(matches, roundIndex) {
  return (matches || [])
    .filter((match) => match.stageKey === "blast-playoffs" && (match.roundIndex ?? 0) === roundIndex)
    .sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
}

function loserOf(match) {
  if (!match?.winner) return null;
  return match.winner === match.team1 ? match.team2 : match.team1;
}

function badgeFromDepth(depth, alive) {
  if (depth <= 10) return null;
  if (depth >= 90) return alive ? { kind: "in_final", label: "Grand Final" } : null;
  if (depth >= 80) return alive ? { kind: "in_semifinals", label: "Semifinals" } : { kind: "semifinalist", label: "Semifinalist" };
  if (depth >= 70) return alive ? { kind: "in_quarterfinals", label: "Quarterfinals" } : { kind: "quarterfinalist", label: "Quarterfinalist" };
  if (depth >= 50) return alive ? { kind: "in_play_in", label: "Play-In" } : { kind: "play_in", label: "Play-In" };
  if (depth >= 30) return alive ? { kind: "in_last_chance", label: "Last Chance" } : { kind: "last_chance", label: "Last Chance" };
  return null;
}

export function buildBlastPlacementTeams(matches) {
  const finalMatch = findBlastFinal(matches);
  if (!finalMatch?.winner) return [];

  /** @type {{ placement: number, role: string, teamName: string }[]} */
  const out = [];
  const seen = new Set();

  const push = (placement, role, teamName) => {
    const name = String(teamName || "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push({ placement, role, teamName: name });
  };

  push(1, "Champion", finalMatch.winner);
  push(2, "Runner-up", loserOf(finalMatch));

  for (const sf of playoffMatches(matches, 1)) {
    if (!isFinished(sf)) continue;
    push(3, "3rd Place", loserOf(sf));
  }

  let placement = 5;
  for (const qf of playoffMatches(matches, 0)) {
    if (!isFinished(qf)) continue;
    push(placement, "Top 8", loserOf(qf));
    placement += 1;
  }

  return out;
}

export function deriveTeamBracketBadge(teamName, matches) {
  const name = String(teamName || "").trim();
  if (!name) return null;

  const involved = (matches || []).filter((match) => teamInMatch(name, match));
  if (!involved.length) return null;

  const finalMatch = findBlastFinal(matches);
  if (finalMatch?.winner === name) {
    return { kind: "champion", label: "Champion", depth: 100, alive: false };
  }
  if (finalMatch?.winner && teamInMatch(name, finalMatch) && finalMatch.winner !== name) {
    return { kind: "runner_up", label: "Runner-up", depth: 95, alive: false };
  }

  // Badge reflects the last non-group series — everyone plays groups, so depth <= 10 is ignored.
  let aliveDepth = 0;
  let lastExitDepth = 0;

  for (const match of involved) {
    const depth = matchDepth(match);
    if (depth <= 10) continue;

    if (!isFinished(match)) {
      aliveDepth = Math.max(aliveDepth, depth);
      continue;
    }

    if (match.winner && match.winner !== name) {
      lastExitDepth = Math.max(lastExitDepth, depth);
    }
  }

  if (aliveDepth > 0) {
    const badge = badgeFromDepth(aliveDepth, true);
    return badge ? { ...badge, depth: aliveDepth, alive: true } : null;
  }

  if (lastExitDepth > 0) {
    const badge = badgeFromDepth(lastExitDepth, false);
    return badge ? { ...badge, depth: lastExitDepth, alive: false } : null;
  }

  return null;
}

export function buildBlastBracketHonors(matches, format) {
  if (format !== "blast") {
    return {
      supported: false,
      finalFinished: false,
      champion: null,
      runnerUp: null,
      placementTeams: [],
      badgesByTeam: {},
    };
  }

  const list = matches || [];
  const teamNames = new Set();
  for (const match of list) {
    if (match.team1) teamNames.add(match.team1);
    if (match.team2) teamNames.add(match.team2);
  }

  const finalMatch = findBlastFinal(list);
  const finalFinished = Boolean(finalMatch?.winner);
  const placementTeams = buildBlastPlacementTeams(list);

  /** @type {Record<string, object>} */
  const badgesByTeam = {};
  for (const teamName of teamNames) {
    const badge = deriveTeamBracketBadge(teamName, list);
    if (badge) badgesByTeam[teamName] = badge;
  }

  const champion = finalFinished && finalMatch?.winner ? { teamName: finalMatch.winner } : null;
  let runnerUp = null;
  if (finalFinished && finalMatch?.winner) {
    const loser = loserOf(finalMatch);
    if (loser) runnerUp = { teamName: loser };
  }

  return {
    supported: true,
    finalFinished,
    champion,
    runnerUp,
    placementTeams,
    badgesByTeam,
  };
}

export function normalizeTournamentHonors(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { displayPodiumCount: 2, mvp: null, customCards: [] };
  }

  const displayPodiumCount = Math.max(1, Math.min(12, Number(raw.displayPodiumCount) || 2));
  const mvpRaw = raw.mvp && typeof raw.mvp === "object" ? raw.mvp : null;
  const mvp =
    mvpRaw && (mvpRaw.teamName || mvpRaw.playerName || mvpRaw.playerId || mvpRaw.prize)
      ? {
          prize: String(mvpRaw.prize || "").trim(),
          teamName: String(mvpRaw.teamName || "").trim(),
          playerId: String(mvpRaw.playerId || "").trim(),
          playerName: String(mvpRaw.playerName || "").trim(),
          notes: String(mvpRaw.notes || "").trim(),
        }
      : null;

  const cards = Array.isArray(raw.customCards) ? raw.customCards : [];
  return {
    displayPodiumCount,
    mvp,
    customCards: cards
      .map((card, index) => ({
        id: String(card?.id || `card-${index}`),
        title: String(card?.title || card?.label || "").trim(),
        prize: String(card?.prize || "").trim(),
        winnerLabel: String(card?.winnerLabel || card?.winner || "").trim(),
        teamName: String(card?.teamName || "").trim(),
        playerName: String(card?.playerName || "").trim(),
        notes: String(card?.notes || "").trim(),
        sortOrder: Number.isFinite(Number(card?.sortOrder)) ? Number(card.sortOrder) : index,
      }))
      .filter((card) => card.title || card.prize || card.winnerLabel || card.teamName || card.playerName)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function buildPublicHonorsPayload(matches, format, tournamentHonors) {
  const derived = buildBlastBracketHonors(matches, format);
  const settings = normalizeTournamentHonors(tournamentHonors);
  const maxPodium = derived.placementTeams?.length || 0;
  const displayPodiumCount = maxPodium ? Math.min(settings.displayPodiumCount, maxPodium) : settings.displayPodiumCount;
  const podiumTeams = (derived.placementTeams || []).slice(0, displayPodiumCount);

  return {
    ...derived,
    displayPodiumCount,
    maxPodiumPlacements: maxPodium,
    podiumTeams,
    mvp: settings.mvp,
    customCards: settings.customCards,
  };
}
