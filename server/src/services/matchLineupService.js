import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { loadActiveTeamPlayersByName } from "./rosterMembershipService.js";

const ROSTER_TEAM_SIZE = 5;

export function normalizeTeamName(name) {
  return String(name || "").trim().toLowerCase();
}

/** True when stored lineup rows no longer match the match's current teams (e.g. after standings reseed). */
export function matchLineupNeedsReseed(lineupRows, team1, team2) {
  const t1 = normalizeTeamName(team1);
  const t2 = normalizeTeamName(team2);
  const starters = (lineupRows || []).filter((row) => row.is_substitute !== true);
  if (!starters.length) return true;

  const counts = new Map();
  let hasStaleNames = false;

  for (const row of starters) {
    const rowTeam = normalizeTeamName(row.team_name);
    if (rowTeam !== t1 && rowTeam !== t2) {
      hasStaleNames = true;
      continue;
    }
    counts.set(rowTeam, (counts.get(rowTeam) || 0) + 1);
  }

  if (hasStaleNames) return true;
  if (t1 && !counts.has(t1)) return true;
  if (t2 && !counts.has(t2)) return true;
  for (const count of counts.values()) {
    if (count > ROSTER_TEAM_SIZE) return true;
  }
  return false;
}

async function getApprovedRosterId(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id FROM roster_snapshots
     WHERE tournament_id = $1 AND status = 'approved'
     ORDER BY approved_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [tournamentId],
  );
  return rows[0]?.id || null;
}

async function loadTeamLineupFromSnapshot(rosterId, teamName) {
  const players = await loadActiveTeamPlayersByName(rosterId, teamName);
  return players.map((p) => ({
    player_account_id: p.player_account_id,
    display_name: p.display_name,
    name: p.name,
    roles: p.roles,
    mmr: p.mmr,
  }));
}

export async function seedMatchLineupsForTournament(tournamentId, matchIds = null) {
  const rosterId = await getApprovedRosterId(tournamentId);
  if (!rosterId) return { seeded: 0 };

  let sql = `SELECT id, team1, team2 FROM matches WHERE tournament_id = $1`;
  const params = [tournamentId];
  if (matchIds?.length) {
    params.push(matchIds);
    sql += ` AND id = ANY($2::uuid[])`;
  }
  const { rows: matches } = await pool.query(sql, params);

  let seeded = 0;
  for (const match of matches) {
    // Clear all starter rows for the match so stale team_name rows from prior bracket
    // assignments (e.g. manual standings changes) cannot accumulate on one side.
    await pool.query(
      `DELETE FROM match_lineup_players
       WHERE match_id = $1 AND is_substitute = FALSE`,
      [match.id],
    );

    for (const teamName of [match.team1, match.team2]) {
      if (!teamName?.trim()) continue;

      const players = await loadTeamLineupFromSnapshot(rosterId, teamName);
      let slotIndex = 0;
      for (const player of players) {
        await pool.query(
          `INSERT INTO match_lineup_players (
            id, match_id, tournament_id, team_name, player_account_id, display_name, roles, mmr,
            is_substitute, slot_index
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)
          ON CONFLICT (match_id, team_name, player_account_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            roles = EXCLUDED.roles,
            mmr = EXCLUDED.mmr,
            slot_index = EXCLUDED.slot_index,
            updated_at = NOW()
          WHERE match_lineup_players.is_substitute = FALSE`,
          [
            randomUUID(),
            match.id,
            tournamentId,
            teamName,
            player.player_account_id,
            player.display_name || player.name || "Player",
            JSON.stringify(Array.isArray(player.roles) ? player.roles : player.roles || []),
            player.mmr ?? null,
            slotIndex++,
          ],
        );
        seeded += 1;
      }
    }
  }
  return { seeded };
}

export async function seedMatchLineupsForScheduledMatches(tournamentId, schedule) {
  const matchIds = (schedule || []).map((slot) => slot.matchId).filter(Boolean);
  if (!matchIds.length) return { seeded: 0 };
  return seedMatchLineupsForTournament(tournamentId, matchIds);
}

