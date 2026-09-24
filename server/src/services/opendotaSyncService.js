import { heroSlugById as heroSlugFromLocalCatalog } from "../utils/dotaHeroCatalog.js";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { steam64ToSteam32 } from "../utils/steamId.js";
import {
  heroIconUrl,
  heroSlugFromNpcName,
  opendotaFetch,
} from "./opendotaClient.js";
import {
  batchGetMatchLeagueIds,
  getMatchCache,
  getTournamentDotaLeagueId,
  listLeagueMatchIndex,
  listPlayerLeagueRowsFromCache,
  upsertLeagueMatchIndexRow,
  upsertMatchCache,
  upsertSnapshot,
  getSnapshot,
} from "./opendotaRepository.js";
import { getTournament, updateMatch } from "./tournamentRepository.js";
import { logError } from "../utils/serverLogger.js";

let heroesById = null;

export async function loadHeroesById({ allowFetch = true } = {}) {
  if (heroesById) return heroesById;
  if (!allowFetch) return new Map();
  try {
    const list = await opendotaFetch("/heroes");
    heroesById = new Map();
    for (const h of list || []) {
      if (h?.id != null) heroesById.set(Number(h.id), h);
    }
  } catch (error) {
    logError("opendota.heroes", error);
    heroesById = new Map();
  }
  return heroesById;
}

function heroMeta(heroId, heroesMap) {
  const h = heroesMap.get(Number(heroId));
  const slug = heroSlugFromNpcName(h?.name || "") || heroSlugFromLocalCatalog(heroId);
  return {
    heroId: Number(heroId),
    heroName: h?.localized_name || slug || "Unknown",
    heroSlug: slug,
    heroIconUrl: heroIconUrl(slug),
  };
}

export async function listTournamentPlayerAccounts(tournamentId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT pa.id, pa.steam_id
     FROM player_registrations pr
     JOIN player_accounts pa ON pa.id = pr.player_account_id
     WHERE pr.tournament_id = $1
       AND pr.archived_at IS NULL
       AND pr.registration_status = 'approved'
       AND pa.steam_id IS NOT NULL AND pa.steam_id <> ''
     UNION
     SELECT DISTINCT pa.id, pa.steam_id
     FROM players p
     JOIN player_accounts pa ON pa.id = p.player_account_id
     WHERE p.tournament_id = $1
       AND pa.steam_id IS NOT NULL AND pa.steam_id <> ''`,
    [tournamentId],
  );
  return rows
    .map((r) => ({
      playerAccountId: r.id,
      steam32: steam64ToSteam32(r.steam_id),
    }))
    .filter((r) => r.steam32 != null);
}

export async function fetchAndCacheMatchDetail(dotaMatchId, expectedLeagueId = null) {
  const cached = await getMatchCache(dotaMatchId);
  if (cached?.payload && Object.keys(cached.payload).length > 0) {
    return cached.payload;
  }
  let detail;
  try {
    detail = await opendotaFetch(`/matches/${dotaMatchId}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const leagueId = detail?.leagueid != null ? Number(detail.leagueid) : null;
  if (expectedLeagueId != null && leagueId != null && leagueId !== Number(expectedLeagueId)) {
    return null;
  }
  await upsertMatchCache(dotaMatchId, detail, leagueId);
  const steam32Ids = (detail.players || [])
    .map((p) => Number(p.account_id))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (leagueId) {
    await upsertLeagueMatchIndexRow({
      dotaMatchId,
      dotaLeagueId: leagueId,
      startTime: detail.start_time || 0,
      radiantWin: detail.radiant_win,
      leagueidVerified: expectedLeagueId == null || leagueId === Number(expectedLeagueId),
      steam32Ids,
    });
  }
  return detail;
}

async function resolveMatchLeagueId(dotaMatchId, expectedLeagueId, fetchIfMissing) {
  const cached = await getMatchCache(dotaMatchId);
  if (cached?.payload?.leagueid != null) {
    return Number(cached.payload.leagueid);
  }
  if (!fetchIfMissing) return null;
  const detail = await fetchAndCacheMatchDetail(dotaMatchId, expectedLeagueId);
  return detail?.leagueid != null ? Number(detail.leagueid) : null;
}

