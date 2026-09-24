import { pool } from "../db/pool.js";

/** When set, upserts are buffered for CSV export; reads merge buffer + DB. */
let exportBuffer = null;

export function beginOpendotaExportBuffer() {
  exportBuffer = {
    snapshots: new Map(),
    matchCache: new Map(),
    leagueIndex: new Map(),
  };
}

export function endOpendotaExportBuffer() {
  exportBuffer = null;
}

/** @returns {{ snapshots: object[], matchCache: object[], leagueIndex: object[] }} */
export function getOpendotaExportBufferRows() {
  if (!exportBuffer) {
    return { snapshots: [], matchCache: [], leagueIndex: [] };
  }
  return {
    snapshots: [...exportBuffer.snapshots.values()],
    matchCache: [...exportBuffer.matchCache.values()],
    leagueIndex: [...exportBuffer.leagueIndex.values()],
  };
}

function snapshotKey(playerAccountId, snapshotKind) {
  return `${playerAccountId}:${snapshotKind}`;
}

export async function getSnapshot(playerAccountId, snapshotKind) {
  const key = snapshotKey(playerAccountId, snapshotKind);
  const buffered = exportBuffer?.snapshots.get(key);
  if (buffered) {
    return {
      payload: buffered.payload,
      fetched_at: buffered.fetched_at,
      expires_at: buffered.expires_at,
      steam32: buffered.steam32,
    };
  }
  const { rows } = await pool.query(
    `SELECT payload, fetched_at, expires_at, steam32
     FROM player_opendota_snapshots
     WHERE player_account_id = $1 AND snapshot_kind = $2`,
    [playerAccountId, snapshotKind],
  );
  return rows[0] || null;
}

export async function upsertSnapshot({ playerAccountId, snapshotKind, steam32, payload, expiresAt }) {
  if (exportBuffer) {
    const fetchedAt = new Date().toISOString();
    const expiresIso =
      expiresAt instanceof Date ? expiresAt.toISOString() : new Date(expiresAt).toISOString();
    exportBuffer.snapshots.set(snapshotKey(playerAccountId, snapshotKind), {
      player_account_id: playerAccountId,
      snapshot_kind: snapshotKind,
      steam32: steam32 ?? null,
      payload: payload ?? {},
      fetched_at: fetchedAt,
      expires_at: expiresIso,
    });
    return;
  }
  await pool.query(
    `INSERT INTO player_opendota_snapshots (player_account_id, snapshot_kind, steam32, payload, fetched_at, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
     ON CONFLICT (player_account_id, snapshot_kind) DO UPDATE SET
       steam32 = EXCLUDED.steam32,
       payload = EXCLUDED.payload,
       fetched_at = NOW(),
       expires_at = EXCLUDED.expires_at`,
    [playerAccountId, snapshotKind, steam32 ?? null, JSON.stringify(payload ?? {}), expiresAt],
  );
}

export async function upsertLeagueMatchIndexRow({
  dotaMatchId,
  dotaLeagueId,
  startTime,
  radiantWin,
  leagueidVerified,
  steam32Ids,
}) {
  if (exportBuffer) {
    exportBuffer.leagueIndex.set(Number(dotaMatchId), {
      dota_match_id: Number(dotaMatchId),
      dota_league_id: Number(dotaLeagueId),
      start_time: startTime || 0,
      radiant_win: radiantWin ?? null,
      leagueid_verified: Boolean(leagueidVerified),
      steam32_ids: steam32Ids?.length ? steam32Ids : [],
      updated_at: new Date().toISOString(),
    });
    return;
  }
  await pool.query(
    `INSERT INTO opendota_league_match_index (
       dota_match_id, dota_league_id, start_time, radiant_win, leagueid_verified, steam32_ids, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::int[], NOW())
     ON CONFLICT (dota_match_id) DO UPDATE SET
       dota_league_id = EXCLUDED.dota_league_id,
       start_time = EXCLUDED.start_time,
       radiant_win = EXCLUDED.radiant_win,
       leagueid_verified = EXCLUDED.leagueid_verified,
       steam32_ids = EXCLUDED.steam32_ids,
       updated_at = NOW()`,
    [
      dotaMatchId,
      dotaLeagueId,
      startTime || 0,
      radiantWin ?? null,
      Boolean(leagueidVerified),
      steam32Ids?.length ? steam32Ids : [],
    ],
  );
}

