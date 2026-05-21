/** @typedef {'hero'|'large'|'medium'|'small'} SponsorCardSize */
/** @typedef {'left'|'center'|'right'} PodiumPosition */

/**
 * @typedef {Object} SponsorPodiumSlot
 * @property {import('../constants/sponsors.js').Sponsor & { tierRank: number }} sponsor
 * @property {SponsorCardSize} size
 * @property {PodiumPosition} position
 */

/**
 * @typedef {Object} SponsorGallerySlot
 * @property {import('../constants/sponsors.js').Sponsor & { tierRank: number }} sponsor
 * @property {SponsorCardSize} size
 */

/**
 * @param {number} tierRank
 * @returns {SponsorCardSize}
 */
export function sizeForTierRank(tierRank) {
  if (tierRank >= 100) return "hero";
  if (tierRank >= 70) return "large";
  if (tierRank >= 50) return "medium";
  return "small";
}

/**
 * Sort sponsors by prominence (tierRank desc, then order asc).
 * @param {Array<import('../constants/sponsors.js').Sponsor & { tierRank?: number }>} sponsors
 */
export function sortSponsorsByProminence(sponsors) {
  return [...sponsors].sort((a, b) => {
    const rankDiff = (b.tierRank ?? 0) - (a.tierRank ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/**
 * Stage layout: center = #1, flanks = #2 and #3 in a 3-1-2 podium (left = third, right = second).
 * Remaining sponsors fill a gallery row below with tier-based sizes.
 *
 * @param {Array<import('../constants/sponsors.js').Sponsor & { tierRank: number }>} sponsors
 * @returns {{ podium: SponsorPodiumSlot[], gallery: SponsorGallerySlot[] }}
 */
export function buildSponsorStageLayout(sponsors) {
  const sorted = sortSponsorsByProminence(sponsors);
  if (!sorted.length) return { podium: [], gallery: [] };

  if (sorted.length === 1) {
    return {
      podium: [{ sponsor: sorted[0], size: sizeForTierRank(sorted[0].tierRank), position: "center" }],
      gallery: [],
    };
  }

  if (sorted.length === 2) {
    return {
      podium: [
        { sponsor: sorted[1], size: sizeForTierRank(sorted[1].tierRank), position: "left" },
        { sponsor: sorted[0], size: sizeForTierRank(sorted[0].tierRank), position: "right" },
      ],
      gallery: [],
    };
  }

  const [first, second, third, ...rest] = sorted;
  const podium = [
    { sponsor: third, size: sizeForTierRank(third.tierRank), position: "left" },
    { sponsor: first, size: sizeForTierRank(first.tierRank), position: "center" },
    { sponsor: second, size: sizeForTierRank(second.tierRank), position: "right" },
  ];

  const gallery = rest.map((sponsor) => ({
    sponsor,
    size: sizeForTierRank(sponsor.tierRank),
  }));

  return { podium, gallery };
}
