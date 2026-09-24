/** Public site paths under `dota/public/dota-ranks/`. */
import heroCatalog from "../constants/dotaHeroCatalog.json";

const HERO_SLUG_BY_ID = new Map(heroCatalog.map((row) => [Number(row.id), row.slug]));
const HERO_NAME_BY_ID = new Map(
  heroCatalog.map((row) => [Number(row.id), String(row.localized_name || "").trim()]).filter(([, name]) => name),
);
const MEDAL_SLUG_BY_API_MEDAL = {
  1: "herald",
  2: "guardian",
  3: "crusader",
  4: "archon",
  5: "legend",
  6: "ancient",
  7: "divine",
};

const PUBLIC_BASE = "/dota-ranks";

/**
 * @param {number | null | undefined} rankTier
 * @param {{ leaderboardRank?: number | null }} [options]
 */
export function rankMedalImageUrl(rankTier, options = {}) {
  const t = Number(rankTier);
  if (!Number.isFinite(t) || t < 1) return null;

  const medal = Math.floor(t / 10);
  const stars = t % 10;

  if (medal >= 8) {
    const lb = Number(options.leaderboardRank);
    if (Number.isFinite(lb) && lb > 0 && lb <= 10) {
      return `${PUBLIC_BASE}/immortal/immortal_top_10.webp`;
    }
    if (Number.isFinite(lb) && lb > 0 && lb <= 100) {
      return `${PUBLIC_BASE}/immortal/immortal_top_100.webp`;
    }
    return `${PUBLIC_BASE}/immortal/immortal.webp`;
  }

  const slug = MEDAL_SLUG_BY_API_MEDAL[medal];
  if (!slug || stars < 1 || stars > 5) return null;

  return `${PUBLIC_BASE}/${slug}/${slug}_${stars}.webp`;
}

/** Same-origin hero art under `dota/public/dota-heroes/` (see scripts/download-dota-hero-portraits.mjs). */
export const DOTA_HERO_PUBLIC_BASE = "/dota-heroes";

export function heroPortraitUrl(heroSlug) {
  if (!heroSlug) return "";
  return `${DOTA_HERO_PUBLIC_BASE}/portraits/${heroSlug}.png`;
}

export function heroMinimapIconUrl(heroSlug) {
  if (!heroSlug) return "";
  return `${DOTA_HERO_PUBLIC_BASE}/icons/${heroSlug}.png`;
}

/** @deprecated use heroPortraitUrl */
export function heroIconUrl(heroSlug) {
  return heroPortraitUrl(heroSlug);
}

/** @param {number | string | null | undefined} heroId */
export function heroSlugById(heroId) {
  const id = Number(heroId);
  if (!Number.isFinite(id)) return "";
  return HERO_SLUG_BY_ID.get(id) || "";
}

/** @param {number | string | null | undefined} heroId */
export function heroLocalizedNameById(heroId) {
  const id = Number(heroId);
  if (!Number.isFinite(id)) return "";
  return HERO_NAME_BY_ID.get(id) || "";
}

function titleCaseHeroSlug(slug) {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer catalog name over OpenDota placeholders like "Hero 42". */
export function resolveHeroDisplayName(hero) {
  const fromApi = String(hero?.heroName || "").trim();
  if (fromApi && !/^Hero \d+$/i.test(fromApi)) return fromApi;
  const fromCatalog = heroLocalizedNameById(hero?.heroId);
  if (fromCatalog) return fromCatalog;
  const slug = hero?.heroSlug || heroSlugById(hero?.heroId);
  if (slug) return titleCaseHeroSlug(slug);
  return fromApi;
}

/** Resolve slug + local portrait/minimap URLs when API omitted slug (OpenDota heroes payload is id-only). */
export function resolveHeroImageUrls(hero) {
  const slug = hero?.heroSlug || heroSlugById(hero?.heroId);
  return {
    slug,
    name: resolveHeroDisplayName(hero),
    portrait: hero?.heroIconUrl || heroPortraitUrl(slug),
    minimap: hero?.heroMinimapUrl || heroMinimapIconUrl(slug),
  };
}

export function roundedDotaMmr(mmrEstimate) {
  if (mmrEstimate == null || !Number.isFinite(Number(mmrEstimate))) return null;
  return Math.round(Number(mmrEstimate));
}

export function kdaRatio(avgKda) {
  if (!avgKda) return null;
  const d = Math.max(Number(avgKda.deaths) || 0, 1);
  const k = Number(avgKda.kills) || 0;
  const a = Number(avgKda.assists) || 0;
  return Math.round(((k + a) / d) * 10) / 10;
}

export function dotabuffPlayerUrl(steam32) {
  const id = Number(steam32);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `https://www.dotabuff.com/players/${id}`;
}

/** @param {number | null | undefined} value */
export function formatStatCompact(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.round(n / 100) / 10}k`;
  if (n >= 1_000) return `${Math.round(n / 10) / 10}k`;
  return String(Math.round(n * 10) / 10);
}
