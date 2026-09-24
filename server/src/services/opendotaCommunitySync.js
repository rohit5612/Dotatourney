import { pool } from "../db/pool.js";
import { steam64ToSteam32 } from "../utils/steamId.js";
import { getSnapshot } from "./opendotaRepository.js";

function isExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt) <= new Date();
}

export async function listSteamLinkedPlayerAccounts() {
  const { rows } = await pool.query(
    `SELECT id, slug, bpc_id, steam_id, display_name
     FROM player_accounts
     WHERE steam_id IS NOT NULL AND steam_id <> ''
     ORDER BY lower(slug) NULLS LAST, bpc_id`,
  );
  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      bpcId: row.bpc_id,
      displayName: row.display_name,
      steam32: steam64ToSteam32(row.steam_id),
    }))
    .filter((row) => row.steam32 != null);
}

export async function listTournamentsWithLeagueId() {
  const { rows } = await pool.query(
    `SELECT t.id, t.slug, t.name, t.dota_league_id, s.number AS season_number
     FROM tournaments t
     LEFT JOIN seasons s ON s.tournament_id = t.id
     WHERE t.dota_league_id IS NOT NULL AND t.dota_league_id > 0
     ORDER BY s.number ASC NULLS LAST, t.slug`,
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    dotaLeagueId: Number(r.dota_league_id),
    seasonNumber: r.season_number,
  }));
}

/** Leagues this account is associated with (lineup, registration, season participation). */
export async function listLeagueIdsForPlayerAccount(playerAccountId) {
  const sqlWithParticipations = `SELECT DISTINCT t.dota_league_id, t.slug, t.name, s.number AS season_number
     FROM tournaments t
     LEFT JOIN seasons s ON s.tournament_id = t.id
     WHERE t.dota_league_id IS NOT NULL
       AND t.id IN (
         SELECT DISTINCT mlp.tournament_id
         FROM match_lineup_players mlp
         WHERE mlp.player_account_id = $1
         UNION
         SELECT DISTINCT pr.tournament_id
         FROM player_registrations pr
         WHERE pr.player_account_id = $1 AND pr.archived_at IS NULL
         UNION
         SELECT DISTINCT s2.tournament_id
         FROM season_participations sp
         JOIN seasons s2 ON s2.id = sp.season_id
         WHERE sp.player_account_id = $1
       )
     ORDER BY s.number ASC NULLS LAST, t.dota_league_id`;

  const sqlWithoutParticipations = `SELECT DISTINCT t.dota_league_id, t.slug, t.name, s.number AS season_number
     FROM tournaments t
     LEFT JOIN seasons s ON s.tournament_id = t.id
     WHERE t.dota_league_id IS NOT NULL
       AND t.id IN (
         SELECT DISTINCT mlp.tournament_id
         FROM match_lineup_players mlp
         WHERE mlp.player_account_id = $1
         UNION
         SELECT DISTINCT pr.tournament_id
         FROM player_registrations pr
         WHERE pr.player_account_id = $1 AND pr.archived_at IS NULL
       )
     ORDER BY s.number ASC NULLS LAST, t.dota_league_id`;

  let rows;
  try {
    ({ rows } = await pool.query(sqlWithParticipations, [playerAccountId]));
  } catch (error) {
    if (error?.code !== "42703") throw error;
    ({ rows } = await pool.query(sqlWithoutParticipations, [playerAccountId]));
  }
  return rows
    .map((r) => ({
      dotaLeagueId: Number(r.dota_league_id),
      tournamentSlug: r.slug,
      tournamentName: r.name,
      seasonNumber: r.season_number,
    }))
    .filter((r) => Number.isFinite(r.dotaLeagueId) && r.dotaLeagueId > 0);
}

/**
 * @returns {'skip' | 'sync' | 'stats_only'}
 */
export async function profileSyncPlan(playerAccountId, { force = false } = {}) {
  if (force) return "sync";
  const profile = await getSnapshot(playerAccountId, "profile");
  const heroes = await getSnapshot(playerAccountId, "heroes");
  const hasProfile =
    profile?.payload?.profile &&
    typeof profile.payload.profile === "object" &&
    !isExpired(profile.expires_at);
  const hasHeroes =
    Array.isArray(heroes?.payload?.heroes) && heroes.payload.heroes.length > 0 && !isExpired(heroes.expires_at);
  if (hasProfile && hasHeroes) return "skip";
  return "sync";
}

/**
 * @returns {'skip' | 'sync' | 'stats_only'}
 */
export async function leagueSyncPlan(playerAccountId, dotaLeagueId, { force = false } = {}) {
  if (force) return "sync";
  const kind = `league:${dotaLeagueId}`;
  const leagueSnap = await getSnapshot(playerAccountId, kind);
  const statsSnap = await getSnapshot(playerAccountId, `league_stats:${dotaLeagueId}`);

  const leagueOk =
    leagueSnap?.payload?.verifiedLeague === true &&
    !isExpired(leagueSnap.expires_at) &&
    (Array.isArray(leagueSnap.payload?.raw) && leagueSnap.payload.raw.length > 0 ||
      Array.isArray(leagueSnap.payload?.matchIds) && leagueSnap.payload.matchIds.length > 0);

  const statsOk =
    statsSnap?.payload &&
    Number(statsSnap.payload.games) > 0 &&
    !isExpired(statsSnap.expires_at);

  if (leagueOk && statsOk) return "skip";
  if (leagueOk && !statsOk) return "stats_only";
  return "sync";
}

export async function countOpendotaCoverage() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM player_accounts WHERE steam_id IS NOT NULL AND steam_id <> '') AS steam_linked,
       (SELECT COUNT(DISTINCT player_account_id)::int FROM player_opendota_snapshots WHERE snapshot_kind = 'profile') AS profile_rows,
       (SELECT COUNT(DISTINCT player_account_id)::int FROM player_opendota_snapshots WHERE snapshot_kind = 'heroes') AS heroes_rows,
       (SELECT COUNT(*)::int FROM opendota_match_cache) AS match_cache_rows,
       (SELECT COUNT(*)::int FROM opendota_league_match_index) AS league_index_rows`,
  );
  return rows[0];
}