/** Replace starter lineups for one match after team assignment changes. */
export async function reseedMatchLineups(tournamentId, matchId) {
  const { rows: matchRows } = await pool.query(
    `SELECT team1, team2 FROM matches WHERE id = $1 AND tournament_id = $2`,
    [matchId, tournamentId],
  );
  const match = matchRows[0];
  if (!match) return { seeded: 0 };

  await pool.query(
    `DELETE FROM match_lineup_players
     WHERE match_id = $1
       AND (
         is_substitute = FALSE
         OR lower(team_name) NOT IN (lower($2), lower($3))
       )`,
    [matchId, match.team1 || "", match.team2 || ""],
  );

  return seedMatchLineupsForTournament(tournamentId, [matchId]);
}

export async function getMatchLineupRows(matchId) {
  const { rows } = await pool.query(
    `SELECT mlp.*, pa.steam_avatar_url, pa.bpc_id,
            repl.display_name AS replaces_display_name
     FROM match_lineup_players mlp
     LEFT JOIN player_accounts pa ON pa.id = mlp.player_account_id
     LEFT JOIN player_accounts repl ON repl.id = mlp.replaces_player_account_id
     WHERE mlp.match_id = $1
     ORDER BY mlp.team_name ASC, mlp.slot_index ASC NULLS LAST, mlp.display_name ASC`,
    [matchId],
  );
  return rows;
}

function parseRoles(roles) {
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      return JSON.parse(roles);
    } catch {
      return roles ? [roles] : [];
    }
  }
  return [];
}

export function groupLineupsByTeam(lineupRows, team1, team2) {
  const result = {
    team1: { name: team1, players: [] },
    team2: { name: team2, players: [] },
  };
  const seen = { team1: new Set(), team2: new Set() };
  const t1 = normalizeTeamName(team1);
  const t2 = normalizeTeamName(team2);

  for (const row of lineupRows) {
    const rowTeam = normalizeTeamName(row.team_name);
    let side = null;
    if (rowTeam === t1) side = "team1";
    else if (rowTeam === t2) side = "team2";
    else continue;

    const playerKey = row.player_account_id || row.display_name;
    if (seen[side].has(playerKey)) continue;
    seen[side].add(playerKey);

    result[side].players.push({
      playerAccountId: row.player_account_id,
      displayName: row.display_name,
      roles: parseRoles(row.roles),
      mmr: row.mmr,
      isSubstitute: row.is_substitute === true,
      replacesDisplayName: row.replaces_display_name || null,
      avatarUrl: row.steam_avatar_url || "",
    });
  }
  return result;
}