/** OpenDota often ignores league_id on amateur leagues — keep only matches whose leagueid matches. */
export async function filterPlayerMatchRowsForLeague(
  rows,
  dotaLeagueId,
  { fetchIfMissing = false, maxDetailFetches = env.opendotaMaxMatchDetailFetchesPerSync } = {},
) {
  const leagueId = Number(dotaLeagueId);
  const mids = (rows || []).map((r) => Number(r.match_id)).filter((n) => Number.isFinite(n));
  const leagueByMatch = await batchGetMatchLeagueIds(mids);
  const verified = [];
  let detailFetches = 0;

  for (const row of rows || []) {
    const mid = Number(row.match_id);
    if (!Number.isFinite(mid)) continue;
    let lid = row.leagueid != null ? Number(row.leagueid) : leagueByMatch.get(mid) ?? null;
    if (lid == null && fetchIfMissing && detailFetches < maxDetailFetches) {
      lid = await resolveMatchLeagueId(mid, leagueId, true);
      detailFetches += 1;
      if (lid != null) leagueByMatch.set(mid, lid);
    }
    if (lid === leagueId) verified.push(row);
  }
  return verified;
}

export async function syncPlayerOpenDotaSnapshots(playerAccountId, steam32) {
  if (!steam32) return { skipped: true, reason: "no_steam32" };
  const expiresAt = new Date(Date.now() + env.opendotaPlayerSnapshotTtlMs);

  const [profile, wl, heroes, totals] = await Promise.all([
    opendotaFetch(`/players/${steam32}`),
    opendotaFetch(`/players/${steam32}/wl`).catch(() => ({ win: 0, lose: 0 })),
    opendotaFetch(`/players/${steam32}/heroes`).catch(() => []),
    opendotaFetch(`/players/${steam32}/totals`).catch(() => []),
  ]);

  await upsertSnapshot({
    playerAccountId,
    snapshotKind: "profile",
    steam32,
    payload: { profile, wl, totals: Array.isArray(totals) ? totals : [] },
    expiresAt,
  });
  await upsertSnapshot({
    playerAccountId,
    snapshotKind: "heroes",
    steam32,
    payload: { heroes: Array.isArray(heroes) ? heroes.slice(0, 20) : [] },
    expiresAt,
  });

  return { ok: true, fetchedAt: new Date().toISOString() };
}

export async function syncPlayerLeagueMatches(playerAccountId, steam32, dotaLeagueId) {
  if (!steam32 || !dotaLeagueId) return { matchIds: [] };
  const kind = `league:${dotaLeagueId}`;
  const existing = await getSnapshot(playerAccountId, kind);
  if (
    existing?.expires_at &&
    new Date(existing.expires_at) > new Date() &&
    existing.payload?.verifiedLeague === true
  ) {
    const ids = existing.payload?.matchIds || [];
    return { matchIds: ids, cached: true };
  }

  let verified = await listPlayerLeagueRowsFromCache(steam32, dotaLeagueId, 120);

  if (verified.length === 0) {
    const list = await opendotaFetch(`/players/${steam32}/matches`, {
      league_id: dotaLeagueId,
      limit: 100,
    });
    verified = await filterPlayerMatchRowsForLeague(list, dotaLeagueId, {
      fetchIfMissing: true,
      maxDetailFetches: env.opendotaMaxMatchDetailFetchesPerSync,
    });
  }
  const matchIds = [];
  for (const row of verified) {
    const mid = Number(row.match_id);
    if (!Number.isFinite(mid)) continue;
    matchIds.push(mid);
    await upsertLeagueMatchIndexRow({
      dotaMatchId: mid,
      dotaLeagueId,
      startTime: row.start_time || 0,
      radiantWin: row.radiant_win,
      leagueidVerified: true,
      steam32Ids: [steam32],
    });
  }

  const expiresAt = new Date(Date.now() + env.opendotaLeagueIndexTtlMs);
  await upsertSnapshot({
    playerAccountId,
    snapshotKind: kind,
    steam32,
    payload: { matchIds, raw: verified, verifiedLeague: true },
    expiresAt,
  });

  return { matchIds };
}

