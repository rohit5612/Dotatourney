import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function recordTeamProfileChange({ tournamentId, snapshotTeamId, field, oldValue, newValue, adminUserId, client }) {
  if (String(oldValue ?? "") === String(newValue ?? "")) return null;
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO team_profile_history (id, tournament_id, snapshot_team_id, field, old_value, new_value, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), tournamentId, snapshotTeamId, field, String(oldValue ?? ""), String(newValue ?? ""), adminUserId || null],
  );
  return rows[0];
}

export async function listTeamProfileHistory(tournamentId, snapshotTeamId) {
  const { rows } = await pool.query(
    `SELECT h.*, u.name AS changed_by_name
     FROM team_profile_history h
     LEFT JOIN admin_users u ON u.id = h.changed_by
     WHERE h.tournament_id = $1 AND h.snapshot_team_id = $2
     ORDER BY h.effective_at DESC`,
    [tournamentId, snapshotTeamId],
  );
  return rows;
}

export async function listPlayerTeamStints(tournamentId, snapshotPlayerId) {
  const { rows } = await pool.query(
    `SELECT m.*, rst.name AS team_name
     FROM roster_snapshot_team_memberships m
     JOIN roster_snapshot_teams rst ON rst.id = m.snapshot_team_id
     WHERE m.tournament_id = $1 AND m.snapshot_player_id = $2
     ORDER BY m.started_at DESC NULLS LAST`,
    [tournamentId, snapshotPlayerId],
  );
  return rows;
}
