import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { formatPublicMatchStageLabel } from "../utils/matchStageLabel.js";
import {
  applySubstituteToLineup,
  getLineupPlayerAccountIdsForMatchTeam,
  getMatchLineupRows,
  groupLineupsByTeam,
  matchLineupNeedsReseed,
  revertSubstituteFromLineup,
  reseedMatchLineups,
  seedMatchLineupsForTournament,
} from "./matchLineupService.js";
import {
  notifySubstitutionAssigned,
  notifySubstitutionCancelled,
  notifySubstitutionFiled,
  notifySubstitutionOpponentLineupChange,
} from "./playerNotificationService.js";
import { findActivePlayerTeamOnTournament } from "./rosterMembershipService.js";

const CANCEL_HOURS_MS = 4 * 60 * 60 * 1000;

async function findPlayerTeamOnTournament(playerAccountId, tournamentId) {
  const result = await findActivePlayerTeamOnTournament(playerAccountId, tournamentId);
  if (!result) return null;
  return {
    team: { name: result.team.name },
    player: { name: result.player.name },
  };
}

async function getPlayerTeamForAccount(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT tournament_id FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
  );
  let tournamentId = rows[0]?.tournament_id;
  if (!tournamentId) {
    const pub = await pool.query(
      `SELECT id FROM tournaments WHERE is_published = TRUE ORDER BY published_at DESC LIMIT 1`,
    );
    tournamentId = pub.rows[0]?.id;
  }
  if (!tournamentId) return { team: null, tournamentId: null };
  const team = await findPlayerTeamOnTournament(playerAccountId, tournamentId);
  return { team, tournamentId };
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isMatchCompleted(status) {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "done" || s === "finished";
}

function cancelDeadline(startAt) {
  if (!startAt) return null;
  return new Date(new Date(startAt).getTime() - CANCEL_HOURS_MS);
}

function canCancelRequest(startAt) {
  if (!startAt) return true;
  return Date.now() < cancelDeadline(startAt).getTime();
}

function formatStageLabel(match) {
  return formatPublicMatchStageLabel(match);
}

function getOpponentTeamName(match, teamName) {
  if (!teamName?.trim() || !match) return null;
  const normalized = teamName.toLowerCase();
  if (match.team1?.toLowerCase() === normalized) return match.team2 || null;
  if (match.team2?.toLowerCase() === normalized) return match.team1 || null;
  return null;
}

async function loadMatchContext(matchId) {
  const { rows } = await pool.query(
    `SELECT m.*, ss.start_at, ss.stream AS schedule_stream, ss.status AS schedule_status, ss.notes AS schedule_notes
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.id = $1`,
    [matchId],
  );
  return rows[0] || null;
}

async function ensureLineupsSeeded(tournamentId, matchId, matchRow) {
  const lineupRows = await getMatchLineupRows(matchId);
  const starters = lineupRows.filter((row) => row.is_substitute !== true);
  if (!starters.length) {
    await seedMatchLineupsForTournament(tournamentId, [matchId]);
    return;
  }
  if (matchLineupNeedsReseed(starters, matchRow.team1, matchRow.team2)) {
    await reseedMatchLineups(tournamentId, matchId);
  }
}

async function getPlayerSubstitutionRequest(matchId, playerAccountId) {
  const { rows } = await pool.query(
    `SELECT sr.*, sub_pa.display_name AS substitute_name
     FROM substitution_requests sr
     LEFT JOIN player_accounts sub_pa ON sub_pa.id = sr.assigned_player_account_id
     WHERE sr.match_id = $1 AND sr.requesting_player_account_id = $2
       AND sr.status IN ('pending', 'approved')
     ORDER BY sr.created_at DESC
     LIMIT 1`,
    [matchId, playerAccountId],
  );
  return rows[0] || null;
}

function mapSubstitutionRequest(row, startAt) {
  if (!row) return null;
  const deadline = cancelDeadline(startAt);
  return {
    id: row.id,
    status: row.status,
    reason: row.reason || "",
    preferredSubstituteRegistrationId: row.preferred_substitute_registration_id || null,
    substituteName: row.substitute_name || null,
    canCancel: row.status === "pending" && canCancelRequest(startAt),
    cancelDeadline: deadline?.toISOString() || null,
    createdAt: row.created_at,
  };
}

