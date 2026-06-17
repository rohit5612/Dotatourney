import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { loadActiveTeamPlayersByName } from "./rosterMembershipService.js";

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
    for (const teamName of [match.team1, match.team2]) {
      if (!teamName?.trim()) continue;
      await pool.query(
        `DELETE FROM match_lineup_players
         WHERE match_id = $1 AND lower(team_name) = lower($2) AND is_substitute = FALSE`,
        [match.id, teamName],
      );

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

export async function getMatchLineupRows(matchId) {
  const { rows } = await pool.query(
    `SELECT mlp.*, pa.steam_avatar_url,
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

  for (const row of lineupRows) {
    const isTeam1 = row.team_name?.toLowerCase() === team1?.toLowerCase();
    const side = isTeam1 ? "team1" : "team2";
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
