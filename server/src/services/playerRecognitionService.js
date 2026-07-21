import { pool } from "../db/pool.js";
import { buildPublicHonorsPayload } from "./bracketHonorsEngine.js";
import { formatPublicMatchStageLabel } from "../utils/matchStageLabel.js";
import {
  buildTeamsWithActivePlayers,
  countPlayedMatchesForStint,
  loadAllMembershipStintsForAccount,
} from "./rosterMembershipService.js";
import { getApprovedRosterSnapshot } from "./tournamentRepository.js";

export function stageLabelFromPlacement(placement) {
  if (placement === 1 || placement === 2) return "Grand Final";
  if (placement === 3) return "Semifinals";
  if (placement === 4) return "Semifinals";
  if (placement >= 5 && placement <= 8) return "Playoffs";
  return "Group Stage";
}

function formatStageLabel(match) {
  return formatPublicMatchStageLabel(match);
}

function parseMatchMeta(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

function isMatchCompleted(status, scheduleStatus, winner) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "done" || s === "finished") return true;
  if (String(scheduleStatus || "").toLowerCase() === "finished") return true;
  return Boolean(winner && String(winner).trim());
}

function rosterPlayerAccountId(player) {
  return player?.playerAccountId || player?.player_account_id || null;
}

function rosterPlayerLabel(player) {
  return String(player?.displayName || player?.display_name || player?.name || "").trim();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadConcludedSeasonHonors() {
  const { rows } = await pool.query(
    `SELECT s.number AS season_number, s.slug AS season_slug, s.name AS season_name,
            t.id AS tournament_id, t.tournament_honors, t.format, t.season_card_badge
     FROM seasons s
     JOIN tournaments t ON t.id = s.tournament_id
     WHERE s.status = 'concluded'
     ORDER BY s.number ASC`,
  );
  return rows;
}

function seasonBadgePrefix(season) {
  const badge = String(season.season_card_badge || "").trim();
  return badge || `S${season.season_number}`;
}

function resolveChampionTeamName(honors) {
  return String(
    honors.podiumTeams?.find((entry) => entry.placement === 1)?.teamName ||
      honors.placementTeams?.find((entry) => entry.placement === 1)?.teamName ||
      honors.champion?.teamName ||
      "",
  ).trim();
}

/** All rostered players on a team (baseline snapshot links, not only active memberships). */
function championTeamPlayers(approvedRoster, championTeamName) {
  if (!approvedRoster?.teams?.length || !championTeamName) return [];

  const team = approvedRoster.teams.find(
    (entry) => normalizeName(entry.name) === normalizeName(championTeamName),
  );
  if (!team) return [];

  const linkedPlayerIds = new Set(
    (approvedRoster.teamPlayers || [])
      .filter((record) => record.team_id === team.id)
      .map((record) => record.player_id),
  );

  return (approvedRoster.players || []).filter((player) => linkedPlayerIds.has(player.id));
}

function rosterPlayersMatchingMvp(teams, mvp) {
  if (!mvp) return [];

  const honorTeam = normalizeName(mvp.teamName);
  const honorPlayer = normalizeName(mvp.playerName);
  const honorPlayerId = mvp.playerId ? String(mvp.playerId).trim() : "";
  if (!honorPlayerId && !honorPlayer) return [];

  const matches = [];
  for (const team of teams || []) {
    if (honorTeam && normalizeName(team.name) !== honorTeam) continue;

    for (const player of team.players || []) {
      const accountId = rosterPlayerAccountId(player);
      const label = normalizeName(rosterPlayerLabel(player));
      const snapshotId = player.id ? String(player.id) : "";
      const bySnapshot = honorPlayerId && snapshotId === honorPlayerId;
      const byAccount = honorPlayerId && accountId && String(accountId) === honorPlayerId;
      const byName = honorPlayer && label === honorPlayer;

      if (bySnapshot || byAccount || byName) {
        matches.push({ player, teamName: team.name });
      }
    }
  }
  return matches;
}

function rosterPlayersMatchingHonor(teams, honor) {
  const matches = [];
  const honorTeam = normalizeName(honor?.teamName);
  const honorPlayer = normalizeName(honor?.playerName);
  const honorPlayerId = honor?.playerId ? String(honor.playerId).trim() : "";
  const honorWinner = normalizeName(honor?.winnerLabel);

  if (!honorPlayerId && !honorPlayer && !honorWinner) return [];

  for (const team of teams || []) {
    const teamName = normalizeName(team.name);
    if (honorTeam && teamName !== honorTeam) continue;

    for (const player of team.players || []) {
      const accountId = rosterPlayerAccountId(player);
      const label = normalizeName(rosterPlayerLabel(player));
      const matchesId = honorPlayerId && String(player.id) === honorPlayerId;
      const matchesAccount = honorPlayerId && accountId && String(accountId) === honorPlayerId;
      const matchesName = honorPlayer && label === honorPlayer;
      const matchesWinner = honorWinner && honorWinner === label;

      if (matchesId || matchesAccount || matchesName || matchesWinner) {
        matches.push({ player, teamName: team.name });
      }
    }
  }
  return matches;
}

function sortRecognitions(list) {
  return [...list].sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
    if (a.kind === b.kind) return a.label.localeCompare(b.label);
    if (a.kind === "mvp") return -1;
    if (b.kind === "mvp") return 1;
    return a.label.localeCompare(b.label);
  });
}