async function resolvePlayerMatchContext(playerAccountId, matchRow, rosterTeamName) {
  const { rows } = await pool.query(
    `SELECT team_name, is_substitute
     FROM match_lineup_players
     WHERE match_id = $1 AND player_account_id = $2
     LIMIT 1`,
    [matchRow.id, playerAccountId],
  );
  const lineup = rows[0];
  if (lineup?.team_name) {
    return {
      teamName: lineup.team_name,
      isSubstitute: lineup.is_substitute === true,
    };
  }

  if (rosterTeamName) {
    const normalized = rosterTeamName.toLowerCase();
    const playsInMatch =
      matchRow.team1?.toLowerCase() === normalized || matchRow.team2?.toLowerCase() === normalized;
    if (playsInMatch) {
      return { teamName: rosterTeamName, isSubstitute: false };
    }
  }

  return { teamName: null, isSubstitute: false };
}

async function loadPlayerMatchRows(playerAccountId, tournamentId, rosterTeamName) {
  const matchIds = new Set();

  if (rosterTeamName) {
    const { rows } = await pool.query(
      `SELECT m.id
       FROM matches m
       WHERE m.tournament_id = $1
         AND (lower(m.team1) = lower($2) OR lower(m.team2) = lower($2))`,
      [tournamentId, rosterTeamName],
    );
    for (const row of rows) matchIds.add(row.id);
  }

  const { rows: lineupRows } = await pool.query(
    `SELECT DISTINCT mlp.match_id
     FROM match_lineup_players mlp
     JOIN matches m ON m.id = mlp.match_id
     WHERE mlp.player_account_id = $1
       AND m.tournament_id = $2`,
    [playerAccountId, tournamentId],
  );
  for (const row of lineupRows) matchIds.add(row.match_id);

  if (!matchIds.size) return [];

  const ids = [...matchIds];
  const { rows: matchRows } = await pool.query(
    `SELECT m.*, ss.start_at, ss.stream AS schedule_stream, ss.status AS schedule_status, ss.notes AS schedule_notes
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.id = ANY($1::uuid[])
     ORDER BY ss.start_at ASC NULLS LAST, m.round_index ASC, m.match_index ASC`,
    [ids],
  );
  return matchRows;
}

async function buildMatchPayload(matchRow, playerAccountId, teamName, { isSubstitute = false } = {}) {
  const startAt = matchRow.start_at;
  const lineupRows = await getMatchLineupRows(matchRow.id);
  const lineups = groupLineupsByTeam(lineupRows, matchRow.team1, matchRow.team2);
  let meta = {};
  if (matchRow?.meta && typeof matchRow.meta === "object") {
    meta = matchRow.meta;
  } else if (typeof matchRow?.meta === "string") {
    try {
      meta = JSON.parse(matchRow.meta || "{}");
    } catch {
      meta = {};
    }
  }

  const myTeamSide =
    teamName?.toLowerCase() === matchRow.team1?.toLowerCase()
      ? "team1"
      : teamName?.toLowerCase() === matchRow.team2?.toLowerCase()
        ? "team2"
        : null;

  const onLineup = lineupRows.some(
    (r) => r.player_account_id === playerAccountId && !r.is_substitute,
  );
  const subRequest = await getPlayerSubstitutionRequest(matchRow.id, playerAccountId);
  const completed = isMatchCompleted(matchRow.status) || matchRow.schedule_status === "finished";
  const isFuture = startAt ? new Date(startAt).getTime() > Date.now() : !completed;
  const wasReplacedBySub = Boolean(
    subRequest?.status === "approved" && !onLineup && !isSubstitute,
  );

  return {
    id: matchRow.id,
    stageKey: matchRow.stage_key,
    stageLabel: formatStageLabel(matchRow),
    roundIndex: matchRow.round_index,
    matchIndex: matchRow.match_index,
    team1: matchRow.team1,
    team2: matchRow.team2,
    opponent:
      teamName?.toLowerCase() === matchRow.team1?.toLowerCase() ? matchRow.team2 : matchRow.team1,
    myTeam: myTeamSide,
    startAt,
    stream: matchRow.schedule_stream || matchRow.stream || "",
    status: matchRow.status,
    scheduleStatus: matchRow.schedule_status,
    winner: matchRow.winner || meta.winner || "",
    team1Score: Number.isFinite(Number(matchRow.team1_score))
      ? Number(matchRow.team1_score)
      : Number.isFinite(Number(meta.team1Score))
        ? Number(meta.team1Score)
        : null,
    team2Score: Number.isFinite(Number(matchRow.team2_score))
      ? Number(matchRow.team2_score)
      : Number.isFinite(Number(meta.team2Score))
        ? Number(meta.team2Score)
        : null,
    score: typeof meta.score === "string" ? meta.score : "",
    notes: matchRow.schedule_notes,
    lineups,
    playingAsSubstitute: isSubstitute,
    wasReplacedBySub,
    substitutionRequest: mapSubstitutionRequest(subRequest, startAt),
    canRequestSubstitution:
      onLineup && !isSubstitute && isFuture && !completed && !subRequest && Boolean(startAt),
  };
}

