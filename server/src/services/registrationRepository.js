import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function createPlayerRegistration(tournamentId, payload) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO player_registrations (
      id, tournament_id, name, location, roles, mmr, steam_name, steam_profile,
      discord_handle, notes, payment_status, registration_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unpaid', 'pending')
    RETURNING id, tournament_id AS "tournamentId", name, location, roles, mmr,
              steam_name AS "steamName", steam_profile AS "steamProfile",
              discord_handle AS "discordHandle", notes, payment_status AS "paymentStatus",
              registration_status AS "registrationStatus", admin_notes AS "adminNotes",
              created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      id,
      tournamentId,
      payload.name,
      payload.location || "",
      payload.roles || [],
      payload.mmr || null,
      payload.steamName || "",
      payload.steamProfile || "",
      payload.discordHandle || "",
      payload.notes || "",
    ],
  );
  return rows[0];
}

export async function listPlayerRegistrations(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id AS "tournamentId", name, location, roles, mmr,
            steam_name AS "steamName", steam_profile AS "steamProfile",
            discord_handle AS "discordHandle", notes, payment_status AS "paymentStatus",
            registration_status AS "registrationStatus", admin_notes AS "adminNotes",
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
               discord_handle AS "discordHandle", notes, payment_status AS "paymentStatus",
               registration_status AS "registrationStatus", admin_notes AS "adminNotes",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [tournamentId, registrationId, payload.paymentStatus, payload.registrationStatus, payload.adminNotes],
  );
  return rows[0] || null;
}
