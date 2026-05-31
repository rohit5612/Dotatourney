import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { defaultGroupKeysForTeams } from "./groupAssignment.js";
import { getPlayerRegistrationById } from "./registrationRepository.js";

function parseMeta(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return { ...raw };
  }
  return {};
}

/** @param {unknown} value */
function pickIntScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function hydrateMatchRow(row) {
  if (!row) return null;
  const { team1_score, team2_score, meta: rawMeta, ...rest } = row;
  const m = parseMeta(rawMeta);
  const t1 = team1_score != null ? team1_score : pickIntScore(m.team1Score);
  const t2 = team2_score != null ? team2_score : pickIntScore(m.team2Score);
  const scoreStr =
    typeof m.score === "string" && m.score.length > 0
      ? m.score
      : t1 != null && t2 != null
        ? `${t1}-${t2}`
        : m.score || "";
  return {
    ...rest,
    meta: {
      ...m,
      team1Score: t1 != null ? t1 : m.team1Score ?? null,
      team2Score: t2 != null ? t2 : m.team2Score ?? null,
      score: scoreStr,
    },
  };
}

function scoresFromUpdateMeta(update) {
  const m = parseMeta(update.meta);
  return {
    t1: pickIntScore(m.team1Score),
    t2: pickIntScore(m.team2Score),
  };
}

function serializePrizePoolBreakdown(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  return value || "";
}

/** Fields frozen for the public site until the next publish. */
export function buildPublishedSnapshotFromRow(row) {
  if (!row) return null;
  return {
    name: row.name,
    slug: row.slug,
    format: row.format,
    series_type: row.series_type,
    team_count: row.team_count,
    description: row.description,
    prize_pool: row.prize_pool,
    prize_pool_breakdown: row.prize_pool_breakdown,
    entry_fee: row.entry_fee,
    start_date: row.start_date,
    end_date: row.end_date,
    registration_deadline: row.registration_deadline,
    discord_url: row.discord_url,
    rulebook: row.rulebook,
    announcements: row.announcements,
    banner_announcements: row.banner_announcements,
    tournament_honors: row.tournament_honors,
    registration_code_prefix: row.registration_code_prefix,
    payment_qr_image: row.payment_qr_image,
    payment_upi_id: row.payment_upi_id,
  };
}

export function applyPublishedSnapshot(data) {
  if (!data?.tournament) return data;
  const t = data.tournament;
  const snap = t.published_snapshot;
  const { published_snapshot: _snap, ...base } = t;
  if (snap && typeof snap === "object" && !Array.isArray(snap)) {
    const { visibility_mode: _frozenVis, registrations_open: _frozenRegOpen, ...snapRest } = snap;
    /** Always use live copy for fields ops tweak often without re-publish. */
    const liveAnnouncements = base.announcements;
    const liveBannerAnnouncements = base.banner_announcements;
    const liveDescription = base.description;
    const liveHonors = base.tournament_honors;
    return {
      ...data,
      tournament: {
        ...base,
        ...snapRest,
        ...(liveAnnouncements !== undefined && liveAnnouncements !== null ? { announcements: liveAnnouncements } : {}),
        ...(liveBannerAnnouncements !== undefined && liveBannerAnnouncements !== null
          ? { banner_announcements: liveBannerAnnouncements }
          : {}),
        ...(liveHonors !== undefined && liveHonors !== null ? { tournament_honors: liveHonors } : {}),
        description: liveDescription,
      },
    };
  }
  return { ...data, tournament: base };
}

