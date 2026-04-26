import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export async function createTournament(payload) {
  const id = randomUUID();
  const query = `
    INSERT INTO tournaments (
      id, name, slug, format, series_type, team_count, dark_mode, series_rules,
      description, prize_pool, start_date, end_date, registration_deadline,
      discord_url, rulebook, announcements, visibility_mode
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        start_date = $11,
        end_date = $12,
        registration_deadline = $13,
        discord_url = $14,
        rulebook = $15,
        announcements = $16,
        visibility_mode = $17,
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
        player.roles || (player.role ? [player.role] : []),
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

export async function getPublicTournament(identifier = "the-forge") {
  const result = await pool.query("SELECT * FROM tournaments WHERE slug = $1 OR id::text = $1 ORDER BY created_at DESC LIMIT 1", [
    identifier,
  ]);
  const tournament = result.rows[0];
  if (!tournament) return null;
  return getTournament(tournament.id);
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