function appendRecognition(index, accountId, recognition) {
  if (!accountId) return;
  const key = String(accountId);
  const bucket = index.get(key) || [];
  if (bucket.some((entry) => entry.id === recognition.id)) return;
  bucket.push(recognition);
  index.set(key, bucket);
}

/** Map player account id → season honor badges (S1•MVP, S1•Champion, …). */
export async function buildGlobalRecognitionIndex() {
  const index = new Map();
  const seasons = await loadConcludedSeasonHonors();

  for (const season of seasons) {
    const prefix = seasonBadgePrefix(season);
    const seasonTitle = season.season_name || `Season ${season.season_number}`;
    const honorsRaw = season.tournament_honors || {};
    const { rows: matchRows } = await pool.query(
      `SELECT * FROM matches WHERE tournament_id = $1`,
      [season.tournament_id],
    );
    const honors = buildPublicHonorsPayload(matchRows, season.format, honorsRaw);
    const approvedRoster = await getApprovedRosterSnapshot(season.tournament_id);
    const teams = buildTeamsWithActivePlayers(approvedRoster);

    const mvp = honors.mvp;
    if (mvp) {
      for (const { player } of rosterPlayersMatchingMvp(teams, mvp)) {
        appendRecognition(index, rosterPlayerAccountId(player), {
          id: `${prefix}-mvp`,
          label: `${prefix}•MVP`,
          kind: "mvp",
          seasonNumber: season.season_number,
          seasonSlug: season.season_slug,
          seasonName: seasonTitle,
          detail: `Tournament MVP · ${seasonTitle}`,
        });
      }
    }

    const championTeamName = resolveChampionTeamName(honors);
    if (championTeamName) {
      for (const player of championTeamPlayers(approvedRoster, championTeamName)) {
        appendRecognition(index, rosterPlayerAccountId(player), {
          id: `${prefix}-champion`,
          label: `${prefix}•Champion`,
          kind: "champion",
          seasonNumber: season.season_number,
          seasonSlug: season.season_slug,
          seasonName: seasonTitle,
          teamName: championTeamName,
          detail: `${seasonTitle} · ${championTeamName}`,
        });
      }
    }

    for (const card of honors.customCards || []) {
      for (const { player } of rosterPlayersMatchingHonor(teams, card)) {
        appendRecognition(index, rosterPlayerAccountId(player), {
          id: `${prefix}-custom-${card.id || card.title}`,
          label: card.title ? `${prefix}•${card.title}` : `${prefix}•Honor`,
          kind: "custom",
          seasonNumber: season.season_number,
          seasonSlug: season.season_slug,
          seasonName: seasonTitle,
          title: card.title || "",
          detail: card.title ? `${card.title} · ${seasonTitle}` : seasonTitle,
        });
      }
    }
  }

  for (const [key, list] of index) {
    index.set(key, sortRecognitions(list));
  }
  return index;
}

/** Auto-derived recognition badges (S1•Champion, S1•MVP, etc.). */
export async function buildPlayerRecognitions(playerAccountId) {
  const index = await buildGlobalRecognitionIndex();
  return index.get(String(playerAccountId)) || [];
}

/** Highest bracket stage for a team name in a concluded tournament. */
export async function resolveTeamHighestStage(tournamentId, teamName, format) {
  if (!teamName?.trim()) return null;

  const { rows: tourRows } = await pool.query(
    `SELECT tournament_honors FROM tournaments WHERE id = $1`,
    [tournamentId],
  );
  const honorsRaw = tourRows[0]?.tournament_honors || {};
  const { rows: matchRows } = await pool.query(`SELECT * FROM matches WHERE tournament_id = $1`, [tournamentId]);
  const honors = buildPublicHonorsPayload(matchRows, format, honorsRaw);
  const entry = (honors.placementTeams || honors.podiumTeams || []).find(
    (row) => String(row.teamName || "").toLowerCase() === teamName.toLowerCase(),
  );
  if (entry?.placement) return stageLabelFromPlacement(entry.placement);
  if (entry?.role) return entry.role;
  return null;
}