export async function createTournament(payload) {
  const id = randomUUID();
  const query = `
    INSERT INTO tournaments (
      id, name, slug, format, series_type, team_count, dark_mode, series_rules,
      description, prize_pool, prize_pool_breakdown, entry_fee, start_date, end_date, registration_deadline,
      discord_url, rulebook, live_youtube_url, announcements, banner_announcements, tournament_honors, visibility_mode, bracket_active, status,
      registration_code_prefix, registration_code_seq, payment_qr_image, payment_upi_id, registrations_open
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'draft',
      $23, $24, $25, $26, $27, $28)
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
    serializePrizePoolBreakdown(payload.prizePoolBreakdown),
    payload.entryFee || "",
    payload.startDate || null,
    payload.endDate || null,
    payload.registrationDeadline || null,
    payload.discordUrl || "",
    payload.rulebook || "",
    payload.liveYoutubeUrl || "",
    JSON.stringify(payload.announcements || []),
    JSON.stringify(payload.bannerAnnouncements || []),
    JSON.stringify(payload.tournamentHonors || { displayPodiumCount: 2, mvp: null, customCards: [] }),
    payload.visibilityMode || "demo",
    Boolean(payload.bracketActive),
    (payload.registrationCodePrefix || "BPC").toString().slice(0, 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || "BPC",
    Number.isFinite(Number(payload.registrationCodeSeq)) ? Number(payload.registrationCodeSeq) : 0,
    payload.paymentQrImage || "",
    payload.paymentUpiId || "",
    Boolean(payload.registrationsOpen),
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
        prize_pool_breakdown = $11,
        entry_fee = $12,
        start_date = $13,
        end_date = $14,
        registration_deadline = $15,
        discord_url = $16,
        rulebook = $17,
        live_youtube_url = $18,
        announcements = $19,
        banner_announcements = $20,
        tournament_honors = $21,
        visibility_mode = $22,
        bracket_active = $23,
        status = CASE WHEN is_published THEN status ELSE COALESCE($24, status) END,
        registration_code_prefix = $25,
        payment_qr_image = $26,
        payment_upi_id = $27,
        registrations_open = $28,
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
    serializePrizePoolBreakdown(payload.prizePoolBreakdown),
    payload.entryFee || "",
    payload.startDate || null,
    payload.endDate || null,
    payload.registrationDeadline || null,
    payload.discordUrl || "",
    payload.rulebook || "",
    payload.liveYoutubeUrl || "",
    JSON.stringify(payload.announcements || []),
    JSON.stringify(payload.bannerAnnouncements || []),
    JSON.stringify(payload.tournamentHonors || { displayPodiumCount: 2, mvp: null, customCards: [] }),
    payload.visibilityMode || "demo",
    Boolean(payload.bracketActive),
    payload.status || "draft",
    (payload.registrationCodePrefix || "BPC").toString().slice(0, 12).toUpperCase().replace(/[^A-Z0-9]/g, "") || "BPC",
    payload.paymentQrImage || "",
    payload.paymentUpiId || "",
    Boolean(payload.registrationsOpen),
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listTournaments() {
  const { rows } = await pool.query(
    `SELECT id, name, slug, format, series_type, team_count, status, is_published,
            published_at, start_date, end_date, registration_deadline, prize_pool, prize_pool_breakdown, entry_fee,
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
    `SELECT id, name, captain, abbr, seed, logo_url AS "logoUrl", accent_color AS "accentColor"
     FROM teams
     WHERE tournament_id = $1
     ORDER BY seed ASC NULLS LAST, created_at ASC`,
    [tournamentId],
  );
  const playersResult = await pool.query(
    `SELECT id, registration_id AS "registrationId", name, display_name AS "displayName", role, roles, mmr, steam_name AS "steamName",
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
    "SELECT id, stage_key AS \"stageKey\", round_index AS \"roundIndex\", match_index AS \"matchIndex\", team1, team2, winner, status, stream, slot_at AS \"slotAt\", meta, team1_score, team2_score FROM matches WHERE tournament_id = $1 ORDER BY stage_key ASC, round_index ASC, match_index ASC",
    [tournamentId],
  );
  const scheduleResult = await pool.query(
    "SELECT id, match_id AS \"matchId\", start_at AS \"startAt\", stream, stream_url AS \"streamUrl\", status, notes FROM schedule_slots WHERE tournament_id = $1 ORDER BY start_at ASC",
    [tournamentId],
  );

  return {
    tournament: tournamentResult.rows[0],
    teams: teamsResult.rows,
    players: playersResult.rows,
    teamPlayers: teamPlayersResult.rows,
    matches: matchesResult.rows.map((row) => hydrateMatchRow(row)),
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
      "INSERT INTO teams (id, tournament_id, name, captain, abbr, seed, logo_url, accent_color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        team.id,
        tournamentId,
        team.name,
        team.captain,
        team.abbr,
        team.seed,
        team.logoUrl || team.logo_url || "",
        team.accentColor || team.accent_color || "",
      ],
    );
  }

  for (const player of players) {
    await pool.query(
      `INSERT INTO players (
        id, tournament_id, registration_id, name, display_name, role, roles, mmr, steam_name,
        steam_profile, discord_handle, location, is_captain
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        player.id,
        tournamentId,
        player.registrationId || null,
        player.name,
        player.displayName || player.display_name || player.name || "",
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
    `SELECT id, name, captain, abbr, seed, logo_url AS "logoUrl", accent_color AS "accentColor"
     FROM teams
     WHERE tournament_id = $1
     ORDER BY seed ASC NULLS LAST, created_at ASC`,
    [tournamentId],
  );
  const playersResult = await client.query(
    `SELECT id, registration_id AS "registrationId", name, display_name AS "displayName", role, roles, mmr, steam_name AS "steamName",
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

async function seedRosterMemberships(client, rosterId, tournamentId, adminUserId = null) {
  await client.query("DELETE FROM roster_snapshot_team_memberships WHERE roster_snapshot_id = $1", [rosterId]);
  const { rows } = await client.query(
    "SELECT team_id, player_id FROM roster_snapshot_team_players WHERE roster_snapshot_id = $1",
    [rosterId],
  );
  for (const row of rows) {
    await client.query(
      `INSERT INTO roster_snapshot_team_memberships (
        id, roster_snapshot_id, tournament_id, snapshot_team_id, snapshot_player_id, status, adjusted_by
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
      [randomUUID(), rosterId, tournamentId, row.team_id, row.player_id, adminUserId],
    );
  }
}

