import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function createNotification(playerAccountId, { type, title, body, payload = {} }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO player_notifications (id, player_account_id, type, title, body, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [id, playerAccountId, type, title, body, JSON.stringify(payload)],
  );
  return rows[0];
}

export async function createNotificationsForAccounts(accountIds, notification) {
  const unique = [...new Set(accountIds.filter(Boolean))];
  const results = [];
  for (const accountId of unique) {
    results.push(await createNotification(accountId, notification));
  }
  return results;
}

export async function listPlayerNotifications(playerAccountId, { limit = 30, offset = 0, unreadOnly = false } = {}) {
  const params = [playerAccountId];
  let where = `WHERE player_account_id = $1`;
  if (unreadOnly) {
    where += ` AND read_at IS NULL`;
  }
  params.push(Math.min(Math.max(limit, 1), 100));
  params.push(Math.max(offset, 0));

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM player_notifications ${where}`,
    unreadOnly ? [playerAccountId] : [playerAccountId],
  );

  const { rows } = await pool.query(
    `SELECT id, type, title, body, payload, read_at AS "readAt", created_at AS "createdAt"
     FROM player_notifications
     ${where}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params,
  );

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload || {},
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    total: countRows[0]?.total ?? 0,
    limit: params[1],
    offset: params[2],
  };
}

export async function getUnreadNotificationCount(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM player_notifications
     WHERE player_account_id = $1 AND read_at IS NULL`,
    [playerAccountId],
  );
  return rows[0]?.count ?? 0;
}

export async function markNotificationRead(playerAccountId, notificationId) {
  const { rows } = await pool.query(
    `UPDATE player_notifications SET read_at = NOW()
     WHERE id = $2 AND player_account_id = $1 AND read_at IS NULL
     RETURNING id`,
    [playerAccountId, notificationId],
  );
  return Boolean(rows[0]);
}

export async function markAllNotificationsRead(playerAccountId) {
  const { rowCount } = await pool.query(
    `UPDATE player_notifications SET read_at = NOW()
     WHERE player_account_id = $1 AND read_at IS NULL`,
    [playerAccountId],
  );
  return rowCount ?? 0;
}

export async function notifySubstitutionFiled({ match, teamName, requesterName, recipientAccountIds }) {
  const title = "Substitution request filed";
  const body = `${requesterName} requested a substitute for ${match.team1} vs ${match.team2}.`;
  return createNotificationsForAccounts(recipientAccountIds, {
    type: "substitution_filed",
    title,
    body,
    payload: { matchId: match.id, teamName },
  });
}

export async function notifySubstitutionAssigned({
  match,
  teamName,
  requesterName,
  substituteName,
  recipientAccountIds,
  substitutionRequestId,
}) {
  const title = "Substitution approved";
  const body = `${substituteName} will sub in for ${requesterName} on ${teamName} for ${match.team1} vs ${match.team2}.`;
  return createNotificationsForAccounts(recipientAccountIds, {
    type: "substitution_assigned",
    title,
    body,
    payload: { matchId: match.id, teamName, substitutionRequestId, audience: "team" },
  });
}

export async function notifySubstitutionOpponentLineupChange({
  match,
  teamName,
  requesterName,
  substituteName,
  recipientAccountIds,
  substitutionRequestId,
}) {
  const title = "Opponent lineup update";
  const body = `${teamName} has an approved substitute: ${substituteName} will play instead of ${requesterName} in ${match.team1} vs ${match.team2}.`;
  return createNotificationsForAccounts(recipientAccountIds, {
    type: "substitution_opponent_update",
    title,
    body,
    payload: { matchId: match.id, teamName, substitutionRequestId, audience: "opponent" },
  });
}

export async function notifySubstitutionCancelled({
  match,
  requesterName,
  substituteName,
  recipientAccountIds,
  substitutionRequestId,
  wasApproved = false,
  cancelledByAdmin = false,
}) {
  const title = wasApproved ? "Substitution cancelled" : "Substitution request cancelled";
  let body;
  if (wasApproved && substituteName) {
    body = cancelledByAdmin
      ? `An admin cancelled the substitution for ${match.team1} vs ${match.team2}. ${requesterName} is back on the lineup instead of ${substituteName}.`
      : `The substitution for ${match.team1} vs ${match.team2} was cancelled. ${requesterName} is back on the lineup instead of ${substituteName}.`;
  } else if (cancelledByAdmin) {
    body = `An admin cancelled the substitute request from ${requesterName} for ${match.team1} vs ${match.team2}.`;
  } else {
    body = `${requesterName} cancelled their substitute request for ${match.team1} vs ${match.team2}.`;
  }
  return createNotificationsForAccounts(recipientAccountIds, {
    type: "substitution_cancelled",
    title,
    body,
    payload: { matchId: match.id, substitutionRequestId, wasApproved },
  });
}

/**
 * In-app alert when admin approves, rejects, or waitlists a player registration.
 */
export async function notifyRegistrationDecision({
  playerAccountId,
  tournamentName,
  tournamentId,
  registrationId,
  registrationStatus,
  publicCode,
}) {
  if (!playerAccountId) return null;

  const tour = tournamentName || "BPC League";
  const code = publicCode ? ` (${publicCode})` : "";
  const payload = { tournamentId, registrationId, registrationStatus };

  if (registrationStatus === "approved") {
    return createNotification(playerAccountId, {
      type: "registration_approved",
      title: "Registration approved",
      body: `Your registration${code} for ${tour} has been approved.`,
      payload,
    });
  }

  if (registrationStatus === "rejected") {
    return createNotification(playerAccountId, {
      type: "registration_rejected",
      title: "Registration not approved",
      body: `Your registration${code} for ${tour} was not approved.`,
      payload,
    });
  }

  if (registrationStatus === "waitlisted") {
    return createNotification(playerAccountId, {
      type: "registration_waitlisted",
      title: "Registration waitlisted",
      body: `Your registration${code} for ${tour} is on the waitlist. We'll notify you if a spot opens.`,
      payload,
    });
  }

  return null;
}
