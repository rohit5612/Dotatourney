import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { mapRegistrationRow } from "./registrationRepository.js";
import { buildStandings } from "./standingsEngine.js";
import { getApprovedRosterSnapshot, getTournament } from "./tournamentRepository.js";
import { loadActiveTeamPlayers, rosterHasMemberships } from "./rosterMembershipService.js";
import { invalidatePublicCache } from "./publicCache.js";

function normalizeTeamName(name) {
  return String(name || "").trim().toLowerCase();
}

async function deactivateMembership(client, rosterId, teamId, playerId, adminUserId) {
  await client.query(
    `UPDATE roster_snapshot_team_memberships
     SET status = 'inactive', ended_at = NOW(), adjusted_by = $4
     WHERE roster_snapshot_id = $1
       AND snapshot_team_id = $2
       AND snapshot_player_id = $3
       AND status = 'active'`,
    [rosterId, teamId, playerId, adminUserId],
  );
}

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

/** Standings-suggested teams not yet marked eliminated on the approved roster. */
export async function suggestEliminatedTeams(tournamentId) {
  const data = await getTournament(tournamentId);
  if (!data?.approvedRoster?.teams?.length) {
    return { suggestions: [], rosterId: null };
  }

  const rosterId = data.approvedRoster.id;
  const standingsTeams = data.approvedRoster.teams;
  const standings = buildStandings(standingsTeams, data.matches, data.tournament.format);
  const eliminatedNames = new Set(
    standings.filter((row) => row.status === "eliminated").map((row) => normalizeTeamName(row.team)),
  );

  const suggestions = [];
  for (const team of data.approvedRoster.teams) {
    if (team.eliminatedAt) continue;
    if (!eliminatedNames.has(normalizeTeamName(team.name))) continue;
    const activePlayers = await loadActiveTeamPlayers(rosterId, team.id);
    suggestions.push({
      snapshotTeamId: team.id,
      teamName: team.name,
      standingsStatus: "eliminated",
      playerCount: activePlayers.length,
      rosterId,
    });
  }

  return { suggestions, rosterId };
}

