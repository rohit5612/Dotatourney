/** Public site paths under `dota/public/dota-ranks/` (Vite `public/` root). */
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
 * @param {number | null | undefined} rankTier Valve rank_tier (tens = medal 1–8, ones = stars 1–5)
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
