import { findAccountBySlug } from "./playerAccountRepository.js";
import { steam64ToSteam32 } from "../utils/steamId.js";
import { mmrFromRankTier } from "../utils/dotaRankMmr.js";
import { heroLocalizedNameById, heroSlugById } from "../utils/dotaHeroCatalog.js";
import {
  dotabuffPlayerUrl,
  globalPerformanceFromTotals,
  heroMinimapIconUrl,
  heroSlugFromNpcName,
  heroIconUrl,
  rankMedalImageUrl,
  rankMedalLabel,
} from "./opendotaClient.js";
import { getSnapshot } from "./opendotaRepository.js";
import { pool } from "../db/pool.js";
import { buildLeagueStatsForPlayer, enrichMatchHistoryWithDota, loadHeroesById } from "./opendotaSyncService.js";
import { buildPublicMatchHistory } from "./playerRecognitionService.js";

export async function getPublicPlayerDotaStats(slug) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;

  const steam32 = steam64ToSteam32(account.steam_id);
  if (!steam32) {
    return {
      available: false,
      reason: "steam_not_linked",
      lastUpdated: null,
      global: null,
      leagues: [],
    };
  }

  const profileSnap = await getSnapshot(account.id, "profile");
  const heroesSnap = await getSnapshot(account.id, "heroes");

  const profilePayload = profileSnap?.payload || {};
  const profile = profilePayload.profile || {};
  const wl = profilePayload.wl || {};
  const heroesRaw = heroesSnap?.payload?.heroes || [];
  let heroesById = new Map();
  try {
    heroesById = await loadHeroesById({ allowFetch: false });
  } catch {
    heroesById = new Map();
  }

  const topHeroesGlobal = heroesRaw
    .slice()
    .sort((a, b) => (b.games || 0) - (a.games || 0))
    .slice(0, 6)
    .map((h) => {
      const catalog = heroesById.get(Number(h.hero_id));
      const slug =
        heroSlugFromNpcName(catalog?.name || h.name || "") || heroSlugById(h.hero_id);
      const games = Number(h.games) || 0;
      const wins = Number(h.win) || 0;
      return {
        heroId: Number(h.hero_id) || null,
        heroName:
          catalog?.localized_name ||
          h.localized_name ||
          heroLocalizedNameById(h.hero_id) ||
          slug ||
          `Hero ${h.hero_id}`,
        heroSlug: slug,
        heroIconUrl: heroIconUrl(slug),
        heroMinimapUrl: heroMinimapIconUrl(slug),
        games,
        wins,
        winRate: games ? Math.round((wins / games) * 100) : 0,
      };
    });

  const totals = profilePayload.totals;
  const performance = globalPerformanceFromTotals(totals);
  const wins = Number(wl.win) || 0;
  const losses = Number(wl.lose) || 0;
  const rankTier = profile.rank_tier ?? null;
  const leaderboardRank = profile.leaderboard_rank ?? null;

  let leagueRows = [];
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (t.dota_league_id)
              t.id,
              t.slug,
              t.name,
              t.dota_league_id,
              s.slug AS season_slug,
              s.number AS season_number
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
           WHERE pr.player_account_id = $1
             AND pr.archived_at IS NULL
           UNION
           SELECT DISTINCT s2.tournament_id
           FROM season_participations sp
           JOIN seasons s2 ON s2.id = sp.season_id
           WHERE sp.player_account_id = $1
         )
       ORDER BY t.dota_league_id, s.number DESC NULLS LAST`,
      [account.id],
    );
    leagueRows = result.rows;
  } catch (error) {
    if (error?.code !== "42703") throw error;
  }

  const leagues = [];
  for (const row of leagueRows) {
    const leagueId = Number(row.dota_league_id);
    if (!Number.isFinite(leagueId)) continue;
    let stats = null;
    try {
      stats = await buildLeagueStatsForPlayer(account.id, steam32, leagueId, {
        allowOpenDotaSync: false,
      });
    } catch {
      stats = null;
    }
    if (!stats || Number(stats.games) <= 0) {
      const leagueStatsSnap = await getSnapshot(account.id, `league_stats:${leagueId}`);
      if (leagueStatsSnap?.payload && Number(leagueStatsSnap.payload.games) > 0) {
        stats = leagueStatsSnap.payload;
      }
    }
    leagues.push({
      tournamentSlug: row.slug,
      tournamentName: row.name,
      seasonSlug: row.season_slug,
      seasonNumber: row.season_number,
      dotaLeagueId: leagueId,
      stats,
      dotabuffLeagueUrl: `https://www.dotabuff.com/esports/leagues/${leagueId}`,
    });
  }

  const matchHistory = await buildPublicMatchHistory(account.id);
  const withMeta = await attachDotaMatchIdsFromDb(matchHistory);
  const matchHistoryEnriched = await enrichMatchHistoryWithDota(account.id, steam32, withMeta);

  const lastUpdated = profileSnap?.fetched_at || null;

  return {
    available: true,
    steam32,
    lastUpdated,
    global: {
      rankTier,
      rankLabel: rankMedalLabel(rankTier),
      rankMedalUrl: rankMedalImageUrl(rankTier, { leaderboardRank }),
      leaderboardRank,
      rankMmr: mmrFromRankTier(rankTier),
      mmrEstimate: profile.mmr_estimate?.estimate ?? profile.computed_mmr ?? null,
      wins,
      losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
      totalGames: wins + losses > 0 ? wins + losses : null,
      avgKda: performance.avgKda,
      avgGpm: performance.avgGpm,
      avgXpm: performance.avgXpm,
      avgHeroDamage: performance.avgHeroDamage,
      avgTowerDamage: performance.avgTowerDamage,
      avgLastHits: performance.avgLastHits,
      topHeroes: topHeroesGlobal,
      opendotaProfileUrl: `https://www.opendota.com/players/${steam32}`,
      dotabuffProfileUrl: dotabuffPlayerUrl(steam32),
    },
    leagues,
    matchHistory: matchHistoryEnriched,
  };
}

async function attachDotaMatchIdsFromDb(matchHistory) {
  if (!matchHistory?.length) return [];
  const ids = [...new Set(matchHistory.map((m) => m.matchId).filter(Boolean))];
  if (!ids.length) return matchHistory;
  const { rows } = await pool.query(`SELECT id, meta FROM matches WHERE id = ANY($1::uuid[])`, [ids]);
  const metaById = new Map(rows.map((r) => [String(r.id), r.meta]));
  return matchHistory.map((row) => {
    const raw = metaById.get(String(row.matchId));
    let meta = raw;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    const dotaMatchIds = Array.isArray(meta?.dotaMatchIds)
      ? meta.dotaMatchIds.map(Number).filter((n) => Number.isFinite(n))
      : [];
    return { ...row, dotaMatchIds };
  });
}