/** Approved registrations released from eliminated teams and not on an active team. */
export async function listTransferPoolRegistrations(tournamentId) {
  const approvedRoster = await getApprovedRosterSnapshot(tournamentId);
  if (!approvedRoster) return [];

  const rosterId = approvedRoster.id;
  const { rows } = await pool.query(
    `SELECT r.id, r.tournament_id, r.email, r.name, r.display_name, r.location, r.roles, r.mmr,
            r.steam_name, r.steam_profile, r.discord_handle, r.phone_number, r.payment_screenshot, r.notes,
            r.payment_status, r.registration_status, r.admin_notes, r.public_code, r.player_account_id,
            pa.bpc_id AS player_bpc_id, pa.slug AS player_slug,
            r.registration_flow_stage, r.card_tier, r.substitute_flag, r.payment_provider,
            r.email_verified_at, r.terms_accepted_at, r.draft_payload,
            r.archived_at, r.archived_by, r.archived_reason, r.replaced_at, r.replaced_reason,
            r.transfer_pool_eligible, r.transfer_pool_released_at,
            r.created_at, r.updated_at
     FROM player_registrations r
     LEFT JOIN player_accounts pa ON pa.id = r.player_account_id
     WHERE r.tournament_id = $1
       AND r.transfer_pool_eligible = TRUE
       AND r.archived_at IS NULL
       AND r.registration_status = 'approved'
       AND r.substitute_flag = FALSE
     ORDER BY r.transfer_pool_released_at DESC NULLS LAST, r.display_name ASC NULLS LAST`,
    [tournamentId],
  );

  const activeRegistrationIds = new Set();
  if (await rosterHasMemberships(rosterId)) {
    const { rows: activeRows } = await pool.query(
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
    for (const row of activeRows) {
      if (row.registration_id) activeRegistrationIds.add(row.registration_id);
    }
  }

  return rows
    .filter((row) => !activeRegistrationIds.has(row.id))
    .map((row) => mapRegistrationRow(row));
}

export async function confirmTeamElimination(tournamentId, snapshotTeamId, adminUserId, { source = "manual" } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const approvedRoster = await getApprovedRosterSnapshot(tournamentId);
    if (!approvedRoster) {
      const error = new Error("An approved roster is required before marking a team eliminated");
      error.status = 400;
      throw error;
    }

    const rosterId = approvedRoster.id;
    const team = approvedRoster.teams.find((row) => row.id === snapshotTeamId);
    if (!team) {
      const error = new Error("Team not found on the approved roster");
      error.status = 404;
      throw error;
    }
    if (team.eliminatedAt) {
      const error = new Error("Team is already marked as eliminated");
      error.status = 409;
      throw error;
    }

    const activePlayers = await loadActiveTeamPlayers(rosterId, snapshotTeamId, client);
    if (!activePlayers.length) {
      const error = new Error("Team has no active players to release");
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE roster_snapshot_teams
       SET eliminated_at = NOW(), eliminated_by = $3, elimination_source = $4
       WHERE id = $1 AND roster_snapshot_id = $2 AND eliminated_at IS NULL`,
      [snapshotTeamId, rosterId, adminUserId, source],
    );

    for (const player of activePlayers) {
      await client.query(
        `INSERT INTO roster_snapshot_team_elimination_players (
          id, roster_snapshot_id, snapshot_team_id, snapshot_player_id, frozen_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (roster_snapshot_id, snapshot_team_id, snapshot_player_id) DO NOTHING`,
        [randomUUID(), rosterId, snapshotTeamId, player.id],
      );

      const { rows: regRows } = await client.query(
        `SELECT registration_id FROM roster_snapshot_players WHERE id = $1`,
        [player.id],
      );
      const registrationId = regRows[0]?.registration_id;
      if (registrationId) {
        await client.query(
          `UPDATE player_registrations
           SET transfer_pool_eligible = TRUE,
               transfer_pool_released_at = NOW(),
               updated_at = NOW()
           WHERE tournament_id = $1 AND id = $2`,
          [tournamentId, registrationId],
        );
        await unassignRegistrationFromWorkingTeams(client, tournamentId, registrationId);
      }

      if (await rosterHasMemberships(rosterId, client)) {
        await deactivateMembership(client, rosterId, snapshotTeamId, player.id, adminUserId);
      }
    }

    await client.query("COMMIT");
    invalidatePublicCache();
    return {
      snapshotTeamId,
      teamName: team.name,
      playersReleased: activePlayers.length,
      approvedRoster: await getApprovedRosterSnapshot(tournamentId),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Clear transfer pool flag when player is assigned to a non-eliminated team. */
export async function clearTransferPoolOnAssignment(tournamentId, registrationId, client = pool) {
  if (!registrationId) return;
  await client.query(
    `UPDATE player_registrations
     SET transfer_pool_eligible = FALSE,
         updated_at = NOW()
     WHERE tournament_id = $1 AND id = $2 AND transfer_pool_eligible = TRUE`,
    [tournamentId, registrationId],
  );
}

/** Batch clear transfer pool for players assigned to non-eliminated teams on save. */
export async function clearTransferPoolForAssignedPlayers(tournamentId, players, teams, client = pool) {
  const approvedRoster = await getApprovedRosterSnapshot(tournamentId);
  if (!approvedRoster) return;

  const eliminatedTeamIds = new Set(
    (approvedRoster.teams || []).filter((team) => team.eliminatedAt).map((team) => team.id),
  );
  const teamById = new Map((teams || []).map((team) => [team.id, team]));

  for (const player of players || []) {
    if (!player.teamId || !player.registrationId) continue;
    const team = teamById.get(player.teamId);
    if (!team) continue;
    const snapshotTeam = approvedRoster.teams.find(
      (row) => row.id === team.id || row.sourceTeamId === team.id || normalizeTeamName(row.name) === normalizeTeamName(team.name),
    );
    if (snapshotTeam && eliminatedTeamIds.has(snapshotTeam.id)) continue;
    await clearTransferPoolOnAssignment(tournamentId, player.registrationId, client);
  }
}

export async function isEliminatedSnapshotTeam(rosterId, snapshotTeamId, client = pool) {
  const { rows } = await client.query(
    `SELECT eliminated_at FROM roster_snapshot_teams WHERE id = $1 AND roster_snapshot_id = $2`,
    [snapshotTeamId, rosterId],
  );
  return Boolean(rows[0]?.eliminated_at);
}
