import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import {
  applySubstituteToLineup,
  getLineupPlayerAccountIdsForMatch,
  getMatchLineupRows,
  groupLineupsByTeam,
  seedMatchLineupsForTournament,
} from "./matchLineupService.js";
import {
  notifySubstitutionAssigned,
  notifySubstitutionCancelled,
  notifySubstitutionFiled,
} from "./playerNotificationService.js";

const CANCEL_HOURS_MS = 4 * 60 * 60 * 1000;

async function findPlayerTeamOnTournament(playerAccountId, tournamentId) {
  const { rows } = await pool.query(
    `SELECT rsp.display_name, rsp.name, rst.name AS team_name
     FROM roster_snapshot_players rsp
     JOIN roster_snapshots rs ON rs.id = rsp.roster_snapshot_id AND rs.status = 'approved'
     JOIN roster_snapshot_team_players rstp ON rstp.player_id = rsp.id
     JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     WHERE rs.tournament_id = $1 AND rsp.player_account_id = $2
     ORDER BY rs.approved_at DESC NULLS LAST
     LIMIT 1`,
    [tournamentId, playerAccountId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    team: { name: row.team_name },
    player: { name: row.display_name || row.name },
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
  const parts = [];
  if (match.stage_key) parts.push(match.stage_key.replace(/-/g, " "));
  if (match.round_index != null) parts.push(`R${Number(match.round_index) + 1}`);
  if (match.match_index != null) parts.push(`M${Number(match.match_index) + 1}`);
  return parts.join(" · ") || "Match";
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

async function ensureLineupsSeeded(tournamentId, matchId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM match_lineup_players WHERE match_id = $1`,
    [matchId],
  );
  if ((rows[0]?.count ?? 0) === 0) {
    await seedMatchLineupsForTournament(tournamentId, [matchId]);
  }
}

async function getPlayerSubstitutionRequest(matchId, playerAccountId) {
  const { rows } = await pool.query(
    `SELECT * FROM substitution_requests
     WHERE match_id = $1 AND requesting_player_account_id = $2
       AND status IN ('pending', 'approved')
     ORDER BY created_at DESC
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
    canCancel: row.status === "pending" && canCancelRequest(startAt),
    cancelDeadline: deadline?.toISOString() || null,
    createdAt: row.created_at,
  };
}

async function buildMatchPayload(matchRow, playerAccountId, teamName) {
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
    substitutionRequest: mapSubstitutionRequest(subRequest, startAt),
    canRequestSubstitution:
      onLineup && isFuture && !completed && !subRequest && Boolean(startAt),
  };
}

export async function getPlayerMatchSchedule(playerAccountId) {
  const { team: teamInfo, tournamentId } = await getPlayerTeamForAccount(playerAccountId);
  if (!teamInfo?.team?.name || !tournamentId) {
    return { teamName: null, tournamentId: null, upcoming: [], past: [] };
  }

  const teamName = teamInfo.team.name;
  const { rows: matchRows } = await pool.query(
    `SELECT m.*, ss.start_at, ss.stream AS schedule_stream, ss.status AS schedule_status, ss.notes AS schedule_notes
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.tournament_id = $1
       AND (lower(m.team1) = lower($2) OR lower(m.team2) = lower($2))
     ORDER BY ss.start_at ASC NULLS LAST, m.round_index ASC, m.match_index ASC`,
    [tournamentId, teamName],
  );

  const upcoming = [];
  const past = [];
  const now = Date.now();

  for (const row of matchRows) {
    await ensureLineupsSeeded(tournamentId, row.id);
    const match = await buildMatchPayload(row, playerAccountId, teamName);
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

  return { teamName, tournamentId, upcoming, past, matches: [...upcoming, ...past] };
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

  await ensureLineupsSeeded(match.tournament_id, matchId);

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
  const recipientIds = await getLineupPlayerAccountIdsForMatch(matchId);
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
  const recipientIds = await getLineupPlayerAccountIdsForMatch(matchId);
  await notifySubstitutionCancelled({
    match,
    requesterName: accountRows[0]?.display_name || "A player",
    recipientAccountIds: recipientIds,
    substitutionRequestId: request.id,
  });

  return { request: updated[0] };
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

    const match = {
      id: request.match_id,
      team1: request.team1,
      team2: request.team2,
    };
    const recipientIds = await getLineupPlayerAccountIdsForMatch(request.match_id);
    await notifySubstitutionAssigned({
      match,
      teamName,
      requesterName: request.requester_name || "A player",
      substituteName,
      recipientAccountIds: [...recipientIds, assigneeAccountId],
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
            ss.start_at, t.name AS tournament_name
     FROM match_lineup_players mlp
     JOIN matches m ON m.id = mlp.match_id
     JOIN tournaments t ON t.id = mlp.tournament_id
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE mlp.player_account_id = $1
        OR mlp.replaces_player_account_id = $1
     ORDER BY ss.start_at DESC NULLS LAST, mlp.created_at DESC`,
    [playerAccountId],
  );

  return rows.map((row) => ({
    matchId: row.match_id,
    tournamentName: row.tournament_name,
    team1: row.team1,
    team2: row.team2,
    stageKey: row.stage_key,
    roundIndex: row.round_index,
    matchIndex: row.match_index,
    startAt: row.start_at,
    teamName: row.team_name,
    displayName: row.display_name,
    isSubstitute: row.is_substitute === true,
    wasReplaced: row.replaces_player_account_id === playerAccountId,
    playedAsSub: row.is_substitute === true && row.player_account_id === playerAccountId,
  }));
}