export async function revertSubstituteFromLineup(client, {
  matchId,
  tournamentId,
  teamName,
  replacedPlayerAccountId,
  substitutionRequestId,
}) {
  await client.query(
    `DELETE FROM match_lineup_players
     WHERE match_id = $1
       AND (
         substitution_request_id = $2
         OR (
           is_substitute = TRUE
           AND lower(team_name) = lower($3)
           AND replaces_player_account_id = $4
         )
       )`,
    [matchId, substitutionRequestId, teamName, replacedPlayerAccountId],
  );

  const { rows: playerData } = await client.query(
    `SELECT pr.display_name, pr.name, pr.roles, pr.mmr
     FROM player_registrations pr
     WHERE pr.player_account_id = $1 AND pr.tournament_id = $2 AND pr.archived_at IS NULL
     ORDER BY pr.substitute_flag ASC, pr.created_at DESC
     LIMIT 1`,
    [replacedPlayerAccountId, tournamentId],
  );
  const { rows: accountRows } = await client.query(
    `SELECT display_name FROM player_accounts WHERE id = $1`,
    [replacedPlayerAccountId],
  );
  const displayName =
    playerData[0]?.display_name || playerData[0]?.name || accountRows[0]?.display_name || "Player";
  const roles = playerData[0]?.roles || [];
  const mmr = playerData[0]?.mmr ?? null;

  const { rows: existing } = await client.query(
    `SELECT id FROM match_lineup_players
     WHERE match_id = $1 AND lower(team_name) = lower($2) AND player_account_id = $3`,
    [matchId, teamName, replacedPlayerAccountId],
  );
  if (existing[0]) return;

  const { rows: maxSlot } = await client.query(
    `SELECT COALESCE(MAX(slot_index), -1) + 1 AS next_slot
     FROM match_lineup_players WHERE match_id = $1 AND lower(team_name) = lower($2)`,
    [matchId, teamName],
  );

  await client.query(
    `INSERT INTO match_lineup_players (
      id, match_id, tournament_id, team_name, player_account_id, display_name, roles, mmr,
      is_substitute, replaces_player_account_id, substitution_request_id, slot_index
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NULL, NULL, $9)
    ON CONFLICT (match_id, team_name, player_account_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      roles = EXCLUDED.roles,
      mmr = EXCLUDED.mmr,
      is_substitute = FALSE,
      replaces_player_account_id = NULL,
      substitution_request_id = NULL,
      updated_at = NOW()`,
    [
      randomUUID(),
      matchId,
      tournamentId,
      teamName,
      replacedPlayerAccountId,
      displayName,
      JSON.stringify(Array.isArray(roles) ? roles : roles || []),
      mmr,
      maxSlot[0]?.next_slot ?? 0,
    ],
  );
}

export async function applySubstituteToLineup(client, {
  matchId,
  tournamentId,
  teamName,
  replacedPlayerAccountId,
  substitutePlayerAccountId,
  substituteDisplayName,
  substituteRoles,
  substituteMmr,
  substitutionRequestId,
}) {
  await client.query(
    `DELETE FROM match_lineup_players
     WHERE match_id = $1 AND lower(team_name) = lower($2) AND player_account_id = $3`,
    [matchId, teamName, replacedPlayerAccountId],
  );

  const { rows: maxSlot } = await client.query(
    `SELECT COALESCE(MAX(slot_index), -1) + 1 AS next_slot
     FROM match_lineup_players WHERE match_id = $1 AND lower(team_name) = lower($2)`,
    [matchId, teamName],
  );

  await client.query(
    `INSERT INTO match_lineup_players (
      id, match_id, tournament_id, team_name, player_account_id, display_name, roles, mmr,
      is_substitute, replaces_player_account_id, substitution_request_id, slot_index
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11)
    ON CONFLICT (match_id, team_name, player_account_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      roles = EXCLUDED.roles,
      mmr = EXCLUDED.mmr,
      is_substitute = TRUE,
      replaces_player_account_id = EXCLUDED.replaces_player_account_id,
      substitution_request_id = EXCLUDED.substitution_request_id,
      updated_at = NOW()`,
    [
      randomUUID(),
      matchId,
      tournamentId,
      teamName,
      substitutePlayerAccountId,
      substituteDisplayName,
      JSON.stringify(substituteRoles || []),
      substituteMmr ?? null,
      replacedPlayerAccountId,
      substitutionRequestId,
      maxSlot[0]?.next_slot ?? 0,
    ],
  );
}

export async function getLineupPlayerAccountIdsForMatch(matchId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT player_account_id FROM match_lineup_players WHERE match_id = $1 AND player_account_id IS NOT NULL`,
    [matchId],
  );
  return rows.map((r) => r.player_account_id);
}

/** Lineup player account IDs for one team in a match (excludes opponent side). */
export async function getLineupPlayerAccountIdsForMatchTeam(matchId, teamName) {
  if (!teamName?.trim()) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT player_account_id
     FROM match_lineup_players
     WHERE match_id = $1
       AND player_account_id IS NOT NULL
       AND lower(team_name) = lower($2)`,
    [matchId, teamName],
  );
  return rows.map((r) => r.player_account_id);
}
