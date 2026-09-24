import { env } from "../config/env.js";

const BASE = "https://api.opendota.com/api";

let lastRequestAt = 0;

async function throttle() {
  const wait = env.opendotaMinRequestIntervalMs - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

/**
 * @param {string} path e.g. `/players/123/wl`
 * @param {Record<string, string | number | undefined>} [query]
 */
export async function opendotaFetch(path, query = {}) {
  await throttle();
  const url = new URL(`${BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  if (env.opendotaApiKey) {
    url.searchParams.set("api_key", env.opendotaApiKey);
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 5_000));
    return opendotaFetch(path, query);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`OpenDota ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function heroSlugFromNpcName(npcName) {
  if (!npcName || typeof npcName !== "string") return "";
  return npcName.replace(/^npc_dota_hero_/, "");
}

/** Same-origin hero art (dota/public/dota-heroes). */
export const DOTA_HERO_PUBLIC_BASE = "/dota-heroes";

export function heroIconUrl(heroSlug) {
  if (!heroSlug) return "";
  return `${DOTA_HERO_PUBLIC_BASE}/portraits/${heroSlug}.png`;
}

export function heroMinimapIconUrl(heroSlug) {
  if (!heroSlug) return "";
  return `${DOTA_HERO_PUBLIC_BASE}/icons/${heroSlug}.png`;
}

export { rankMedalImageUrl } from "../utils/dotaRankMedalAssets.js";

function totalsGameCount(map) {
  const kills = map.get("kills");
  const n = Number(kills?.n) || 0;
  return n > 0 ? n : 0;
}

function avgTotalsField(map, field, n) {
  const row = map.get(field);
  if (!row || !n) return null;
  return Math.round((Number(row.sum) / n) * 10) / 10;
}

/** @param {Array<{ field?: string, n?: number, sum?: number }>} totals */
export function avgKdaFromOpenDotaTotals(totals) {
  if (!Array.isArray(totals) || !totals.length) return null;
  const map = new Map(totals.map((row) => [row.field, row]));
  const n = totalsGameCount(map);
  if (!n) return null;
  const kills = map.get("kills");
  const deaths = map.get("deaths");
  const assists = map.get("assists");
  return {
    kills: Math.round((Number(kills.sum) / n) * 10) / 10,
    deaths: Math.round((Number(deaths.sum) / n) * 10) / 10,
    assists: Math.round((Number(assists.sum) / n) * 10) / 10,
  };
}

/** @param {Array<{ field?: string, n?: number, sum?: number }>} totals */
export function globalPerformanceFromTotals(totals) {
  if (!Array.isArray(totals) || !totals.length) {
    return { avgKda: null, avgGpm: null, avgXpm: null, avgHeroDamage: null, avgTowerDamage: null, avgLastHits: null };
  }
  const map = new Map(totals.map((row) => [row.field, row]));
  const n = totalsGameCount(map);
  if (!n) {
    return { avgKda: null, avgGpm: null, avgXpm: null, avgHeroDamage: null, avgTowerDamage: null, avgLastHits: null };
  }
  return {
    avgKda: avgKdaFromOpenDotaTotals(totals),
    avgGpm: avgTotalsField(map, "gold_per_min", n),
    avgXpm: avgTotalsField(map, "xp_per_min", n),
    avgHeroDamage: avgTotalsField(map, "hero_damage", n),
    avgTowerDamage: avgTotalsField(map, "tower_damage", n),
    avgLastHits: avgTotalsField(map, "last_hits", n),
  };
}

export function dotabuffPlayerUrl(steam32) {
  const id = Number(steam32);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `https://www.dotabuff.com/players/${id}`;
}

/** @param {number | null | undefined} rankTier */
export function rankMedalLabel(rankTier) {
  const t = Number(rankTier);
  if (!Number.isFinite(t) || t < 1) return null;
  const medal = Math.floor(t / 10);
  const stars = t % 10;
  const names = {
    1: "Herald",
    2: "Guardian",
    3: "Crusader",
    4: "Archon",
    5: "Legend",
    6: "Ancient",
    7: "Divine",
    8: "Immortal",
  };
  const base = names[medal] || null;
  if (!base) return null;
  if (medal >= 8) return base;
  if (stars >= 1 && stars <= 5) return `${base} ${stars}`;
  return base;
}