export async function getPlayerMatchSchedule(playerAccountId) {
  const { team: teamInfo, tournamentId } = await getPlayerTeamForAccount(playerAccountId);
  if (!tournamentId) {
    return { teamName: null, tournamentId: null, upcoming: [], past: [], matches: [] };
  }

  const rosterTeamName = teamInfo?.team?.name || null;
  const matchRows = await loadPlayerMatchRows(playerAccountId, tournamentId, rosterTeamName);
  if (!matchRows.length) {
    return {
      teamName: rosterTeamName,
      tournamentId,
      upcoming: [],
      past: [],
      matches: [],
    };
  }

  const upcoming = [];
  const past = [];
  const now = Date.now();

  for (const row of matchRows) {
    await ensureLineupsSeeded(tournamentId, row.id, row);
    const context = await resolvePlayerMatchContext(playerAccountId, row, rosterTeamName);
    const match = await buildMatchPayload(row, playerAccountId, context.teamName, {
      isSubstitute: context.isSubstitute,
    });
    const startMs = row.start_at ? new Date(row.start_at).getTime() : null;
    const completed = isMatchCompleted(row.status) || row.schedule_status === "finished";
    if (completed || (startMs && startMs < now)) {
      past.push(match);
    } else {
      upcoming.push(match);
    }
  }

  past.sort((a, b) => {
    const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
    const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
    return tb - ta;
  });

  return {
    teamName: rosterTeamName,
    tournamentId,
    upcoming,
    past,
    matches: [...upcoming, ...past],
  };
}

export async function createSubstitutionRequest(playerAccountId, matchId, reason) {
  const trimmedReason = String(reason || "").trim();
  if (trimmedReason.length < 3) throw httpError("Please provide a reason (at least 3 characters).");

  const match = await loadMatchContext(matchId);
  if (!match) throw httpError("Match not found", 404);
  if (isMatchCompleted(match.status)) throw httpError("This match is already completed.");
  if (!match.start_at) throw httpError("Match must be scheduled before requesting a substitute.");
  if (new Date(match.start_at).getTime() <= Date.now()) throw httpError("Cannot request a substitute for a match that has started.");

  const teamInfo = await findPlayerTeamOnTournament(playerAccountId, match.tournament_id);
  if (!teamInfo?.team?.name) throw httpError("You are not on an approved roster for this tournament.");

  const teamName = teamInfo.team.name;
  const isOnMatch =
    teamName.toLowerCase() === match.team1?.toLowerCase() ||
    teamName.toLowerCase() === match.team2?.toLowerCase();
  if (!isOnMatch) throw httpError("Your team is not playing in this match.");

  await ensureLineupsSeeded(match.tournament_id, matchId, match);

  const { rows: lineupCheck } = await pool.query(
    `SELECT id FROM match_lineup_players
     WHERE match_id = $1 AND player_account_id = $2 AND is_substitute = FALSE`,
    [matchId, playerAccountId],
  );
  if (!lineupCheck[0]) throw httpError("You are not on the lineup for this match.");

  const existing = await getPlayerSubstitutionRequest(matchId, playerAccountId);
  if (existing) throw httpError("You already have an active substitution request for this match.");

  const { rows: teamRows } = await pool.query(
    `SELECT rst.id FROM roster_snapshot_teams rst
     JOIN roster_snapshots rs ON rs.id = rst.roster_snapshot_id AND rs.status = 'approved'
     WHERE rs.tournament_id = $1 AND lower(rst.name) = lower($2)
     ORDER BY rs.approved_at DESC LIMIT 1`,
    [match.tournament_id, teamName],
  );

  const requestId = randomUUID();
  const windowExpires = cancelDeadline(match.start_at);

  const { rows } = await pool.query(
    `INSERT INTO substitution_requests (
      id, tournament_id, snapshot_team_id, requesting_player_account_id, replaced_player_account_id,
      match_id, status, reason, window_expires_at
    ) VALUES ($1, $2, $3, $4, $4, $5, 'pending', $6, $7)
    RETURNING *`,
    [
      requestId,
      match.tournament_id,
      teamRows[0]?.id || null,
      playerAccountId,
      matchId,
      trimmedReason,
      windowExpires,
    ],
  );

  const requesterName = teamInfo.player?.name || "A player";
  const recipientIds = await getLineupPlayerAccountIdsForMatchTeam(matchId, teamName);
  await notifySubstitutionFiled({
    match,
    teamName,
    requesterName,
    recipientAccountIds: recipientIds.filter((id) => id !== playerAccountId),
  });

  return { request: rows[0] };
}