export async function listLeagueMatchIndex(dotaLeagueId, { limit = 500 } = {}) {
  const { rows } = await pool.query(
    `SELECT dota_match_id, start_time, radiant_win, leagueid_verified, steam32_ids
     FROM opendota_league_match_index
     WHERE dota_league_id = $1 AND leagueid_verified = TRUE
     ORDER BY start_time DESC
     LIMIT $2`,
    [dotaLeagueId, limit],
  );
  return rows;
}

export async function batchGetMatchLeagueIds(matchIds) {
  if (!matchIds?.length) return new Map();
  const map = new Map();
  if (exportBuffer) {
    for (const id of matchIds) {
      const mid = Number(id);
      const row = exportBuffer.matchCache.get(mid);
      if (!row?.payload) continue;
      const lid =
        row.dota_league_id != null
          ? Number(row.dota_league_id)
          : row.payload.leagueid != null
            ? Number(row.payload.leagueid)
            : null;
      if (lid != null) map.set(mid, lid);
    }
  }
  const { rows } = await pool.query(
    `SELECT dota_match_id,
            COALESCE(
              dota_league_id,
              (payload->>'leagueid')::bigint
            ) AS league_id
     FROM opendota_match_cache
     WHERE dota_match_id = ANY($1::bigint[])`,
    [matchIds],
  );
  for (const row of rows) {
    const lid = row.league_id != null ? Number(row.league_id) : null;
    if (lid != null) map.set(Number(row.dota_match_id), lid);
  }
  return map;
}

/** Player performance rows for a league from tournament match cache (no HTTP). */
export async function listPlayerLeagueRowsFromCache(steam32, dotaLeagueId, limit = 120) {
  const { rows } = await pool.query(
    `SELECT c.dota_match_id, c.payload
     FROM opendota_match_cache c
     WHERE c.dota_league_id = $1
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(c.payload->'players') elem
         WHERE (elem->>'account_id')::bigint = $2
       )
     ORDER BY COALESCE((c.payload->>'start_time')::bigint, 0) DESC
     LIMIT $3`,
    [dotaLeagueId, steam32, limit],
  );

  const out = [];
  for (const row of rows) {
    const payload = row.payload;
    if (!payload?.players) continue;
    const p = payload.players.find((pl) => Number(pl.account_id) === steam32);
    if (!p) continue;
    out.push({
      match_id: Number(row.dota_match_id),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      hero_id: p.hero_id,
      player_slot: p.player_slot,
      radiant_win: payload.radiant_win,
      start_time: payload.start_time,
      leagueid: payload.leagueid != null ? Number(payload.leagueid) : Number(dotaLeagueId),
    });
  }
  return out;
}

export async function getMatchCache(dotaMatchId) {
  const mid = Number(dotaMatchId);
  const buffered = exportBuffer?.matchCache.get(mid);
  if (buffered) {
    return { payload: buffered.payload, fetched_at: buffered.fetched_at };
  }
  const { rows } = await pool.query(`SELECT payload, fetched_at FROM opendota_match_cache WHERE dota_match_id = $1`, [
    dotaMatchId,
  ]);
  return rows[0] || null;
}

export async function upsertMatchCache(dotaMatchId, payload, dotaLeagueId = null) {
  if (exportBuffer) {
    const mid = Number(dotaMatchId);
    const leagueId =
      dotaLeagueId != null
        ? Number(dotaLeagueId)
        : payload?.leagueid != null
          ? Number(payload.leagueid)
          : null;
    exportBuffer.matchCache.set(mid, {
      dota_match_id: mid,
      dota_league_id: leagueId,
      payload: payload ?? {},
      fetched_at: new Date().toISOString(),
    });
    return;
  }
  await pool.query(
    `INSERT INTO opendota_match_cache (dota_match_id, payload, dota_league_id, fetched_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (dota_match_id) DO UPDATE SET
       payload = EXCLUDED.payload,
       dota_league_id = COALESCE(EXCLUDED.dota_league_id, opendota_match_cache.dota_league_id),
       fetched_at = NOW()`,
    [dotaMatchId, JSON.stringify(payload ?? {}), dotaLeagueId],
  );
}

export async function getTournamentDotaLeagueId(tournamentId) {
  const { rows } = await pool.query(`SELECT dota_league_id FROM tournaments WHERE id = $1`, [tournamentId]);
  const id = rows[0]?.dota_league_id;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}
