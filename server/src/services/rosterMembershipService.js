import { pool } from "../db/pool.js";

function normalizeRolesArray(roles, role) {
  if (Array.isArray(roles) && roles.length) return roles;
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // ignore invalid JSON
    }
  }
  const single = String(role || "").trim();
  return single ? [single] : [];
}

function mapRosterPlayerRow(row) {
  const name = row.display_name || row.name;
  return {
    id: row.id,
    name,
    displayName: name,
    role: row.role,
    roles: normalizeRolesArray(row.roles, row.role),
    mmr: row.mmr,
    isCaptain: Boolean(row.is_captain),
    playerAccountId: row.player_account_id || null,
    slug: row.player_slug || null,
    bpcId: row.bpc_id || null,
  };
}

/** Whether this roster snapshot uses membership rows (post-migration). */
export async function rosterHasMemberships(rosterId, client = pool) {
  const { rows } = await client.query(
    `SELECT 1 FROM roster_snapshot_team_memberships WHERE roster_snapshot_id = $1 LIMIT 1`,
    [rosterId],
  );
  return Boolean(rows[0]);
}

/** Active roster players for one snapshot team (membership-aware). */
export async function loadActiveTeamPlayers(rosterId, teamId, client = pool) {
  const hasMemberships = await rosterHasMemberships(rosterId, client);
  if (hasMemberships) {
    const { rows } = await client.query(
      `SELECT rsp.id, rsp.player_account_id, rsp.display_name, rsp.name, rsp.role, rsp.roles, rsp.mmr,
              rsp.is_captain, pa.slug AS player_slug, pa.bpc_id
       FROM roster_snapshot_team_memberships rstm
       JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
       LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
       WHERE rstm.roster_snapshot_id = $1
         AND rstm.snapshot_team_id = $2
         AND rstm.status = 'active'
       ORDER BY rsp.is_captain DESC, rsp.display_name ASC NULLS LAST, rsp.name ASC`,
      [rosterId, teamId],
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT rsp.id, rsp.player_account_id, rsp.display_name, rsp.name, rsp.role, rsp.roles, rsp.mmr,
            rsp.is_captain, pa.slug AS player_slug, pa.bpc_id
     FROM roster_snapshot_team_players rstp
     JOIN roster_snapshot_players rsp ON rsp.id = rstp.player_id
     LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
     WHERE rstp.roster_snapshot_id = $1 AND rstp.team_id = $2
     ORDER BY rsp.is_captain DESC, rsp.display_name ASC NULLS LAST, rsp.name ASC`,
    [rosterId, teamId],
  );
  return rows;
}

/** Active roster players for a team by name (lineup seeding). */
export async function loadActiveTeamPlayersByName(rosterId, teamName, client = pool) {
  const { rows: teamRows } = await client.query(
    `SELECT id FROM roster_snapshot_teams
     WHERE roster_snapshot_id = $1 AND lower(name) = lower($2)
     LIMIT 1`,
    [rosterId, teamName],
  );
  const teamId = teamRows[0]?.id;
  if (!teamId) return [];
  return loadActiveTeamPlayers(rosterId, teamId, client);
}

/** Former (inactive) roster players for one snapshot team. */
export async function loadFormerTeamPlayers(rosterId, teamId, client = pool) {
  const hasMemberships = await rosterHasMemberships(rosterId, client);
  if (!hasMemberships) return [];

  const { rows } = await client.query(
    `SELECT rsp.id, rsp.player_account_id, rsp.display_name, rsp.name, rsp.role, rsp.roles, rsp.mmr,
            rsp.is_captain, pa.slug AS player_slug, pa.bpc_id,
            rstm.started_at, rstm.ended_at
     FROM roster_snapshot_team_memberships rstm
     JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
     LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
     WHERE rstm.roster_snapshot_id = $1
       AND rstm.snapshot_team_id = $2
       AND rstm.status = 'inactive'
     ORDER BY rstm.ended_at DESC NULLS LAST, rsp.display_name ASC NULLS LAST`,
    [rosterId, teamId],
  );
  return rows;
}

/** Count completed matches where the player actually appeared (lineup is source of truth). */
export async function countPlayedMatchesForStint(
  playerAccountId,
  tournamentId,
  teamName,
  { startedAt = null, endedAt = null, seasonStatus = null } = {},
) {
  const params = [playerAccountId, tournamentId, teamName];
  let timeFilter = "";
  // For concluded seasons, lineup rows reflect historical appearances — ignore stint
  // windows that may have been stamped at admin/script time instead of match time.
  const useStintWindow = seasonStatus !== "concluded";
  if (useStintWindow && startedAt) {
    params.push(startedAt);
    timeFilter += ` AND COALESCE(ss.start_at, m.created_at) >= $${params.length}`;
  }
  if (useStintWindow && endedAt) {
    params.push(endedAt);
    timeFilter += ` AND COALESCE(ss.start_at, m.created_at) <= $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT mlp.match_id)::int AS count
     FROM match_lineup_players mlp
     JOIN matches m ON m.id = mlp.match_id
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE mlp.player_account_id = $1
       AND m.tournament_id = $2
       AND lower(mlp.team_name) = lower($3)
       AND mlp.is_substitute = FALSE
       AND (
         lower(COALESCE(m.status, '')) IN ('completed', 'done', 'finished')
         OR lower(COALESCE(ss.status, '')) = 'finished'
         OR m.winner IS NOT NULL AND TRIM(m.winner) <> ''
       )
       ${timeFilter}`,
    params,
  );
  return rows[0]?.count ?? 0;
}

/** All membership stints for a player account across tournaments. */
export async function loadAllMembershipStintsForAccount(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT rstm.id AS membership_id,
            rstm.status,
            rstm.started_at,
            rstm.ended_at,
            rstm.roster_snapshot_id,
            rs.name AS roster_name,
            rs.approved_at,
            rst.id AS team_id,
            rst.name AS team_name,
            rst.logo_url,
            rst.accent_color,
            t.id AS tournament_id,
            t.name AS tournament_name,
            t.slug AS tournament_slug,
            s.number AS season_number,
            s.slug AS season_slug,
            s.status AS season_status,
            pr.registration_status
     FROM roster_snapshot_team_memberships rstm
     JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
     JOIN roster_snapshots rs ON rs.id = rstm.roster_snapshot_id AND rs.status = 'approved'
     JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
     JOIN tournaments t ON t.id = rs.tournament_id
     LEFT JOIN seasons s ON s.tournament_id = t.id
     LEFT JOIN player_registrations pr ON pr.id = rsp.registration_id
     WHERE rsp.player_account_id = $1
     ORDER BY rstm.started_at DESC NULLS LAST, rs.approved_at DESC`,
    [playerAccountId],
  );
  return rows;
}

