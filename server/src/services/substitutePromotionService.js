import { pool } from "../db/pool.js";
import {
  getRegistrationCapState,
  mapRegistrationRow,
  syncRegistrationCapState,
} from "./registrationRepository.js";
import { getApprovedRosterSnapshot } from "./tournamentRepository.js";
import { rosterHasMemberships } from "./rosterMembershipService.js";
import { invalidatePublicCache } from "./publicCache.js";

const substitutePoolSelect = `SELECT r.id, r.tournament_id, r.email, r.name, r.display_name, r.location, r.roles, r.mmr,
      r.steam_name, r.steam_profile, r.discord_handle, r.phone_number, r.payment_screenshot, r.notes,
      r.payment_status, r.registration_status, r.admin_notes, r.public_code, r.player_account_id,
      pa.bpc_id AS player_bpc_id, pa.slug AS player_slug,
      r.registration_flow_stage, r.card_tier, r.substitute_flag, r.payment_provider,
      r.email_verified_at, r.terms_accepted_at, r.draft_payload,
      r.archived_at, r.archived_by, r.archived_reason, r.replaced_at, r.replaced_reason,
      r.transfer_pool_eligible, r.transfer_pool_released_at,
      r.promoted_from_substitute_at, r.promoted_from_substitute_by,
      r.created_at, r.updated_at`;

async function unassignRegistrationFromWorkingTeams(client, tournamentId, registrationId) {
  await client.query(
    `DELETE FROM team_players tp
     USING players p
     WHERE tp.player_id = p.id
       AND p.tournament_id = $1
       AND p.registration_id = $2`,
    [tournamentId, registrationId],
  );
}

async function getActiveMainRosterRegistrationIds(tournamentId, rosterId, client = pool) {
  const activeRegistrationIds = new Set();
  if (!(await rosterHasMemberships(rosterId, client))) {
    return activeRegistrationIds;
  }

  const { rows } = await client.query(
    `SELECT rsp.registration_id
     FROM roster_snapshot_team_memberships rstm
     JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
     JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
     WHERE rstm.roster_snapshot_id = $1
       AND rstm.status = 'active'
       AND rst.eliminated_at IS NULL
       AND rsp.registration_id IS NOT NULL`,
    [rosterId],
  );
  for (const row of rows) {
    if (row.registration_id) activeRegistrationIds.add(row.registration_id);
  }
  return activeRegistrationIds;
}

/** Substitute-pool registrations that can be promoted to the main roster. */
export async function listPromotableSubstitutes(tournamentId) {
  const approvedRoster = await getApprovedRosterSnapshot(tournamentId);
  const activeRegistrationIds = approvedRoster
    ? await getActiveMainRosterRegistrationIds(tournamentId, approvedRoster.id)
    : new Set();

  const { rows } = await pool.query(
    `${substitutePoolSelect}
     FROM player_registrations r
     LEFT JOIN player_accounts pa ON pa.id = r.player_account_id
     WHERE r.tournament_id = $1
       AND r.substitute_flag = TRUE
       AND r.archived_at IS NULL
     ORDER BY
       CASE r.registration_status
         WHEN 'pending' THEN 0
         WHEN 'waitlisted' THEN 1
         WHEN 'approved' THEN 2
         ELSE 3
       END,
       r.created_at DESC`,
    [tournamentId],
  );

  return rows
    .filter((row) => !activeRegistrationIds.has(row.id))
    .map((row) => mapRegistrationRow(row));
}

export function registrationIsMainRosterEligible(registration) {
  if (!registration || registration.archivedAt) return false;
  if (registration.registrationStatus !== "approved") return false;
  if (registration.substituteFlag) return true;
  if (registration.paymentStatus === "paid") return true;
  if (registration.promotedFromSubstituteAt) return true;
  return false;
}

export async function promoteSubstituteToMainRoster(tournamentId, registrationId, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `SELECT * FROM player_registrations
       WHERE tournament_id = $1 AND id = $2
       FOR UPDATE`,
      [tournamentId, registrationId],
    );
    const existing = existingRows[0];
    if (!existing) {
      const error = new Error("Registration not found");
      error.status = 404;
      throw error;
    }
    if (existing.archived_at) {
      const error = new Error("Archived registrations cannot be promoted");
      error.status = 400;
      throw error;
    }
    if (!existing.substitute_flag) {
      const error = new Error("Only substitute pool entries can be promoted to the main roster");
      error.status = 400;
      throw error;
    }

    const approvedRoster = await getApprovedRosterSnapshot(tournamentId);
    if (approvedRoster) {
      const activeRegistrationIds = await getActiveMainRosterRegistrationIds(
        tournamentId,
        approvedRoster.id,
        client,
      );
      if (activeRegistrationIds.has(registrationId)) {
        const error = new Error("Player is already on an active team roster");
        error.status = 409;
        throw error;
      }
    }

    const capState = await getRegistrationCapState(tournamentId, client);
    if (capState.cap != null && capState.reached) {
      const error = new Error(
        "Main roster cap is full. Mark a player replaced or free a slot before promoting a substitute.",
      );
      error.status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `UPDATE player_registrations
       SET registration_status = 'approved',
           substitute_flag = FALSE,
           transfer_pool_eligible = FALSE,
           promoted_from_substitute_at = NOW(),
           promoted_from_substitute_by = $3,
           updated_at = NOW()
       WHERE tournament_id = $1 AND id = $2
       RETURNING *`,
      [tournamentId, registrationId, adminUserId],
    );

    await unassignRegistrationFromWorkingTeams(client, tournamentId, registrationId);
    await syncRegistrationCapState(tournamentId, { client, invalidateCache: false });

    await client.query("COMMIT");
    invalidatePublicCache();

    return {
      registration: mapRegistrationRow(rows[0]),
      capState: await getRegistrationCapState(tournamentId),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
