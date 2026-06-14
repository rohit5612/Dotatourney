import { pool } from "../db/pool.js";
import {
  getPlayerRegistrationById,
  mapRegistrationRow,
  updatePlayerRegistration,
} from "./registrationRepository.js";
import { assignSubstitutionRequest, listEligibleSubstitutes } from "./matchSubstitutionService.js";

const substituteListSelect = `SELECT r.id, r.tournament_id, r.email, r.name, r.display_name, r.location, r.roles, r.mmr,
      r.steam_name, r.steam_profile, r.discord_handle, r.phone_number, r.payment_screenshot, r.notes,
      r.payment_status, r.registration_status, r.admin_notes, r.public_code, r.player_account_id,
      pa.bpc_id AS player_bpc_id, pa.slug AS player_slug,
      r.registration_flow_stage, r.card_tier, r.substitute_flag, r.payment_provider,
      r.email_verified_at, r.terms_accepted_at, r.draft_payload,
      r.archived_at, r.archived_by, r.archived_reason, r.created_at, r.updated_at`;

export async function listSubstitutePool(tournamentId, { search = "", limit = 25, offset = 0 } = {}) {
  const params = [tournamentId];
  const conditions = ["r.tournament_id = $1", "r.substitute_flag = TRUE", "r.archived_at IS NULL"];
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(
      lower(r.email) LIKE $${idx}
      OR lower(COALESCE(r.display_name, r.name, '')) LIKE $${idx}
      OR lower(COALESCE(pa.bpc_id, '')) LIKE $${idx}
      OR lower(COALESCE(r.steam_name, '')) LIKE $${idx}
      OR lower(COALESCE(r.discord_handle, '')) LIKE $${idx}
      OR lower(COALESCE(r.location, '')) LIKE $${idx}
      OR lower(COALESCE(r.notes, '')) LIKE $${idx}
      OR lower(COALESCE(r.admin_notes, '')) LIKE $${idx}
    )`);
  }
  const where = conditions.join(" AND ");
  const fromClause = `FROM player_registrations r
     LEFT JOIN player_accounts pa ON pa.id = r.player_account_id`;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total ${fromClause} WHERE ${where}`,
    params,
  );
  const { rows: summaryRows } = await pool.query(
    `SELECT r.registration_status, COUNT(*)::int AS count
     ${fromClause}
     WHERE ${where}
     GROUP BY r.registration_status`,
    params,
  );

  const listParams = [...params, Math.min(Number(limit) || 25, 100), Math.max(Number(offset) || 0, 0)];
  const { rows } = await pool.query(
    `${substituteListSelect}
     ${fromClause}
     WHERE ${where}
     ORDER BY
       CASE r.registration_status
         WHEN 'pending' THEN 0
         WHEN 'waitlisted' THEN 1
         WHEN 'approved' THEN 2
         ELSE 3
       END,
       r.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  const summary = { pending: 0, approved: 0, waitlisted: 0, rejected: 0 };
  for (const row of summaryRows) {
    if (row.registration_status in summary) {
      summary[row.registration_status] = row.count;
    }
  }

  return {
    substitutes: rows.map((row) => mapRegistrationRow(row)),
    total: countRows[0]?.total || 0,
    summary,
  };
}

export async function updateSubstitutePoolRegistration(tournamentId, registrationId, payload) {
  const existing = await getPlayerRegistrationById(tournamentId, registrationId);
  if (!existing) return null;
  if (!existing.substituteFlag) {
    const err = new Error("Registration is not a substitute pool entry");
    err.status = 403;
    throw err;
  }
  return updatePlayerRegistration(tournamentId, registrationId, {
    registrationStatus: payload.registrationStatus,
    adminNotes: payload.adminNotes,
  });
}

export async function listSubstitutionRequests(tournamentId, { status } = {}) {
  const params = [tournamentId];
  let sql = `SELECT sr.*,
                    pa.display_name AS requester_name,
                    pa.bpc_id AS requester_bpc_id,
                    m.team1, m.team2, m.stage_key, m.round_index, m.match_index,
                    ss.start_at AS match_start_at,
                    rst.name AS team_name,
                    COALESCE(pref_pr.display_name, pref_pr.name) AS preferred_substitute_name
             FROM substitution_requests sr
             LEFT JOIN player_accounts pa ON pa.id = sr.requesting_player_account_id
             LEFT JOIN matches m ON m.id = sr.match_id
             LEFT JOIN schedule_slots ss ON ss.match_id = m.id
             LEFT JOIN roster_snapshot_teams rst ON rst.id = sr.snapshot_team_id
             LEFT JOIN player_registrations pref_pr ON pref_pr.id = sr.preferred_substitute_registration_id
             WHERE sr.tournament_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND sr.status = $${params.length}`;
  }
  sql += " ORDER BY sr.created_at DESC";
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function updateSubstitutionRequest(tournamentId, requestId, { status, adminNotes }) {
  const { rows } = await pool.query(
    `UPDATE substitution_requests
     SET status = COALESCE($3, status), admin_notes = COALESCE($4, admin_notes), updated_at = NOW()
     WHERE id = $2 AND tournament_id = $1
     RETURNING *`,
    [tournamentId, requestId, status || null, adminNotes ?? null],
  );
  return rows[0] || null;
}

export { assignSubstitutionRequest, listEligibleSubstitutes };