export async function cancelSubstitutionRequest(playerAccountId, matchId) {
  const match = await loadMatchContext(matchId);
  if (!match) throw httpError("Match not found", 404);

  const { rows } = await pool.query(
    `SELECT * FROM substitution_requests
     WHERE match_id = $1 AND requesting_player_account_id = $2 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [matchId, playerAccountId],
  );
  const request = rows[0];
  if (!request) throw httpError("No pending substitution request found.", 404);
  if (!canCancelRequest(match.start_at)) {
    throw httpError("Requests cannot be cancelled within 4 hours of match start.");
  }

  const { rows: updated } = await pool.query(
    `UPDATE substitution_requests
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [request.id],
  );

  const { rows: accountRows } = await pool.query(
    `SELECT display_name FROM player_accounts WHERE id = $1`,
    [playerAccountId],
  );
  const teamInfo = await findPlayerTeamOnTournament(playerAccountId, match.tournament_id);
  const teamName = teamInfo?.team?.name;
  const recipientIds = teamName
    ? await getLineupPlayerAccountIdsForMatchTeam(matchId, teamName)
    : [];
  await notifySubstitutionCancelled({
    match,
    requesterName: accountRows[0]?.display_name || "A player",
    recipientAccountIds: recipientIds,
    substitutionRequestId: request.id,
  });

  return { request: updated[0] };
}