/** Map teams → `players[]` using membership-filtered teamPlayers. */
export function buildTeamsWithActivePlayers(approvedRoster) {
  if (!approvedRoster?.teams?.length) return [];

  const teamPlayers = approvedRoster.teamPlayers || [];
  const players = approvedRoster.players || [];

  return approvedRoster.teams.map((team) => ({
    ...team,
    players: players.filter((player) =>
      teamPlayers.some((record) => record.team_id === team.id && record.player_id === player.id),
    ),
  }));
}

/** Overlay snapshot team metadata with active roster players (by team name). */
export function mergeSnapshotTeamsWithRoster(snapshotTeams, rosterTeams) {
  if (!rosterTeams?.length) return snapshotTeams || [];
  const rosterByName = new Map(
    rosterTeams.map((team) => [String(team.name || "").trim().toLowerCase(), team]),
  );

  if (!snapshotTeams?.length) return rosterTeams;

  return snapshotTeams.map((team) => {
    const roster = rosterByName.get(String(team.name || "").trim().toLowerCase());
    if (!roster) return team;
    return {
      ...team,
      logoUrl: team.logoUrl || team.logo_url || roster.logoUrl || roster.logo_url || "",
      accentColor: team.accentColor || team.accent_color || roster.accentColor || roster.accent_color || "",
      players: roster.players?.length ? roster.players : team.players || [],
    };
  });
}