export async function buildTeamStintHistory(playerAccountId) {
  const stints = await loadAllMembershipStintsForAccount(playerAccountId);
  const results = [];

  for (const stint of stints) {
    const matchesPlayed = await countPlayedMatchesForStint(
      playerAccountId,
      stint.tournament_id,
      stint.team_name,
      {
        startedAt: stint.started_at,
        endedAt: stint.ended_at,
        seasonStatus: stint.season_status,
      },
    );
    results.push({
      membershipId: stint.membership_id,
      rosterSnapshotId: stint.roster_snapshot_id,
      rosterName: stint.roster_name,
      teamName: stint.team_name,
      logoUrl: stint.logo_url || "",
      tournamentName: stint.tournament_name,
      tournamentSlug: stint.tournament_slug,
      tournamentId: stint.tournament_id,
      seasonNumber: stint.season_number,
      seasonSlug: stint.season_slug,
      seasonStatus: stint.season_status,
      status: stint.status,
      startedAt: stint.started_at,
      endedAt: stint.ended_at,
      approvedAt: stint.approved_at,
      matchesPlayed,
      wasReplaced:
        stint.registration_status === "replaced" || (stint.status === "inactive" && matchesPlayed === 0),
    });
  }

  return results;
}

export async function buildPublicMatchHistory(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT mlp.*, m.team1, m.team2, m.stage_key, m.round_index, m.match_index, m.status,
            m.winner, m.team1_score, m.team2_score, m.meta,
            ss.start_at, ss.status AS schedule_status,
            t.name AS tournament_name, t.slug AS tournament_slug, t.season_card_badge,
            s.number AS season_number, s.slug AS season_slug, s.status AS season_status
     FROM match_lineup_players mlp
     JOIN matches m ON m.id = mlp.match_id
     JOIN tournaments t ON t.id = mlp.tournament_id
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     LEFT JOIN seasons s ON s.tournament_id = t.id
     WHERE mlp.player_account_id = $1
        OR mlp.replaces_player_account_id = $1
     ORDER BY ss.start_at DESC NULLS LAST, mlp.created_at DESC`,
    [playerAccountId],
  );

  return rows
    .filter((row) => {
      const meta = parseMatchMeta(row.meta);
      return isMatchCompleted(row.status, row.schedule_status, row.winner || meta.winner);
    })
    .map((row) => {
      const meta = parseMatchMeta(row.meta);
      const winner = row.winner || meta.winner || "";
      const team1Score = Number.isFinite(Number(row.team1_score))
        ? Number(row.team1_score)
        : Number.isFinite(Number(meta.team1Score))
          ? Number(meta.team1Score)
          : null;
      const team2Score = Number.isFinite(Number(row.team2_score))
        ? Number(row.team2_score)
        : Number.isFinite(Number(meta.team2Score))
          ? Number(meta.team2Score)
          : null;
      const playedAsSub = row.is_substitute === true && row.player_account_id === playerAccountId;
      const wasReplaced = row.replaces_player_account_id === playerAccountId;
      const appearanceLabel = wasReplaced ? "Replaced" : playedAsSub ? "Subbed in" : "Played";
      const playerTeam = row.team_name || "";
      const won =
        winner && playerTeam
          ? winner.toLowerCase() === playerTeam.toLowerCase()
          : null;

      return {
        matchId: row.match_id,
        tournamentName: row.tournament_name,
        tournamentSlug: row.tournament_slug,
        seasonNumber: row.season_number,
        seasonSlug: row.season_slug,
        seasonStatus: row.season_status,
        seasonCardBadge: String(row.season_card_badge || "").trim() || null,
        team1: row.team1,
        team2: row.team2,
        stageKey: row.stage_key,
        stageLabel: formatStageLabel(row),
        roundIndex: row.round_index,
        matchIndex: row.match_index,
        startAt: row.start_at,
        teamName: playerTeam,
        winner,
        team1Score,
        team2Score,
        score: typeof meta.score === "string" ? meta.score : "",
        won,
        isSubstitute: row.is_substitute === true,
        wasReplaced,
        playedAsSub,
        appearanceLabel,
      };
    });
}