export async function cancelSubstitutionRequestByAdmin(
  tournamentId,
  requestId,
  { adminNotes, adminUserId } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: reqRows } = await client.query(
      `SELECT sr.*, m.team1, m.team2, m.status AS match_status,
              ss.start_at, ss.status AS schedule_status,
              pa.display_name AS requester_name,
              sub_pa.display_name AS substitute_name
       FROM substitution_requests sr
       JOIN matches m ON m.id = sr.match_id
       LEFT JOIN schedule_slots ss ON ss.match_id = m.id
       LEFT JOIN player_accounts pa ON pa.id = sr.requesting_player_account_id
       LEFT JOIN player_accounts sub_pa ON sub_pa.id = sr.assigned_player_account_id
       WHERE sr.id = $1 AND sr.tournament_id = $2
       FOR UPDATE OF sr`,
      [requestId, tournamentId],
    );
    const request = reqRows[0];
    if (!request) throw httpError("Request not found", 404);
    if (request.status === "cancelled") throw httpError("Request is already cancelled.");
    if (request.status === "rejected") throw httpError("Rejected requests cannot be cancelled.");

    if (isMatchCompleted(request.match_status) || request.schedule_status === "finished") {
      throw httpError("Cannot cancel substitutions for a completed match.");
    }

    const wasApproved = request.status === "approved";
    let teamName = null;

    if (wasApproved) {
      const { rows: teamRows } = await client.query(
        `SELECT rst.name FROM roster_snapshot_teams rst WHERE rst.id = $1`,
        [request.snapshot_team_id],
      );
      teamName = teamRows[0]?.name;
      if (!teamName) {
        const teamInfo = await findPlayerTeamOnTournament(
          request.requesting_player_account_id,
          tournamentId,
        );
        teamName = teamInfo?.team?.name;
      }
      if (!teamName) throw httpError("Could not resolve team for this request.");

      await revertSubstituteFromLineup(client, {
        matchId: request.match_id,
        tournamentId,
        teamName,
        replacedPlayerAccountId: request.requesting_player_account_id,
        substitutionRequestId: requestId,
      });
    }

    const { rows: updated } = await client.query(
      `UPDATE substitution_requests
       SET status = 'cancelled',
           cancelled_at = NOW(),
           admin_notes = COALESCE($3, admin_notes),
           updated_at = NOW()
       WHERE id = $1 AND tournament_id = $2
       RETURNING *`,
      [requestId, tournamentId, adminNotes ?? null],
    );

    await client.query("COMMIT");

    const match = {
      id: request.match_id,
      team1: request.team1,
      team2: request.team2,
    };
    const requesterName = request.requester_name || "A player";
    const substituteName = request.substitute_name || null;

    if (wasApproved && teamName) {
      const requestingTeamIds = await getLineupPlayerAccountIdsForMatchTeam(request.match_id, teamName);
      const opponentTeamName = getOpponentTeamName(match, teamName);
      const opponentTeamIds = opponentTeamName
        ? await getLineupPlayerAccountIdsForMatchTeam(request.match_id, opponentTeamName)
        : [];
      const recipientIds = [
        ...new Set([
          ...requestingTeamIds,
          request.requesting_player_account_id,
          request.assigned_player_account_id,
          ...opponentTeamIds,
        ].filter(Boolean)),
      ];
      await notifySubstitutionCancelled({
        match,
        requesterName,
        substituteName,
        recipientAccountIds: recipientIds,
        substitutionRequestId: requestId,
        wasApproved: true,
        cancelledByAdmin: true,
      });
    } else {
      const teamInfo = await findPlayerTeamOnTournament(
        request.requesting_player_account_id,
        tournamentId,
      );
      const pendingTeamName = teamInfo?.team?.name;
      const recipientIds = pendingTeamName
        ? await getLineupPlayerAccountIdsForMatchTeam(request.match_id, pendingTeamName)
        : [];
      await notifySubstitutionCancelled({
        match,
        requesterName,
        recipientAccountIds: recipientIds,
        substitutionRequestId: requestId,
        cancelledByAdmin: true,
      });
    }

    return { request: updated[0], adminUserId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mapLineupPlayerForAdmin(row) {
  return {
    playerAccountId: row.player_account_id,
    displayName: row.display_name,
    bpcId: row.bpc_id || null,
    isSubstitute: row.is_substitute === true,
    replacesDisplayName: row.replaces_display_name || null,
  };
}

function mapLineupSide(lineupRows, teamName) {
  return lineupRows
    .filter((row) => row.team_name?.toLowerCase() === teamName?.toLowerCase())
    .map(mapLineupPlayerForAdmin);
}

async function getPlayerPendingSubstitutionRequest(matchId, playerAccountId) {
  const { rows } = await pool.query(
    `SELECT * FROM substitution_requests
     WHERE match_id = $1 AND requesting_player_account_id = $2 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [matchId, playerAccountId],
  );
  return rows[0] || null;
}

async function resolveSubstituteRegistration(client, tournamentId, { substituteRegistrationId, substitutePlayerAccountId }) {
  let registrationId = substituteRegistrationId || null;
  let assigneeAccountId = substitutePlayerAccountId || null;

  if (registrationId) {
    const { rows: regRows } = await client.query(
      `SELECT * FROM player_registrations
       WHERE id = $1 AND tournament_id = $2 AND registration_status = 'approved' AND archived_at IS NULL`,
      [registrationId, tournamentId],
    );
    const reg = regRows[0];
    if (!reg) throw httpError("Substitute registration not found or not approved.");
    assigneeAccountId = reg.player_account_id;
    return { registrationId, assigneeAccountId, reg };
  }

  if (assigneeAccountId) {
    const { rows: regRows } = await client.query(
      `SELECT * FROM player_registrations
       WHERE player_account_id = $1 AND tournament_id = $2 AND registration_status = 'approved' AND archived_at IS NULL
       LIMIT 1`,
      [assigneeAccountId, tournamentId],
    );
    const reg = regRows[0];
    if (!reg) throw httpError("Substitute registration not found or not approved.");
    return { registrationId: reg.id, assigneeAccountId, reg };
  }

  throw httpError("Select a substitute from the pool.");
}

async function sendSubstitutionAssignedNotifications({
  matchId,
  team1,
  team2,
  teamName,
  requesterName,
  substituteName,
  requesterAccountId,
  assigneeAccountId,
  substitutionRequestId,
}) {
  const match = { id: matchId, team1, team2 };
  const requestingTeamIds = await getLineupPlayerAccountIdsForMatchTeam(matchId, teamName);
  const opponentTeamName = getOpponentTeamName(match, teamName);
  const opponentTeamIds = opponentTeamName
    ? await getLineupPlayerAccountIdsForMatchTeam(matchId, opponentTeamName)
    : [];

  await notifySubstitutionAssigned({
    match,
    teamName,
    requesterName,
    substituteName,
    recipientAccountIds: [
      ...new Set([...requestingTeamIds, requesterAccountId, assigneeAccountId]),
    ],
    substitutionRequestId,
  });

  if (opponentTeamIds.length) {
    await notifySubstitutionOpponentLineupChange({
      match,
      teamName,
      requesterName,
      substituteName,
      recipientAccountIds: opponentTeamIds,
      substitutionRequestId,
    });
  }
}

export async function listSubstitutionTargets(tournamentId) {
  const { rows: matchRows } = await pool.query(
    `SELECT m.id, m.team1, m.team2, m.stage_key, m.round_index, m.match_index, m.status,
            ss.start_at, ss.status AS schedule_status
     FROM matches m
     JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.tournament_id = $1
       AND ss.start_at IS NOT NULL
     ORDER BY ss.start_at ASC, m.round_index ASC, m.match_index ASC`,
    [tournamentId],
  );

  const matches = [];
  for (const row of matchRows) {
    if (isMatchCompleted(row.status) || row.schedule_status === "finished") continue;

    await ensureLineupsSeeded(tournamentId, row.id, row);
    const lineupRows = await getMatchLineupRows(row.id);

    matches.push({
      id: row.id,
      team1: row.team1,
      team2: row.team2,
      stageKey: row.stage_key,
      roundIndex: row.round_index,
      matchIndex: row.match_index,
      startAt: row.start_at,
      status: row.status,
      lineups: {
        team1: mapLineupSide(lineupRows, row.team1),
        team2: mapLineupSide(lineupRows, row.team2),
      },
    });
  }

  return { matches };
}

export async function manualAssignSubstitute(
  tournamentId,
  { matchId, replacedPlayerAccountId, substituteRegistrationId, adminNotes, adminUserId },
) {
  const match = await loadMatchContext(matchId);
  if (!match) throw httpError("Match not found", 404);
  if (match.tournament_id !== tournamentId) throw httpError("Match not found", 404);
  if (isMatchCompleted(match.status) || match.schedule_status === "finished") {
    throw httpError("This match is already completed.");
  }
  if (!match.start_at) throw httpError("Match must be scheduled before assigning a substitute.");

  const teamInfo = await findPlayerTeamOnTournament(replacedPlayerAccountId, tournamentId);
  if (!teamInfo?.team?.name) {
    throw httpError("Selected player is not on an approved roster for this tournament.");
  }

  await ensureLineupsSeeded(tournamentId, matchId, match);

  const { rows: lineupCheck } = await pool.query(
    `SELECT team_name FROM match_lineup_players
     WHERE match_id = $1 AND player_account_id = $2 AND is_substitute = FALSE`,
    [matchId, replacedPlayerAccountId],
  );
  if (!lineupCheck[0]) {
    throw httpError("Selected player is not on the match lineup or has already been replaced.");
  }
  const teamName = lineupCheck[0].team_name;

  const isOnMatch =
    teamName.toLowerCase() === match.team1?.toLowerCase() ||
    teamName.toLowerCase() === match.team2?.toLowerCase();
  if (!isOnMatch) throw httpError("Selected player's team is not playing in this match.");

  const pendingRequest = await getPlayerPendingSubstitutionRequest(matchId, replacedPlayerAccountId);
  if (pendingRequest) {
    return assignSubstitutionRequest(tournamentId, pendingRequest.id, {
      substituteRegistrationId,
      adminNotes,
      adminUserId,
    });
  }

  const existingApproved = await getPlayerSubstitutionRequest(matchId, replacedPlayerAccountId);
  if (existingApproved?.status === "approved") {
    throw httpError("This player already has an approved substitution for this match.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { registrationId, assigneeAccountId, reg: assigneeReg } = await resolveSubstituteRegistration(
      client,
      tournamentId,
      { substituteRegistrationId },
    );

    if (assigneeAccountId === replacedPlayerAccountId) {
      throw httpError("Substitute cannot be the same player being replaced.");
    }

    const { rows: subOnLineup } = await client.query(
      `SELECT id FROM match_lineup_players WHERE match_id = $1 AND player_account_id = $2 LIMIT 1`,
      [matchId, assigneeAccountId],
    );
    if (subOnLineup[0]) {
      throw httpError("Selected substitute is already on the lineup for this match.");
    }

    const { rows: teamRows } = await client.query(
      `SELECT rst.id FROM roster_snapshot_teams rst
       JOIN roster_snapshots rs ON rs.id = rst.roster_snapshot_id AND rs.status = 'approved'
       WHERE rs.tournament_id = $1 AND lower(rst.name) = lower($2)
       ORDER BY rs.approved_at DESC LIMIT 1`,
      [tournamentId, teamName],
    );

    const { rows: requesterAccount } = await client.query(
      `SELECT display_name FROM player_accounts WHERE id = $1`,
      [replacedPlayerAccountId],
    );
    const requesterName = requesterAccount[0]?.display_name || teamInfo.player?.name || "A player";
    const substituteName = assigneeReg.display_name || assigneeReg.name || "Substitute";

    const trimmedNotes = String(adminNotes || "").trim();
    const reason = trimmedNotes ? `Manual: ${trimmedNotes}` : "Manual: Admin assignment";
    const requestId = randomUUID();
    const windowExpires = cancelDeadline(match.start_at);

    const { rows: created } = await client.query(
      `INSERT INTO substitution_requests (
        id, tournament_id, snapshot_team_id, requesting_player_account_id, replaced_player_account_id,
        match_id, status, reason, window_expires_at, substitute_registration_id, assigned_player_account_id,
        admin_notes
      ) VALUES ($1, $2, $3, $4, $4, $5, 'approved', $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        requestId,
        tournamentId,
        teamRows[0]?.id || null,
        replacedPlayerAccountId,
        matchId,
        reason,
        windowExpires,
        registrationId,
        assigneeAccountId,
        trimmedNotes,
      ],
    );

    await applySubstituteToLineup(client, {
      matchId,
      tournamentId,
      teamName,
      replacedPlayerAccountId,
      substitutePlayerAccountId: assigneeAccountId,
      substituteDisplayName: substituteName,
      substituteRoles: assigneeReg.roles || [],
      substituteMmr: assigneeReg.mmr ?? null,
      substitutionRequestId: requestId,
    });

    await client.query("COMMIT");

    await sendSubstitutionAssignedNotifications({
      matchId,
      team1: match.team1,
      team2: match.team2,
      teamName,
      requesterName,
      substituteName,
      requesterAccountId: replacedPlayerAccountId,
      assigneeAccountId,
      substitutionRequestId: requestId,
    });

    return { request: created[0], adminUserId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEligibleSubstitutes(tournamentId) {
  const { rows } = await pool.query(
    `SELECT pr.id AS registration_id, pr.player_account_id, pr.display_name, pr.name, pr.mmr, pr.roles,
            pr.substitute_flag, pa.bpc_id, pa.slug
     FROM player_registrations pr
     JOIN player_accounts pa ON pa.id = pr.player_account_id
     WHERE pr.tournament_id = $1
       AND pr.archived_at IS NULL
       AND pr.registration_status = 'approved'
       AND pr.player_account_id IS NOT NULL
     ORDER BY pr.substitute_flag DESC, pr.display_name ASC NULLS LAST, pr.name ASC`,
    [tournamentId],
  );
  return rows.map((r) => ({
    registrationId: r.registration_id,
    playerAccountId: r.player_account_id,
    displayName: r.display_name || r.name,
    mmr: r.mmr,
    roles: r.roles,
    substituteFlag: r.substitute_flag === true,
    bpcId: r.bpc_id,
    slug: r.slug,
  }));
}

export async function assignSubstitutionRequest(
  tournamentId,
  requestId,
  { substituteRegistrationId, substitutePlayerAccountId, adminNotes, adminUserId },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: reqRows } = await client.query(
      `SELECT sr.*, m.team1, m.team2, m.stage_key, m.round_index, m.match_index,
              ss.start_at,
              pa.display_name AS requester_name
       FROM substitution_requests sr
       JOIN matches m ON m.id = sr.match_id
       LEFT JOIN schedule_slots ss ON ss.match_id = m.id
       LEFT JOIN player_accounts pa ON pa.id = sr.requesting_player_account_id
       WHERE sr.id = $1 AND sr.tournament_id = $2
       FOR UPDATE OF sr`,
      [requestId, tournamentId],
    );
    const request = reqRows[0];
    if (!request) throw httpError("Request not found", 404);
    if (request.status !== "pending") throw httpError("Only pending requests can be assigned.");

    let registrationId = substituteRegistrationId || null;
    let assigneeAccountId = substitutePlayerAccountId || null;

    if (registrationId) {
      const { rows: regRows } = await client.query(
        `SELECT * FROM player_registrations
         WHERE id = $1 AND tournament_id = $2 AND registration_status = 'approved' AND archived_at IS NULL`,
        [registrationId, tournamentId],
      );
      const reg = regRows[0];
      if (!reg) throw httpError("Substitute registration not found or not approved.");
      assigneeAccountId = reg.player_account_id;
    } else if (assigneeAccountId) {
      const { rows: regRows } = await client.query(
        `SELECT id FROM player_registrations
         WHERE player_account_id = $1 AND tournament_id = $2 AND registration_status = 'approved' AND archived_at IS NULL
         LIMIT 1`,
        [assigneeAccountId, tournamentId],
      );
      registrationId = regRows[0]?.id || null;
    }

    if (!assigneeAccountId) throw httpError("Select a substitute from the pool.");

    const { rows: teamRows } = await client.query(
      `SELECT rst.name FROM roster_snapshot_teams rst
       WHERE rst.id = $1`,
      [request.snapshot_team_id],
    );
    let teamName = teamRows[0]?.name;
    if (!teamName) {
      const teamInfo = await findPlayerTeamOnTournament(request.requesting_player_account_id, tournamentId);
      teamName = teamInfo?.team?.name;
    }
    if (!teamName) throw httpError("Could not resolve team for this request.");

    const { rows: assigneeAccount } = await client.query(
      `SELECT display_name FROM player_accounts WHERE id = $1`,
      [assigneeAccountId],
    );
    let assigneeReg = null;
    if (registrationId) {
      const { rows: assigneeRows } = await client.query(
        `SELECT display_name, mmr, roles FROM player_registrations WHERE id = $1`,
        [registrationId],
      );
      assigneeReg = assigneeRows[0];
    } else {
      const { rows: assigneeRows } = await client.query(
        `SELECT display_name, mmr, roles FROM player_registrations
         WHERE player_account_id = $1 AND tournament_id = $2 AND archived_at IS NULL
         ORDER BY substitute_flag DESC, created_at DESC LIMIT 1`,
        [assigneeAccountId, tournamentId],
      );
      assigneeReg = assigneeRows[0];
    }
    const substituteName = assigneeReg?.display_name || assigneeAccount.rows[0]?.display_name || "Substitute";

    const { rows: updated } = await client.query(
      `UPDATE substitution_requests
       SET status = 'approved',
           substitute_registration_id = $3,
           assigned_player_account_id = $4,
           admin_notes = COALESCE($5, admin_notes),
           updated_at = NOW()
       WHERE id = $1 AND tournament_id = $2
       RETURNING *`,
      [requestId, tournamentId, registrationId, assigneeAccountId, adminNotes ?? null],
    );

    await applySubstituteToLineup(client, {
      matchId: request.match_id,
      tournamentId,
      teamName,
      replacedPlayerAccountId: request.requesting_player_account_id,
      substitutePlayerAccountId: assigneeAccountId,
      substituteDisplayName: substituteName,
      substituteRoles: assigneeReg?.roles || [],
      substituteMmr: assigneeReg?.mmr ?? null,
      substitutionRequestId: requestId,
    });

    await client.query("COMMIT");

    await sendSubstitutionAssignedNotifications({
      matchId: request.match_id,
      team1: request.team1,
      team2: request.team2,
      teamName,
      requesterName: request.requester_name || "A player",
      substituteName,
      requesterAccountId: request.requesting_player_account_id,
      assigneeAccountId,
      substitutionRequestId: requestId,
    });

    return { request: updated[0], adminUserId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlayerMatchAppearances(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT mlp.*, m.team1, m.team2, m.stage_key, m.round_index, m.match_index,
            m.status, m.winner, m.team1_score, m.team2_score, m.meta,
            ss.start_at, ss.status AS schedule_status,
            t.name AS tournament_name, t.slug AS tournament_slug,
            s.number AS season_number, s.slug AS season_slug
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

  return rows.map((row) => {
    let meta = {};
    if (row.meta && typeof row.meta === "object") meta = row.meta;
    else if (typeof row.meta === "string") {
      try {
        meta = JSON.parse(row.meta || "{}");
      } catch {
        meta = {};
      }
    }
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
    const won = winner && playerTeam ? winner.toLowerCase() === playerTeam.toLowerCase() : null;

    return {
      matchId: row.match_id,
      tournamentName: row.tournament_name,
      tournamentSlug: row.tournament_slug,
      seasonNumber: row.season_number,
      seasonSlug: row.season_slug,
      team1: row.team1,
      team2: row.team2,
      stageKey: row.stage_key,
      stageLabel: formatStageLabel(row),
      roundIndex: row.round_index,
      matchIndex: row.match_index,
      startAt: row.start_at,
      teamName: playerTeam,
      displayName: row.display_name,
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