export async function syncLeagueIndexFromRoster(tournamentId) {
  const leagueId = await getTournamentDotaLeagueId(tournamentId);
  if (!leagueId) {
    return { ok: false, error: "Tournament has no dota_league_id" };
  }
  const roster = await listTournamentPlayerAccounts(tournamentId);
  const allMatchIds = new Set();
  let playersSynced = 0;
  for (const { playerAccountId, steam32 } of roster) {
    try {
      const { matchIds } = await syncPlayerLeagueMatches(playerAccountId, steam32, leagueId);
      for (const id of matchIds) allMatchIds.add(id);
      playersSynced += 1;
    } catch (error) {
      logError("opendota.syncPlayerLeague", error, { playerAccountId, steam32 });
    }
  }

  let verified = 0;
  for (const dotaMatchId of allMatchIds) {
    try {
      const detail = await fetchAndCacheMatchDetail(dotaMatchId, leagueId);
      if (detail) verified += 1;
    } catch (error) {
      logError("opendota.matchDetail", error, { dotaMatchId });
    }
  }

  return { ok: true, leagueId, playersSynced, matchIds: allMatchIds.size, verified };
}

function parseMatchMeta(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function overlapCount(setA, setB) {
  let n = 0;
  for (const x of setA) {
    if (setB.has(x)) n += 1;
  }
  return n;
}

export async function linkTournamentMatches(tournamentId) {
  const leagueId = await getTournamentDotaLeagueId(tournamentId);
  if (!leagueId) return { ok: false, error: "No dota_league_id" };

  await syncLeagueIndexFromRoster(tournamentId);
  const indexRows = await listLeagueMatchIndex(leagueId, { limit: 800 });
  const snapshot = await getTournament(tournamentId);
  if (!snapshot?.matches?.length) return { ok: true, linked: 0 };

  const { rows: lineupRows } = await pool.query(
    `SELECT mlp.match_id, mlp.team_name, mlp.player_account_id, pa.steam_id
     FROM match_lineup_players mlp
     JOIN player_accounts pa ON pa.id = mlp.player_account_id
     WHERE mlp.tournament_id = $1 AND mlp.is_substitute = FALSE`,
    [tournamentId],
  );

  const steamByMatchTeam = new Map();
  for (const row of lineupRows) {
    const s32 = steam64ToSteam32(row.steam_id);
    if (!s32) continue;
    const key = `${row.match_id}::${(row.team_name || "").toLowerCase()}`;
    if (!steamByMatchTeam.has(key)) steamByMatchTeam.set(key, new Set());
    steamByMatchTeam.get(key).add(s32);
  }

  const { rows: scheduleRows } = await pool.query(
    `SELECT match_id, start_at FROM schedule_slots WHERE tournament_id = $1`,
    [tournamentId],
  );
  const startAtByMatch = new Map(scheduleRows.map((r) => [String(r.match_id), r.start_at]));

  let linked = 0;
  for (const match of snapshot.matches) {
    const meta = parseMatchMeta(match.meta);
    if (meta.dotaLinkSource === "admin" && Array.isArray(meta.dotaMatchIds) && meta.dotaMatchIds.length) {
      continue;
    }
    if (match.status !== "finished" && !match.winner) continue;

    const matchId = String(match.id);
    const startAt = startAtByMatch.get(matchId);
    const startMs = startAt ? new Date(startAt).getTime() : null;
    const team1Key = `${matchId}::${(match.team1 || "").toLowerCase()}`;
    const team2Key = `${matchId}::${(match.team2 || "").toLowerCase()}`;
    const team1Steam = steamByMatchTeam.get(team1Key) || new Set();
    const team2Steam = steamByMatchTeam.get(team2Key) || new Set();
    const expected = new Set([...team1Steam, ...team2Steam]);
    if (expected.size < 4) continue;

    let best = null;
    let bestScore = 0;
    for (const idx of indexRows) {
      const steamSet = new Set((idx.steam32_ids || []).map(Number));
      const overlap = overlapCount(expected, steamSet);
      if (overlap < 4) continue;
      if (startMs != null && idx.start_time) {
        const diff = Math.abs(startMs - idx.start_time * 1000);
        if (diff > 4 * 60 * 60 * 1000) continue;
      }
      const score = overlap + (startMs != null && idx.start_time ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    }

    if (!best) continue;
    const dotaMatchIds = [Number(best.dota_match_id)];
    const nextMeta = {
      ...meta,
      dotaMatchIds,
      dotaLinkSource: "auto",
      dotaLinkedAt: new Date().toISOString(),
    };
    const updated = {
      ...match,
      meta: nextMeta,
    };
    await updateMatch(tournamentId, matchId, updated);
    linked += 1;
  }

  return { ok: true, linked };
}

function playerWonMatch(row) {
  const slot = Number(row.player_slot);
  if (!Number.isFinite(slot)) return null;
  const radiant = slot < 128;
  return radiant ? Boolean(row.radiant_win) : !row.radiant_win;
}

function aggregateLeagueStatsFromPlayerMatches(rawList, steam32, dotaLeagueId, heroesMap) {
  const heroAgg = new Map();
  let wins = 0;
  let losses = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let games = 0;

  for (const row of rawList || []) {
    if (row.account_id != null && Number(row.account_id) !== steam32) continue;
    if (row.leagueid != null && Number(row.leagueid) !== Number(dotaLeagueId)) continue;
    games += 1;
    const won = playerWonMatch(row);
    if (won === true) wins += 1;
    else if (won === false) losses += 1;
    kills += Number(row.kills) || 0;
    deaths += Number(row.deaths) || 0;
    assists += Number(row.assists) || 0;
    const hid = Number(row.hero_id);
    if (!Number.isFinite(hid)) continue;
    if (!heroAgg.has(hid)) {
      heroAgg.set(hid, { ...heroMeta(hid, heroesMap), games: 0, wins: 0 });
    }
    const agg = heroAgg.get(hid);
    agg.games += 1;
    if (won === true) agg.wins += 1;
  }

  return { games, wins, losses, kills, deaths, assists, heroAgg };
}

export async function buildLeagueStatsForPlayer(
  playerAccountId,
  steam32,
  dotaLeagueId,
  { allowOpenDotaSync = true } = {},
) {
  // League stats are OpenDota-only: /players/{steam32}/matches?league_id=… (verified leagueid).
  // BPC bracket match history may differ; never aggregate from tournament DB matches here.
  const kind = `league_stats:${dotaLeagueId}`;
  const existing = await getSnapshot(playerAccountId, kind);
  let staleLeagueStats = null;
  if (existing?.payload && Number(existing.payload?.games) > 0) {
    if (existing.expires_at && new Date(existing.expires_at) > new Date()) {
      return existing.payload;
    }
    staleLeagueStats = existing.payload;
    if (!allowOpenDotaSync) {
      return staleLeagueStats;
    }
  }

  const leagueKind = `league:${dotaLeagueId}`;
  let leagueSnap = await getSnapshot(playerAccountId, leagueKind);
  if (
    allowOpenDotaSync &&
    steam32 &&
    (!leagueSnap?.payload?.verifiedLeague ||
      !Array.isArray(leagueSnap?.payload?.raw) ||
      leagueSnap.payload.raw.length === 0)
  ) {
    await syncPlayerLeagueMatches(playerAccountId, steam32, dotaLeagueId);
    leagueSnap = await getSnapshot(playerAccountId, leagueKind);
  }

  let rawList = leagueSnap?.payload?.raw || [];
  let matchIds = leagueSnap?.payload?.matchIds || [];

  const fromCache = await listPlayerLeagueRowsFromCache(steam32, dotaLeagueId, 120);
  if (fromCache.length > 0) {
    rawList = fromCache;
    matchIds = fromCache.map((row) => Number(row.match_id)).filter((n) => Number.isFinite(n));
  } else if (leagueSnap?.payload?.verifiedLeague !== true && rawList.length > 0) {
    rawList = await filterPlayerMatchRowsForLeague(rawList, dotaLeagueId, { fetchIfMissing: false });
    matchIds = rawList.map((row) => Number(row.match_id)).filter((n) => Number.isFinite(n));
  }

  const heroesMap = await loadHeroesById({ allowFetch: allowOpenDotaSync });
  let heroAgg = new Map();
  let wins = 0;
  let losses = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let games = 0;

  if (Array.isArray(rawList) && rawList.length > 0) {
    const fromList = aggregateLeagueStatsFromPlayerMatches(rawList, steam32, dotaLeagueId, heroesMap);
    games = fromList.games;
    wins = fromList.wins;
    losses = fromList.losses;
    kills = fromList.kills;
    deaths = fromList.deaths;
    assists = fromList.assists;
    heroAgg = fromList.heroAgg;
  }

  if (games === 0) {
    for (const dotaMatchId of matchIds.slice(0, 80)) {
      const cached = await getMatchCache(dotaMatchId);
      const detail = cached?.payload;
      if (!detail?.players) continue;
      if (detail.leagueid != null && Number(detail.leagueid) !== Number(dotaLeagueId)) {
        continue;
      }
      const p = detail.players.find((row) => Number(row.account_id) === steam32);
      if (!p) continue;
      games += 1;
      const won = p.player_slot < 128 ? detail.radiant_win : !detail.radiant_win;
      if (won) wins += 1;
      else losses += 1;
      kills += Number(p.kills) || 0;
      deaths += Number(p.deaths) || 0;
      assists += Number(p.assists) || 0;
      const hid = Number(p.hero_id);
      if (!heroAgg.has(hid)) {
        heroAgg.set(hid, { ...heroMeta(hid, heroesMap), games: 0, wins: 0 });
      }
      const agg = heroAgg.get(hid);
      agg.games += 1;
      if (won) agg.wins += 1;
    }
  }

  const topHeroes = [...heroAgg.values()]
    .sort((a, b) => b.games - a.games)
    .slice(0, 8)
    .map((h) => ({
      ...h,
      winRate: h.games ? Math.round((h.wins / h.games) * 100) : 0,
    }));

  const payload = {
    dotaLeagueId,
    games,
    wins,
    losses,
    winRate: games ? Math.round((wins / games) * 100) : null,
    avgKda:
      games > 0
        ? {
            kills: Math.round((kills / games) * 10) / 10,
            deaths: Math.round((deaths / games) * 10) / 10,
            assists: Math.round((assists / games) * 10) / 10,
          }
        : null,
    topHeroes,
  };

  if (games === 0 && staleLeagueStats) {
    return staleLeagueStats;
  }

  if (!allowOpenDotaSync && games === 0) {
    return staleLeagueStats ?? payload;
  }

  const expiresAt = new Date(Date.now() + env.opendotaLeagueIndexTtlMs);
  await upsertSnapshot({
    playerAccountId,
    snapshotKind: kind,
    steam32,
    payload,
    expiresAt,
  });

  return payload;
}

export function summarizePlayerPerformanceInMatch(detail, steam32, heroesMap) {
  if (!detail?.players || !steam32) return null;
  const p = detail.players.find((row) => Number(row.account_id) === steam32);
  if (!p) return null;
  const won = p.player_slot < 128 ? detail.radiant_win : !detail.radiant_win;
  const meta = heroMeta(p.hero_id, heroesMap);
  return {
    dotaMatchId: detail.match_id,
    heroId: meta.heroId,
    heroName: meta.heroName,
    heroSlug: meta.heroSlug,
    heroIconUrl: meta.heroIconUrl,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    gpm: p.gold_per_min,
    xpm: p.xp_per_min,
    duration: detail.duration,
    won,
    startTime: detail.start_time,
    opendotaUrl: `https://www.opendota.com/matches/${detail.match_id}`,
    dotabuffUrl: `https://www.dotabuff.com/matches/${detail.match_id}`,
  };
}

export async function enrichMatchHistoryWithDota(playerAccountId, steam32, matchHistory) {
  if (!steam32 || !matchHistory?.length) return matchHistory;
  const heroesMap = await loadHeroesById({ allowFetch: false });
  const enriched = [];
  for (const row of matchHistory) {
    const dotaMatchIds = Array.isArray(row.dotaMatchIds) ? row.dotaMatchIds : [];
    const games = [];
    for (const id of dotaMatchIds) {
      try {
        const detail = await getMatchCache(Number(id));
        let payload = detail?.payload;
        if (!payload) {
          continue;
        }
        const summary = summarizePlayerPerformanceInMatch(payload, steam32, heroesMap);
        if (summary) games.push(summary);
      } catch {
        // skip
      }
    }
    enriched.push({ ...row, dotaGames: games });
  }
  return enriched;
}
