/**
 * Sponsor schema helpers — data lives in per-season sponsorsConfig (Admin → Seasons).
 */

import { getSponsorsForDisplay as getSponsorsForDisplayFromConfig } from "../utils/seasonContentSchema.js";

export {
  SPONSOR_TIERS,
  SPONSOR_SOCIAL_FIELDS,
  DEFAULT_SPONSORS_SECTION as SPONSORS_SECTION,
  normalizeSponsorsConfig,
  resolveSponsorTierRank,
  sponsorTierLabel,
  getSponsorSocialLinks,
  isValidSponsor,
} from "../utils/seasonContentSchema.js";

export function getSponsorsForDisplay(sponsorsConfig) {
  return getSponsorsForDisplayFromConfig(sponsorsConfig);
}

/** @deprecated Static sponsors removed — configure per season in Admin → Seasons */
export const SPONSORS = [];

export function getCoSponsor(sponsorsConfig) {
  return getSponsorsForDisplay(sponsorsConfig).find((sponsor) => sponsor.tier === "co") || null;
}