/** Active team assignment for a player on a tournament (membership-aware). */
export async function findActivePlayerTeamOnTournament(playerAccountId, tournamentId) {
  const { rows: rosterRows } = await pool.query(
    `SELECT id FROM roster_snapshots
     WHERE tournament_id = $1 AND status = 'approved'
     ORDER BY approved_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [tournamentId],
  );
  const rosterId = rosterRows[0]?.id;
  if (!rosterId) return null;

  const hasMemberships = await rosterHasMemberships(rosterId);
  if (hasMemberships) {
    const { rows } = await pool.query(
      `SELECT rsp.id AS player_id, rsp.name, rsp.display_name, rsp.role, rsp.roles, rsp.mmr,
              rst.id AS team_id, rst.name AS team_name, rst.logo_url, rst.accent_color, rst.captain
       FROM roster_snapshot_team_memberships rstm
       JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
       JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
       WHERE rstm.roster_snapshot_id = $1
         AND rstm.status = 'active'
         AND rsp.player_account_id = $2
       LIMIT 1`,
      [rosterId, playerAccountId],
    );
    const row = rows[0];
    if (!row) return null;

    const teammates = await loadActiveTeamPlayers(rosterId, row.team_id);
    return {
      tournamentId,
      rosterSnapshotId: rosterId,
      team: {
        id: row.team_id,
        name: row.team_name,
        logoUrl: row.logo_url || "",
        accentColor: row.accent_color || "",
        captain: row.captain || "",
      },
      player: {
        id: row.player_id,
        name: row.display_name || row.name,
        displayName: row.display_name || row.name,
        role: row.role,
        roles: normalizeRolesArray(row.roles, row.role),
        mmr: row.mmr,
      },
      teammates: teammates.map(mapRosterPlayerRow),
      formerTeammates: (await loadFormerTeamPlayers(rosterId, row.team_id)).map((p) => ({
        ...mapRosterPlayerRow(p),
        startedAt: p.started_at,
        endedAt: p.ended_at,
      })),
    };
  }

  const { rows } = await pool.query(
    `SELECT rsp.id AS player_id, rsp.name, rsp.display_name, rsp.role, rsp.roles, rsp.mmr,
            rst.id AS team_id, rst.name AS team_name, rst.logo_url, rst.accent_color, rst.captain
     FROM roster_snapshot_players rsp
     JOIN roster_snapshot_team_players rstp ON rstp.player_id = rsp.id
     JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     WHERE rst.roster_snapshot_id = $1 AND rsp.player_account_id = $2
     LIMIT 1`,
    [rosterId, playerAccountId],
  );
  const row = rows[0];
  if (!row) return null;

  const teammates = await loadActiveTeamPlayers(rosterId, row.team_id);
  return {
    tournamentId,
    rosterSnapshotId: rosterId,
    team: {
      id: row.team_id,
      name: row.team_name,
      logoUrl: row.logo_url || "",
      accentColor: row.accent_color || "",
      captain: row.captain || "",
    },
    player: {
      id: row.player_id,
      name: row.display_name || row.name,
      displayName: row.display_name || row.name,
      role: row.role,
      roles: normalizeRolesArray(row.roles, row.role),
      mmr: row.mmr,
    },
    teammates: teammates.map(mapRosterPlayerRow),
    formerTeammates: [],
  };
}

/** Match IDs for future/unplayed matches in a tournament. */
export async function listFutureMatchIdsForTournament(tournamentId) {
  const { rows } = await pool.query(
    `SELECT m.id
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.tournament_id = $1
       AND lower(COALESCE(m.status, '')) NOT IN ('completed', 'done', 'finished')
       AND (m.winner IS NULL OR TRIM(m.winner) = '')
       AND (ss.start_at IS NULL OR ss.start_at > NOW())`,
    [tournamentId],
  );
  return rows.map((r) => r.id);
}

/** Re-seed lineups for future matches after roster changes. */
export async function reseedFutureMatchLineups(tournamentId) {
  const { seedMatchLineupsForTournament } = await import("./matchLineupService.js");
  const matchIds = await listFutureMatchIdsForTournament(tournamentId);
  if (!matchIds.length) return { seeded: 0 };
  return seedMatchLineupsForTournament(tournamentId, matchIds);
}
