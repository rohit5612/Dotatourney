import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function createTournament(payload) {
  const id = randomUUID();
  const query = `
    INSERT INTO tournaments (
      id, name, slug, format, series_type, team_count, dark_mode, series_rules,
      description, prize_pool, entry_fee, start_date, end_date, registration_deadline,
      discord_url, rulebook, announcements, visibility_mode, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft')
    RETURNING *;
  `;
  const values = [
    id,
    payload.name,
    payload.slug || null,
    payload.format,
    payload.seriesType,
    payload.teamCount,
    Boolean(payload.darkMode),
    payload.seriesRules || {},
    payload.description || "",
    payload.prizePool || "",
    payload.entryFee || "",
    payload.startDate || null,
    payload.endDate || null,
    payload.registrationDeadline || null,
    payload.discordUrl || "",
    payload.rulebook || "",
    payload.announcements || [],
    payload.visibilityMode || "demo",
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function updateTournament(tournamentId, payload) {
  const query = `
    UPDATE tournaments
    SET name = $2,
        slug = $3,
        format = $4,
        series_type = $5,
        team_count = $6,
        dark_mode = $7,
        series_rules = $8,
        description = $9,
        prize_pool = $10,
        entry_fee = $11,
        start_date = $12,
        end_date = $13,
        registration_deadline = $14,
        discord_url = $15,
        rulebook = $16,
        announcements = $17,
        visibility_mode = $18,
        status = CASE WHEN is_published THEN status ELSE COALESCE($19, status) END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;
  const values = [
    tournamentId,
    payload.name,
    payload.slug || null,
    payload.format,
    payload.seriesType,
    payload.teamCount,
    Boolean(payload.darkMode),
    payload.seriesRules || {},
    payload.description || "",
    payload.prizePool || "",
    payload.entryFee || "",
    payload.startDate || null,
    payload.endDate || null,
    payload.registrationDeadline || null,
    payload.discordUrl || "",
    payload.rulebook || "",
    payload.announcements || [],
    payload.visibilityMode || "demo",
    payload.status || "draft",
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listTournaments() {
  const { rows } = await pool.query(
    `SELECT id, name, slug, format, series_type, team_count, status, is_published,
            published_at, start_date, end_date, registration_deadline, prize_pool, entry_fee,
            visibility_mode, updated_at, created_at
     FROM tournaments
     WHERE status <> 'archived'
     ORDER BY is_published DESC, updated_at DESC, created_at DESC`,
  );
  return rows;
}

export async function getTournament(tournamentId) {
  const tournamentResult = await pool.query("SELECT * FROM tournaments WHERE id = $1", [tournamentId]);
  if (!tournamentResult.rows[0]) {
    return null;
  }

  const teamsResult = await pool.query(
    "SELECT id, name, captain, abbr, seed FROM teams WHERE tournament_id = $1 ORDER BY seed ASC NULLS LAST, created_at ASC",
    [tournamentId],
  );
  const playersResult = await pool.query(
    `SELECT id, registration_id AS "registrationId", name, role, roles, mmr, steam_name AS "steamName",
            steam_profile AS "steamProfile", discord_handle AS "discordHandle", location, is_captain AS "isCaptain"
     FROM players
     WHERE tournament_id = $1
     ORDER BY created_at ASC`,
    [tournamentId],
  );
  const teamPlayersResult = await pool.query(
    "SELECT team_id, player_id FROM team_players WHERE tournament_id = $1",
    [tournamentId],
  );
  const matchesResult = await pool.query(
    "SELECT id, stage_key AS \"stageKey\", round_index AS \"roundIndex\", match_index AS \"matchIndex\", team1, team2, winner, status, stream, slot_at AS \"slotAt\", meta FROM matches WHERE tournament_id = $1 ORDER BY stage_key ASC, round_index ASC, match_index ASC",
    [tournamentId],
  );
  const scheduleResult = await pool.query(
    "SELECT id, match_id AS \"matchId\", start_at AS \"startAt\", stream, status, notes FROM schedule_slots WHERE tournament_id = $1 ORDER BY start_at ASC",
    [tournamentId],
  );

  return {
    tournament: tournamentResult.rows[0],
    teams: teamsResult.rows,
    players: playersResult.rows,
    teamPlayers: teamPlayersResult.rows,
    matches: matchesResult.rows,
    schedule: scheduleResult.rows,
    approvedRoster: await getApprovedRosterSnapshot(tournamentId),
  };
}

export async function replaceTeamsAndPlayers(tournamentId, teams, players, teamPlayers) {
  await pool.query("DELETE FROM team_players WHERE tournament_id = $1", [tournamentId]);
  await pool.query("DELETE FROM players WHERE tournament_id = $1", [tournamentId]);
  await pool.query("DELETE FROM teams WHERE tournament_id = $1", [tournamentId]);

  for (const team of teams) {
    await pool.query(
      "INSERT INTO teams (id, tournament_id, name, captain, abbr, seed) VALUES ($1, $2, $3, $4, $5, $6)",
      [team.id, tournamentId, team.name, team.captain, team.abbr, team.seed],
    );
  }

  for (const player of players) {
    await pool.query(
      `INSERT INTO players (
        id, tournament_id, registration_id, name, role, roles, mmr, steam_name,
        steam_profile, discord_handle, location, is_captain
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        player.id,
        tournamentId,
        player.registrationId || null,
        player.name,
        player.role,
        JSON.stringify(player.roles || (player.role ? [player.role] : [])),
        player.mmr || null,
        player.steamName || "",
        player.steamProfile || "",
        player.discordHandle || "",
        player.location || "",
        Boolean(player.isCaptain),
      ],
    );
  }

  for (const record of teamPlayers) {
    await pool.query(
      "INSERT INTO team_players (id, tournament_id, team_id, player_id) VALUES ($1, $2, $3, $4)",
      [record.id, tournamentId, record.teamId, record.playerId],
    );
  }
}

