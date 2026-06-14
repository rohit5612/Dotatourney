/**
 * @deprecated Use org roster from GET /public/site-content instead.
 * Kept for typedefs and dev fallback seed shape only.
 */

export {
  ORG_ROSTER_TIERS,
  ORG_ROSTER_TIER_META,
  DEFAULT_ORG_ROSTER_SECTION as CORE_TEAM_SECTION,
  normalizeOrgRoster,
  getOrgMembersByTier,
  isValidOrgMember,
} from "../utils/seasonContentSchema.js";

/** @deprecated Static roster removed — configure in Admin → Seasons */
export const CORE_TEAM_MEMBERS = [];

export const CORE_TEAM_MIN = 1;
export const CORE_TEAM_MAX = 64;

/** @deprecated Use getOrgMembersByTier from site content API */
export function getCoreTeamForDisplay() {
  return [];
}
