import rankTable from "../constants/dotaRankTierMmr.json";

const MMR_BY_MEDAL_AND_STARS = rankTable.mmrByMedalAndStars || {};

/**
 * MMR floor from Season 4 chart using OpenDota `rank_tier` (not estimated MMR).
 * API: medal = floor(rank_tier / 10), stars = rank_tier % 10 (Herald = 1 … Divine = 7, e.g. 65 = Ancient 5).
 */
export function mmrFromRankTier(rankTier) {
  const t = Number(rankTier);
  if (!Number.isFinite(t) || t < 1) return null;

  const medal = Math.floor(t / 10);
  const stars = t % 10;
  if (stars < 1 || stars > 5) return null;

  const chartMedal = medal;
  if (chartMedal < 1 || chartMedal > 7) return null;

  const row = MMR_BY_MEDAL_AND_STARS[String(chartMedal)];
  if (!row) return null;

  const mmr = row[String(stars)];
  return mmr != null ? mmr : null;
}
