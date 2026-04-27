import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function createPlayerRegistration(tournamentId, payload) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO player_registrations (
      id, tournament_id, name, location, roles, mmr, steam_name, steam_profile,
      discord_handle, phone_number, payment_screenshot, notes, payment_status, registration_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'unpaid', 'pending')
    RETURNING id, tournament_id AS "tournamentId", name, location, roles, mmr,
              steam_name AS "steamName", steam_profile AS "steamProfile",
              discord_handle AS "discordHandle", phone_number AS "phoneNumber",
              payment_screenshot AS "paymentScreenshot", notes, payment_status AS "paymentStatus",
              registration_status AS "registrationStatus", admin_notes AS "adminNotes",
              archived_at AS "archivedAt", archived_reason AS "archivedReason",
              created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      id,
      tournamentId,
      payload.name,
      payload.location || "",
      JSON.stringify(payload.roles || []),
      payload.mmr || null,
      payload.steamName || "",
      payload.steamProfile || "",
      payload.discordHandle || "",
      payload.phoneNumber || "",
      payload.paymentScreenshot || "",
      payload.notes || "",
    ],
  );
  return rows[0];
}

export async function listPlayerRegistrations(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id AS "tournamentId", name, location, roles, mmr,
            steam_name AS "steamName", steam_profile AS "steamProfile",
            discord_handle AS "discordHandle", phone_number AS "phoneNumber",
            payment_screenshot AS "paymentScreenshot", notes, payment_status AS "paymentStatus",
            registration_status AS "registrationStatus", admin_notes AS "adminNotes",
            archived_at AS "archivedAt", archived_by AS "archivedBy", archived_reason AS "archivedReason",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM player_registrations
     WHERE tournament_id = $1
     ORDER BY created_at DESC`,
    [tournamentId],
  );
  return rows;
}

export async function updatePlayerRegistration(tournamentId, registrationId, payload) {
  const { rows } = await pool.query(
    `UPDATE player_registrations
     SET payment_status = COALESCE($3, payment_status),
         registration_status = COALESCE($4, registration_status),
         admin_notes = COALESCE($5, admin_notes),
         updated_at = NOW()
     WHERE tournament_id = $1 AND id = $2
     RETURNING id, tournament_id AS "tournamentId", name, location, roles, mmr,
               steam_name AS "steamName", steam_profile AS "steamProfile",
               discord_handle AS "discordHandle", phone_number AS "phoneNumber",
               payment_screenshot AS "paymentScreenshot", notes, payment_status AS "paymentStatus",
               registration_status AS "registrationStatus", admin_notes AS "adminNotes",
               archived_at AS "archivedAt", archived_by AS "archivedBy", archived_reason AS "archivedReason",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [tournamentId, registrationId, payload.paymentStatus, payload.registrationStatus, payload.adminNotes],
  );
  return rows[0] || null;
}

export async function archivePlayerRegistration(tournamentId, registrationId, { reason, adminUserId }) {
  const assigned = await pool.query(
    `SELECT p.id
     FROM players p
     JOIN team_players tp ON tp.player_id = p.id
     WHERE p.tournament_id = $1 AND p.registration_id = $2
     LIMIT 1`,
    [tournamentId, registrationId],
  );
  if (assigned.rows[0]) {
    const error = new Error("Unassign this player from teams before archiving the registration");
    error.status = 409;
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE player_registrations
     SET archived_at = NOW(),
         archived_by = $3,
         archived_reason = $4,
         registration_status = 'rejected',
         updated_at = NOW()
     WHERE tournament_id = $1 AND id = $2
     RETURNING id, tournament_id AS "tournamentId", name, location, roles, mmr,
               steam_name AS "steamName", steam_profile AS "steamProfile",
               discord_handle AS "discordHandle", phone_number AS "phoneNumber",
               payment_screenshot AS "paymentScreenshot", notes, payment_status AS "paymentStatus",
               registration_status AS "registrationStatus", admin_notes AS "adminNotes",
               archived_at AS "archivedAt", archived_by AS "archivedBy", archived_reason AS "archivedReason",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [tournamentId, registrationId, adminUserId, reason || ""],
  );
  return rows[0] || null;
}