async function replaceRosterSnapshotContents(client, tournamentId, rosterId) {
  const roster = await loadWorkingRoster(client, tournamentId);
  const teamIdMap = new Map();
  const playerIdMap = new Map();

  await client.query("DELETE FROM roster_snapshot_team_memberships WHERE roster_snapshot_id = $1", [rosterId]);
  await client.query("DELETE FROM roster_snapshot_team_players WHERE roster_snapshot_id = $1", [rosterId]);
  await client.query("DELETE FROM roster_snapshot_players WHERE roster_snapshot_id = $1", [rosterId]);
  await client.query("DELETE FROM roster_snapshot_teams WHERE roster_snapshot_id = $1", [rosterId]);

  for (const team of roster.teams) {
    const snapshotTeamId = randomUUID();
    teamIdMap.set(team.id, snapshotTeamId);
    await client.query(
      `INSERT INTO roster_snapshot_teams (id, roster_snapshot_id, tournament_id, source_team_id, name, captain, abbr, seed, logo_url, accent_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        snapshotTeamId,
        rosterId,
        tournamentId,
        team.id,
        team.name,
        team.captain,
        team.abbr,
        team.seed,
        team.logoUrl || team.logo_url || "",
        team.accentColor || team.accent_color || "",
      ],
    );
  }

  for (const player of roster.players) {
    const snapshotPlayerId = randomUUID();
    playerIdMap.set(player.id, snapshotPlayerId);
    await client.query(
      `INSERT INTO roster_snapshot_players (
        id, roster_snapshot_id, tournament_id, source_player_id, registration_id, name, display_name, role, roles, mmr,
        steam_name, steam_profile, discord_handle, location, is_captain
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        snapshotPlayerId,
        rosterId,
        tournamentId,
        player.id,
        player.registrationId || null,
        player.name,
        player.displayName || player.display_name || player.name || "",
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
            CASE
              WHEN EXISTS (
                SELECT 1 FROM roster_snapshot_team_memberships rstm_check
                WHERE rstm_check.roster_snapshot_id = rs.id
              )
              THEN (
                SELECT COUNT(DISTINCT rstm_active.snapshot_player_id)::int
                FROM roster_snapshot_team_memberships rstm_active
                WHERE rstm_active.roster_snapshot_id = rs.id AND rstm_active.status = 'active'
              )
              ELSE COUNT(DISTINCT rstp.player_id)::int
            END AS "assignedPlayerCount"
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
    `SELECT id, source_team_id AS "sourceTeamId", name, captain, abbr, seed, logo_url AS "logoUrl", accent_color AS "accentColor",
            group_key AS "groupKey"
     FROM roster_snapshot_teams
     WHERE roster_snapshot_id = $1
     ORDER BY seed ASC NULLS LAST, created_at ASC`,
    [rosterId],
  );
  const playersResult = await pool.query(
    `SELECT id, source_player_id AS "sourcePlayerId", registration_id AS "registrationId", name, display_name AS "displayName", role, roles, mmr,
            steam_name AS "steamName", steam_profile AS "steamProfile", discord_handle AS "discordHandle",
            location, is_captain AS "isCaptain"
     FROM roster_snapshot_players
     WHERE roster_snapshot_id = $1
     ORDER BY created_at ASC`,
    [rosterId],
  );
  const baselineTeamPlayersResult = await pool.query(
    `SELECT team_id, player_id
     FROM roster_snapshot_team_players
     WHERE roster_snapshot_id = $1`,
    [rosterId],
  );
  const membershipsResult = await pool.query(
    `SELECT id,
            snapshot_team_id AS "snapshotTeamId",
            snapshot_player_id AS "snapshotPlayerId",
            status,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            adjusted_by AS "adjustedBy"
     FROM roster_snapshot_team_memberships
     WHERE roster_snapshot_id = $1
     ORDER BY started_at ASC, created_at ASC`,
    [rosterId],
  );
  const memberships = membershipsResult.rows;
  const teamPlayers =
    memberships.length > 0
      ? memberships
          .filter((record) => record.status === "active")
          .map((record) => ({
            team_id: record.snapshotTeamId,
            player_id: record.snapshotPlayerId,
          }))
      : baselineTeamPlayersResult.rows;

  return {
    ...snapshot,
    teams: teamsResult.rows,
    players: playersResult.rows,
    teamPlayers,
    baselineTeamPlayers: baselineTeamPlayersResult.rows,
    memberships,
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

    const teamsResult = await client.query(
      `SELECT id FROM roster_snapshot_teams WHERE roster_snapshot_id = $1 ORDER BY seed ASC NULLS LAST, created_at ASC`,
      [rosterId],
    );
    for (const assignment of defaultGroupKeysForTeams(teamsResult.rows)) {
      await client.query(
        "UPDATE roster_snapshot_teams SET group_key = $1 WHERE roster_snapshot_id = $2 AND id = $3",
        [assignment.groupKey, rosterId, assignment.teamId],
      );
    }

    await seedRosterMemberships(client, rosterId, tournamentId, adminUserId);

    await client.query("COMMIT");
    return getRosterSnapshot(tournamentId, rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRosterGroupAssignments(tournamentId, assignments) {
  const approved = await getApprovedRosterSnapshot(tournamentId);
  if (!approved) return { error: "Approve a roster before assigning groups" };

  const teamIds = new Set(approved.teams.map((team) => team.id));
  for (const entry of assignments) {
    if (!teamIds.has(entry.teamId)) {
      return { error: "Group assignment includes a team that is not on the approved roster" };
    }
    if (entry.groupKey !== "A" && entry.groupKey !== "B") {
      return { error: "Each team must be assigned to Group A or Group B" };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const entry of assignments) {
      await client.query(
        "UPDATE roster_snapshot_teams SET group_key = $1 WHERE roster_snapshot_id = $2 AND id = $3",
        [entry.groupKey, approved.id, entry.teamId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { approvedRoster: await getRosterSnapshot(tournamentId, approved.id) };
}

function registrationIsReady(registration) {
  return (
    registration &&
    registration.paymentStatus === "paid" &&
    registration.registrationStatus === "approved" &&
    !registration.archivedAt
  );
}

function primaryRoleFromRegistration(registration) {
  const roles = Array.isArray(registration.roles) ? registration.roles : [];
  return roles[0] || "flex";
}

async function loadRosterAdjustmentState(client, tournamentId, rosterId) {
  const snapshotResult = await client.query(
    "SELECT id, status FROM roster_snapshots WHERE tournament_id = $1 AND id = $2",
    [tournamentId, rosterId],
  );
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;

  const teamsResult = await client.query(
    "SELECT id, name FROM roster_snapshot_teams WHERE roster_snapshot_id = $1",
    [rosterId],
  );
  const playersResult = await client.query(
    `SELECT id, registration_id AS "registrationId", name, display_name AS "displayName", role, roles, mmr,
            steam_name AS "steamName", steam_profile AS "steamProfile", discord_handle AS "discordHandle",
            location, is_captain AS "isCaptain"
     FROM roster_snapshot_players
     WHERE roster_snapshot_id = $1`,
    [rosterId],
  );
  const membershipsResult = await client.query(
    `SELECT id, snapshot_team_id AS "snapshotTeamId", snapshot_player_id AS "snapshotPlayerId", status
     FROM roster_snapshot_team_memberships
     WHERE roster_snapshot_id = $1`,
    [rosterId],
  );

  return {
    snapshot,
    teams: teamsResult.rows,
    players: playersResult.rows,
    memberships: membershipsResult.rows,
  };
}

function buildActiveAssignmentMaps(state) {
  const activeByPlayer = new Map();
  const activeByTeam = new Map();
  for (const team of state.teams) {
    activeByTeam.set(team.id, new Set());
  }
  for (const membership of state.memberships) {
    if (membership.status !== "active") continue;
    activeByPlayer.set(membership.snapshotPlayerId, {
      teamId: membership.snapshotTeamId,
      membershipId: membership.id,
    });
    const teamSet = activeByTeam.get(membership.snapshotTeamId);
    if (teamSet) teamSet.add(membership.snapshotPlayerId);
  }
  return { activeByPlayer, activeByTeam };
}

function validateActiveRosterState(state, activeByTeam, playersById) {
  for (const team of state.teams) {
    const activePlayerIds = activeByTeam.get(team.id) || new Set();
    if (activePlayerIds.size > 5) {
      return `${team.name} cannot have more than 5 active players`;
    }
    const hasCaptain = [...activePlayerIds].some((playerId) => playersById.get(playerId)?.isCaptain);
    if (activePlayerIds.size > 0 && !hasCaptain) {
      return `Assign a captain for ${team.name} before saving teams`;
    }
  }
  return "";
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

async function activateMembership(client, rosterId, tournamentId, teamId, playerId, adminUserId) {
  await client.query(
    `INSERT INTO roster_snapshot_team_memberships (
      id, roster_snapshot_id, tournament_id, snapshot_team_id, snapshot_player_id, status, adjusted_by
    )
    VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
    [randomUUID(), rosterId, tournamentId, teamId, playerId, adminUserId],
  );
}

async function ensureSnapshotPlayerForRegistration(client, tournamentId, rosterId, registration) {
  const existing = await client.query(
    "SELECT id FROM roster_snapshot_players WHERE roster_snapshot_id = $1 AND registration_id = $2",
    [rosterId, registration.id],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const snapshotPlayerId = randomUUID();
  const role = primaryRoleFromRegistration(registration);
  await client.query(
    `INSERT INTO roster_snapshot_players (
      id, roster_snapshot_id, tournament_id, source_player_id, registration_id, name, display_name, role, roles, mmr,
      steam_name, steam_profile, discord_handle, location, is_captain
    )
    VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE)`,
    [
      snapshotPlayerId,
      rosterId,
      tournamentId,
      registration.id,
      registration.name,
      registration.displayName || registration.name || "",
      role,
      JSON.stringify(registration.roles || (role ? [role] : [])),
      registration.mmr || null,
      registration.steamName || "",
      registration.steamProfile || "",
      registration.discordHandle || "",
      registration.location || "",
    ],
  );
  return snapshotPlayerId;
}

function resolveSnapshotTeamId(savedTeamId, savedTeams, snapshotTeams) {
  const savedTeam = savedTeams.find((team) => team.id === savedTeamId);
  if (!savedTeam) return null;
  return (
    snapshotTeams.find((team) => team.id === savedTeam.id)?.id ||
    snapshotTeams.find((team) => team.sourceTeamId === savedTeam.id)?.id ||
    snapshotTeams.find((team) => team.name === savedTeam.name)?.id ||
    null
  );
}

function resolveSnapshotPlayerId(savedPlayer, snapshotPlayers) {
  return (
    snapshotPlayers.find((player) => player.id === savedPlayer.id)?.id ||
    snapshotPlayers.find((player) => player.sourcePlayerId === savedPlayer.id)?.id ||
    (savedPlayer.registrationId
      ? snapshotPlayers.find((player) => player.registrationId === savedPlayer.registrationId)?.id
      : null) ||
    null
  );
}

export async function syncApprovedRosterFromTeamSave(tournamentId, rosterId, adminUserId, savedTeams, savedPlayers) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await loadRosterAdjustmentState(client, tournamentId, rosterId);
    if (!state) {
      await client.query("ROLLBACK");
      return { error: "Roster not found" };
    }
    if (state.snapshot.status !== "approved") {
      await client.query("ROLLBACK");
      return { error: "Only an approved roster can be updated from team save" };
    }

    const teamsResult = await client.query(
      `SELECT id, source_team_id AS "sourceTeamId", name
       FROM roster_snapshot_teams
       WHERE roster_snapshot_id = $1`,
      [rosterId],
    );
    const snapshotTeams = teamsResult.rows;
    const playersResult = await client.query(
      `SELECT id, source_player_id AS "sourcePlayerId", registration_id AS "registrationId", name, display_name AS "displayName",
              role, roles, mmr, steam_name AS "steamName", steam_profile AS "steamProfile", discord_handle AS "discordHandle",
              location, is_captain AS "isCaptain"
       FROM roster_snapshot_players
       WHERE roster_snapshot_id = $1`,
      [rosterId],
    );
    const snapshotPlayers = [...playersResult.rows];
    const playersById = new Map(snapshotPlayers.map((player) => [player.id, { ...player }]));
    const desiredAssignments = [];

    for (const savedPlayer of savedPlayers) {
      if (!savedPlayer.teamId) continue;

      const snapshotTeamId = resolveSnapshotTeamId(savedPlayer.teamId, savedTeams, snapshotTeams);
      if (!snapshotTeamId) {
        await client.query("ROLLBACK");
        return { error: "Team assignment references a team that is not on the approved roster" };
      }

      let snapshotPlayerId = resolveSnapshotPlayerId(savedPlayer, snapshotPlayers);
      if (!snapshotPlayerId) {
        if (!savedPlayer.registrationId) {
          await client.query("ROLLBACK");
          return { error: "Only registered players can be assigned to teams" };
        }
        const registration = await getPlayerRegistrationById(tournamentId, savedPlayer.registrationId);
        if (!registrationIsReady(registration)) {
          await client.query("ROLLBACK");
          return { error: "Team rosters can only include paid, approved, active registrations" };
        }
        snapshotPlayerId = await ensureSnapshotPlayerForRegistration(client, tournamentId, rosterId, registration);
        const createdPlayer = {
          id: snapshotPlayerId,
          registrationId: registration.id,
          isCaptain: Boolean(savedPlayer.isCaptain),
        };
        snapshotPlayers.push(createdPlayer);
        playersById.set(snapshotPlayerId, createdPlayer);
      }

      desiredAssignments.push({
        snapshotTeamId,
        snapshotPlayerId,
        isCaptain: Boolean(savedPlayer.isCaptain),
      });
    }

    await client.query("UPDATE roster_snapshot_players SET is_captain = FALSE WHERE roster_snapshot_id = $1", [rosterId]);
    for (const assignment of desiredAssignments) {
      await client.query("UPDATE roster_snapshot_players SET is_captain = $2 WHERE id = $1", [
        assignment.snapshotPlayerId,
        assignment.isCaptain,
      ]);
      if (playersById.has(assignment.snapshotPlayerId)) {
        playersById.get(assignment.snapshotPlayerId).isCaptain = assignment.isCaptain;
      }
    }

    const desiredActive = new Map();
    const activeByTeam = new Map(snapshotTeams.map((team) => [team.id, new Set()]));
    for (const assignment of desiredAssignments) {
      if (desiredActive.has(assignment.snapshotPlayerId)) {
        await client.query("ROLLBACK");
        return { error: "A player cannot be assigned to more than one team" };
      }
      desiredActive.set(assignment.snapshotPlayerId, assignment.snapshotTeamId);
      activeByTeam.get(assignment.snapshotTeamId)?.add(assignment.snapshotPlayerId);
    }

    const validationMessage = validateActiveRosterState({ teams: snapshotTeams }, activeByTeam, playersById);
    if (validationMessage) {
      await client.query("ROLLBACK");
      return { error: validationMessage.replace("roster adjustments", "saving teams") };
    }

    const { activeByPlayer } = buildActiveAssignmentMaps(state);
    for (const [playerId, active] of activeByPlayer.entries()) {
      const desiredTeamId = desiredActive.get(playerId);
      if (!desiredTeamId || desiredTeamId !== active.teamId) {
        await deactivateMembership(client, rosterId, active.teamId, playerId, adminUserId);
      }
    }

    for (const [playerId, teamId] of desiredActive.entries()) {
      const current = activeByPlayer.get(playerId);
      if (!current || current.teamId !== teamId) {
        await activateMembership(client, rosterId, tournamentId, teamId, playerId, adminUserId);
      }
    }

    await client.query("UPDATE roster_snapshots SET updated_at = NOW() WHERE tournament_id = $1 AND id = $2", [
      tournamentId,
      rosterId,
    ]);
    await client.query("COMMIT");
    return { approvedRoster: await getRosterSnapshot(tournamentId, rosterId) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function adjustApprovedRoster(tournamentId, rosterId, operations, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await loadRosterAdjustmentState(client, tournamentId, rosterId);
    if (!state) {
      await client.query("ROLLBACK");
      return { error: "Roster not found" };
    }
    if (state.snapshot.status !== "approved") {
      await client.query("ROLLBACK");
      return { error: "Only an approved roster can be adjusted" };
    }

    const teamIds = new Set(state.teams.map((team) => team.id));
    const playersById = new Map(state.players.map((player) => [player.id, { ...player }]));
    const { activeByPlayer, activeByTeam } = buildActiveAssignmentMaps(state);

    for (const operation of operations) {
      if (operation.type === "remove") {
        if (!teamIds.has(operation.teamId)) {
          await client.query("ROLLBACK");
          return { error: "Remove operation references a team that is not on this roster" };
        }
        if (!playersById.has(operation.playerId)) {
          await client.query("ROLLBACK");
          return { error: "Remove operation references a player that is not on this roster" };
        }
        const active = activeByPlayer.get(operation.playerId);
        if (!active || active.teamId !== operation.teamId) {
          await client.query("ROLLBACK");
          return { error: "Player is not actively assigned to that team" };
        }
        await deactivateMembership(client, rosterId, operation.teamId, operation.playerId, adminUserId);
        activeByTeam.get(operation.teamId)?.delete(operation.playerId);
        activeByPlayer.delete(operation.playerId);
        continue;
      }

      if (operation.type === "move") {
        if (!teamIds.has(operation.fromTeamId) || !teamIds.has(operation.toTeamId)) {
          await client.query("ROLLBACK");
          return { error: "Move operation references a team that is not on this roster" };
        }
        if (operation.fromTeamId === operation.toTeamId) {
          await client.query("ROLLBACK");
          return { error: "Move operation must use different source and destination teams" };
        }
        if (!playersById.has(operation.playerId)) {
          await client.query("ROLLBACK");
          return { error: "Move operation references a player that is not on this roster" };
        }
        const active = activeByPlayer.get(operation.playerId);
        if (!active || active.teamId !== operation.fromTeamId) {
          await client.query("ROLLBACK");
          return { error: "Player is not actively assigned to the source team" };
        }
        const destinationCount = activeByTeam.get(operation.toTeamId)?.size || 0;
        if (destinationCount >= 5) {
          await client.query("ROLLBACK");
          return { error: "Destination team already has 5 active players" };
        }
        await deactivateMembership(client, rosterId, operation.fromTeamId, operation.playerId, adminUserId);
        await activateMembership(client, rosterId, tournamentId, operation.toTeamId, operation.playerId, adminUserId);
        activeByTeam.get(operation.fromTeamId)?.delete(operation.playerId);
        activeByTeam.get(operation.toTeamId)?.add(operation.playerId);
        activeByPlayer.set(operation.playerId, { teamId: operation.toTeamId });
        continue;
      }

      if (operation.type === "add") {
        if (!teamIds.has(operation.teamId)) {
          await client.query("ROLLBACK");
          return { error: "Add operation references a team that is not on this roster" };
        }
        const registration = await getPlayerRegistrationById(tournamentId, operation.registrationId);
        if (!registrationIsReady(registration)) {
          await client.query("ROLLBACK");
          return { error: "Only paid, approved, active registrations can be added to a roster" };
        }

        let playerId = [...playersById.values()].find((player) => player.registrationId === operation.registrationId)?.id;
        if (!playerId) {
          playerId = await ensureSnapshotPlayerForRegistration(client, tournamentId, rosterId, registration);
          playersById.set(playerId, {
            id: playerId,
            registrationId: registration.id,
            name: registration.name,
            displayName: registration.displayName || registration.name || "",
            role: primaryRoleFromRegistration(registration),
            roles: registration.roles || [],
            isCaptain: Boolean(operation.isCaptain),
          });
          state.players.push(playersById.get(playerId));
        } else if (operation.isCaptain) {
          await client.query("UPDATE roster_snapshot_players SET is_captain = TRUE WHERE id = $1", [playerId]);
          playersById.get(playerId).isCaptain = true;
        }

        if (activeByPlayer.has(playerId)) {
          await client.query("ROLLBACK");
          return { error: "Registration is already actively assigned to a team" };
        }

        const teamCount = activeByTeam.get(operation.teamId)?.size || 0;
        if (teamCount >= 5) {
          await client.query("ROLLBACK");
          return { error: "Team already has 5 active players" };
        }

        await activateMembership(client, rosterId, tournamentId, operation.teamId, playerId, adminUserId);
        if (!activeByTeam.has(operation.teamId)) {
          activeByTeam.set(operation.teamId, new Set());
        }
        activeByTeam.get(operation.teamId).add(playerId);
        activeByPlayer.set(playerId, { teamId: operation.teamId });
      }
    }

    const validationMessage = validateActiveRosterState(state, activeByTeam, playersById);
    if (validationMessage) {
      await client.query("ROLLBACK");
      return { error: validationMessage };
    }

    await client.query("UPDATE roster_snapshots SET updated_at = NOW() WHERE tournament_id = $1 AND id = $2", [
      tournamentId,
      rosterId,
    ]);
    await client.query("COMMIT");
    return { approvedRoster: await getRosterSnapshot(tournamentId, rosterId) };
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

export async function getPublishedTournament() {
  const result = await pool.query("SELECT id FROM tournaments WHERE is_published = TRUE ORDER BY published_at DESC LIMIT 1");
  const tournament = result.rows[0];
  if (!tournament) return null;
  const data = await getTournament(tournament.id);
  return applyPublishedSnapshot(data);
}

/** Published tournament only if `identifier` matches slug or id (prevents draft leakage). */
export async function getPublishedTournamentForPublicRequest(identifier) {
  const result = await pool.query(
    "SELECT id, slug FROM tournaments WHERE is_published = TRUE ORDER BY published_at DESC LIMIT 1",
  );
  if (!result.rows[0]) return null;
  const { id, slug } = result.rows[0];
  if (identifier && slug && identifier !== slug && identifier !== id) {
    return null;
  }
  const data = await getTournament(id);
  return applyPublishedSnapshot(data);
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
    const row = rows[0];
    if (row) {
      const snapshot = buildPublishedSnapshotFromRow(row);
      await client.query(`UPDATE tournaments SET published_snapshot = $2::jsonb WHERE id = $1`, [tournamentId, JSON.stringify(snapshot)]);
    }
    await client.query("COMMIT");
    return row || null;
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
     SET is_published = FALSE, status = 'approved', published_at = NULL, published_by = NULL,
         published_snapshot = NULL, updated_at = NOW()
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
    const meta = match.meta ?? {};
    const t1 = pickIntScore(meta.team1Score);
    const t2 = pickIntScore(meta.team2Score);
    await pool.query(
      "INSERT INTO matches (id, tournament_id, stage_key, round_index, match_index, team1, team2, winner, status, stream, slot_at, meta, team1_score, team2_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
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
        meta,
        t1,
        t2,
      ],
    );
  }
}

export async function updateMatch(tournamentId, matchId, update) {
  const meta = parseMeta(update.meta);
  const { t1, t2 } = scoresFromUpdateMeta(update);
  const { rows } = await pool.query(
    "UPDATE matches SET winner = $3, status = $4, stream = $5, slot_at = $6, team1 = $7, team2 = $8, meta = $9::jsonb, team1_score = $10, team2_score = $11, updated_at = NOW() WHERE tournament_id = $1::uuid AND id = $2::uuid RETURNING *",
    [tournamentId, matchId, update.winner, update.status, update.stream, update.slotAt, update.team1, update.team2, meta, t1, t2],
  );
  if (!rows[0]) {
    return null;
  }
  return hydrateMatchRow(rows[0]);
}

export async function updateScheduleStatusByMatchId(tournamentId, matchId, status) {
  await pool.query(
    "UPDATE schedule_slots SET status = $3 WHERE tournament_id = $1 AND match_id = $2::uuid",
    [tournamentId, matchId, status],
  );
}

export async function replaceSchedule(tournamentId, schedule) {
  await pool.query("DELETE FROM schedule_slots WHERE tournament_id = $1", [tournamentId]);
  for (const slot of schedule) {
    await pool.query(
      "INSERT INTO schedule_slots (id, tournament_id, match_id, start_at, stream, stream_url, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        slot.id,
        tournamentId,
        slot.matchId,
        slot.startAt,
        slot.stream,
        slot.streamUrl ?? null,
        slot.status,
        slot.notes,
      ],
    );
  }
}