async function loadWorkingRoster(client, tournamentId) {
  const teamsResult = await client.query(
    "SELECT id, name, captain, abbr, seed FROM teams WHERE tournament_id = $1 ORDER BY seed ASC NULLS LAST, created_at ASC",
    [tournamentId],
  );
  const playersResult = await client.query(
    `SELECT id, registration_id AS "registrationId", name, role, roles, mmr, steam_name AS "steamName",
            steam_profile AS "steamProfile", discord_handle AS "discordHandle", location, is_captain AS "isCaptain"
     FROM players
     WHERE tournament_id = $1
     ORDER BY created_at ASC`,
    [tournamentId],
  );
  const teamPlayersResult = await client.query(
    "SELECT team_id AS \"teamId\", player_id AS \"playerId\" FROM team_players WHERE tournament_id = $1",
    [tournamentId],
  );

  return {
    teams: teamsResult.rows,
    players: playersResult.rows,
    teamPlayers: teamPlayersResult.rows,
  };
}

async function replaceRosterSnapshotContents(client, tournamentId, rosterId) {
  const roster = await loadWorkingRoster(client, tournamentId);
  const teamIdMap = new Map();
  const playerIdMap = new Map();

  await client.query("DELETE FROM roster_snapshot_team_players WHERE roster_snapshot_id = $1", [rosterId]);
  await client.query("DELETE FROM roster_snapshot_players WHERE roster_snapshot_id = $1", [rosterId]);
  await client.query("DELETE FROM roster_snapshot_teams WHERE roster_snapshot_id = $1", [rosterId]);

  for (const team of roster.teams) {
    const snapshotTeamId = randomUUID();
    teamIdMap.set(team.id, snapshotTeamId);
    await client.query(
      `INSERT INTO roster_snapshot_teams (id, roster_snapshot_id, tournament_id, source_team_id, name, captain, abbr, seed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [snapshotTeamId, rosterId, tournamentId, team.id, team.name, team.captain, team.abbr, team.seed],
    );
  }

  for (const player of roster.players) {
    const snapshotPlayerId = randomUUID();
    playerIdMap.set(player.id, snapshotPlayerId);
    await client.query(
      `INSERT INTO roster_snapshot_players (
        id, roster_snapshot_id, tournament_id, source_player_id, registration_id, name, role, roles, mmr,
        steam_name, steam_profile, discord_handle, location, is_captain
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        snapshotPlayerId,
        rosterId,
        tournamentId,
        player.id,
        player.registrationId || null,
        player.name,
        player.role,
        JSON.stringify(player.roles || (player.role ? [player.role] : [])),
        player.mmr || null,
        player.steamName || "",
        player.steamProfile || "",
        player.discordHandle || "",
        player.location || "",
        Boolean(player.isCaptain),
      ],
    );
  }

  for (const record of roster.teamPlayers) {
    const snapshotTeamId = teamIdMap.get(record.teamId);
    const snapshotPlayerId = playerIdMap.get(record.playerId);
    if (!snapshotTeamId || !snapshotPlayerId) continue;
    await client.query(
      `INSERT INTO roster_snapshot_team_players (id, roster_snapshot_id, tournament_id, team_id, player_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), rosterId, tournamentId, snapshotTeamId, snapshotPlayerId],
    );
  }
}

export async function listRosterSnapshots(tournamentId) {
  const { rows } = await pool.query(
    `SELECT rs.id,
            rs.name,
            rs.status,
            rs.approved_at AS "approvedAt",
            rs.approved_by AS "approvedBy",
            rs.created_at AS "createdAt",
            rs.updated_at AS "updatedAt",
            COUNT(DISTINCT rst.id)::int AS "teamCount",
            COUNT(DISTINCT rsp.id)::int AS "playerCount",
            COUNT(DISTINCT rstp.player_id)::int AS "assignedPlayerCount"
     FROM roster_snapshots rs
     LEFT JOIN roster_snapshot_teams rst ON rst.roster_snapshot_id = rs.id
     LEFT JOIN roster_snapshot_players rsp ON rsp.roster_snapshot_id = rs.id
     LEFT JOIN roster_snapshot_team_players rstp ON rstp.roster_snapshot_id = rs.id
     WHERE rs.tournament_id = $1
     GROUP BY rs.id
     ORDER BY rs.status = 'approved' DESC, rs.updated_at DESC, rs.created_at DESC`,
    [tournamentId],
  );
  return rows;
}

export async function getRosterSnapshot(tournamentId, rosterId) {
  const snapshotResult = await pool.query(
    `SELECT id, tournament_id, name, status, approved_at AS "approvedAt", approved_by AS "approvedBy",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM roster_snapshots
     WHERE tournament_id = $1 AND id = $2`,
    [tournamentId, rosterId],
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;

  const teamsResult = await pool.query(
    `SELECT id, source_team_id AS "sourceTeamId", name, captain, abbr, seed
     FROM roster_snapshot_teams
     WHERE roster_snapshot_id = $1
     ORDER BY seed ASC NULLS LAST, created_at ASC`,
    [rosterId],
  );
  const playersResult = await pool.query(
    `SELECT id, source_player_id AS "sourcePlayerId", registration_id AS "registrationId", name, role, roles, mmr,
            steam_name AS "steamName", steam_profile AS "steamProfile", discord_handle AS "discordHandle",
            location, is_captain AS "isCaptain"
     FROM roster_snapshot_players
     WHERE roster_snapshot_id = $1
     ORDER BY created_at ASC`,
    [rosterId],
  );
  const teamPlayersResult = await pool.query(
    `SELECT team_id, player_id
     FROM roster_snapshot_team_players
     WHERE roster_snapshot_id = $1`,
    [rosterId],
  );

  return {
    ...snapshot,
    teams: teamsResult.rows,
    players: playersResult.rows,
    teamPlayers: teamPlayersResult.rows,
  };
}

export async function getApprovedRosterSnapshot(tournamentId) {
  const { rows } = await pool.query(
    "SELECT id FROM roster_snapshots WHERE tournament_id = $1 AND status = 'approved' ORDER BY approved_at DESC LIMIT 1",
    [tournamentId],
  );
  if (!rows[0]) return null;
  return getRosterSnapshot(tournamentId, rows[0].id);
}

export async function createRosterSnapshot(tournamentId, name) {
  const client = await pool.connect();
  const rosterId = randomUUID();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO roster_snapshots (id, tournament_id, name)
       VALUES ($1, $2, $3)
       RETURNING id, name, status, approved_at AS "approvedAt", approved_by AS "approvedBy",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [rosterId, tournamentId, name],
    );
    await replaceRosterSnapshotContents(client, tournamentId, rosterId);
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRosterSnapshot(tournamentId, rosterId, payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, status FROM roster_snapshots WHERE tournament_id = $1 AND id = $2", [
      tournamentId,
      rosterId,
    ]);
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    if (payload.replaceFromCurrent) {
      await replaceRosterSnapshotContents(client, tournamentId, rosterId);
      await client.query(
        `UPDATE roster_snapshots
         SET name = COALESCE($3, name), status = 'draft', approved_at = NULL, approved_by = NULL, updated_at = NOW()
         WHERE tournament_id = $1 AND id = $2`,
        [tournamentId, rosterId, payload.name || null],
      );
    } else {
      await client.query(
        "UPDATE roster_snapshots SET name = COALESCE($3, name), updated_at = NOW() WHERE tournament_id = $1 AND id = $2",
        [tournamentId, rosterId, payload.name || null],
      );
    }

    await client.query("COMMIT");
    return getRosterSnapshot(tournamentId, rosterId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function approveRosterSnapshot(tournamentId, rosterId, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM roster_snapshots WHERE tournament_id = $1 AND id = $2", [
      tournamentId,
      rosterId,
    ]);
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE roster_snapshots SET status = 'draft', approved_at = NULL, approved_by = NULL, updated_at = NOW() WHERE tournament_id = $1",
      [tournamentId],
    );
    const { rows } = await client.query(
      `UPDATE roster_snapshots
       SET status = 'approved', approved_at = NOW(), approved_by = $3, updated_at = NOW()
       WHERE tournament_id = $1 AND id = $2
       RETURNING id`,
      [tournamentId, rosterId, adminUserId],
    );
    await client.query("COMMIT");
    return getRosterSnapshot(tournamentId, rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRosterSnapshot(tournamentId, rosterId) {
  const { rows } = await pool.query(
    `DELETE FROM roster_snapshots
     WHERE tournament_id = $1 AND id = $2
     RETURNING id, name, status`,
    [tournamentId, rosterId],
  );
  return rows[0] || null;
}

export async function getPublicTournament(identifier = "the-forge") {
  const result = await pool.query("SELECT * FROM tournaments WHERE slug = $1 OR id::text = $1 ORDER BY created_at DESC LIMIT 1", [
    identifier,
  ]);
  const tournament = result.rows[0];
  if (!tournament) return null;
  return getTournament(tournament.id);
}

export async function getPublishedTournament() {
  const result = await pool.query("SELECT id FROM tournaments WHERE is_published = TRUE ORDER BY published_at DESC LIMIT 1");
  const tournament = result.rows[0];
  if (!tournament) return null;
  return getTournament(tournament.id);
}

export async function publishTournament(tournamentId, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE tournaments SET is_published = FALSE, status = CASE WHEN status = 'published' THEN 'approved' ELSE status END WHERE is_published = TRUE",
    );
    const { rows } = await client.query(
      `UPDATE tournaments
       SET is_published = TRUE, status = 'published', published_at = NOW(), published_by = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tournamentId, adminUserId],
    );
    await client.query("COMMIT");
    return rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function unpublishTournament(tournamentId) {
  const { rows } = await pool.query(
    `UPDATE tournaments
     SET is_published = FALSE, status = 'approved', published_at = NULL, published_by = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [tournamentId],
  );
  return rows[0] || null;
}

export async function deleteDraftTournament(tournamentId) {
  const { rows } = await pool.query(
    `UPDATE tournaments
     SET status = 'archived', is_published = FALSE, updated_at = NOW()
     WHERE id = $1 AND status = 'draft' AND is_published = FALSE
     RETURNING *`,
    [tournamentId],
  );
  return rows[0] || null;
}

export async function replaceMatches(tournamentId, matches) {
  await pool.query("DELETE FROM matches WHERE tournament_id = $1", [tournamentId]);
  for (const match of matches) {
    await pool.query(
      "INSERT INTO matches (id, tournament_id, stage_key, round_index, match_index, team1, team2, winner, status, stream, slot_at, meta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
      [
        match.id,
        tournamentId,
        match.stageKey,
        match.roundIndex,
        match.matchIndex,
        match.team1,
        match.team2,
        match.winner,
        match.status,
        match.stream,
        match.slotAt,
        match.meta ?? {},
      ],
    );
  }
}

export async function updateMatch(tournamentId, matchId, update) {
  const { rows } = await pool.query(
    "UPDATE matches SET winner = $3, status = $4, stream = $5, slot_at = $6, team1 = $7, team2 = $8, meta = $9, updated_at = NOW() WHERE tournament_id = $1 AND id = $2 RETURNING *",
    [
      tournamentId,
      matchId,
      update.winner,
      update.status,
      update.stream,
      update.slotAt,
      update.team1,
      update.team2,
      update.meta ?? {},
    ],
  );
  return rows[0];
}

export async function replaceSchedule(tournamentId, schedule) {
  await pool.query("DELETE FROM schedule_slots WHERE tournament_id = $1", [tournamentId]);
  for (const slot of schedule) {
    await pool.query(
      "INSERT INTO schedule_slots (id, tournament_id, match_id, start_at, stream, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [slot.id, tournamentId, slot.matchId, slot.startAt, slot.stream, slot.status, slot.notes],
    );
  }
}
