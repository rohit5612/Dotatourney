export const ORG_ROSTER_TIERS = ["founder", "admin", "mod", "caster"];

export const ORG_ROSTER_TIER_META = {
  founder: { label: "Founders", rank: 4 },
  admin: { label: "Admins", rank: 3 },
  mod: { label: "Moderators", rank: 2 },
  caster: { label: "Casters", rank: 1 },
};

export const SPONSOR_TIERS = {
  co: { label: "Co-Sponsor", rank: 100 },
  major: { label: "Major Partner", rank: 70 },
  partner: { label: "Partner", rank: 50 },
  supporter: { label: "Supporter", rank: 30 },
};

export const DEFAULT_ORG_ROSTER_SECTION = {
  eyebrow: "Behind the circuit",
  title: "The people behind BPC",
};

export const DEFAULT_SPONSORS_SECTION = {
  eyebrow: "Powered by partners",
  title: "Sponsors",
  subtitle: "Brands and communities backing BPC League — thank you for fueling the circuit.",
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidOrgMember(row) {
  if (!row || typeof row !== "object") return false;
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.gamerTag) &&
    isNonEmptyString(row.realName) &&
    isNonEmptyString(row.avatarUrl) &&
    ORG_ROSTER_TIERS.includes(String(row.tier || "").trim())
  );
}

export function isValidSponsor(row) {
  if (!row || typeof row !== "object") return false;
  const tier = String(row.tier ?? "").trim();
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.name) &&
    isNonEmptyString(row.logoUrl) &&
    tier in SPONSOR_TIERS
  );
}

export function isValidArchiveEmbed(row) {
  if (!row || typeof row !== "object") return false;
  return isNonEmptyString(row.id) && isNonEmptyString(row.label) && isNonEmptyString(row.youtubeUrl);
}

export function resolveSponsorTierRank(sponsor) {
  if (typeof sponsor.tierRank === "number" && Number.isFinite(sponsor.tierRank)) {
    return sponsor.tierRank;
  }
  return SPONSOR_TIERS[sponsor.tier]?.rank ?? 0;
}

export function sponsorTierLabel(sponsor) {
  return SPONSOR_TIERS[sponsor.tier]?.label ?? "Partner";
}

export function normalizeOrgRoster(payload) {
  const section = payload?.section && typeof payload.section === "object" ? payload.section : {};
  const members = Array.isArray(payload?.members) ? payload.members.filter(isValidOrgMember) : [];
  const sorted = [...members].sort((a, b) => {
    const tierDiff = (ORG_ROSTER_TIER_META[b.tier]?.rank ?? 0) - (ORG_ROSTER_TIER_META[a.tier]?.rank ?? 0);
    if (tierDiff !== 0) return tierDiff;
    return (a.order ?? 999) - (b.order ?? 999);
  });
  return { section, members: sorted };
}

export function normalizeSponsorsConfig(payload) {
  const section = payload?.section && typeof payload.section === "object" ? payload.section : {};
  const sponsors = Array.isArray(payload?.sponsors)
    ? payload.sponsors.filter(isValidSponsor).map((sponsor) => ({
        ...sponsor,
        tierRank: resolveSponsorTierRank(sponsor),
      }))
    : [];
  return { section, sponsors };
}

export function normalizeArchiveEmbeds(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.filter(isValidArchiveEmbed);
}

export function getSponsorsForDisplay(sponsorsConfig) {
  const normalized = normalizeSponsorsConfig(sponsorsConfig || {});
  return normalized.sponsors.sort((a, b) => {
    const rankDiff = (b.tierRank ?? 0) - (a.tierRank ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return (a.order ?? 999) - (b.order ?? 999);
  });
}

export function getOrgMembersByTier(orgRoster) {
  const normalized = normalizeOrgRoster(orgRoster || {});
  const byTier = { founder: [], admin: [], mod: [], caster: [] };
  for (const member of normalized.members) {
    if (byTier[member.tier]) byTier[member.tier].push(member);
  }
  return { section: normalized.section, byTier };
}

const SOCIAL_KEYS = ["website", "youtube", "instagram", "discord", "steam", "facebook", "linkedin"];

export const SPONSOR_SOCIAL_FIELDS = [
  { key: "website", label: "Website" },
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "discord", label: "Discord" },
  { key: "steam", label: "Steam" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
];

export function getSponsorSocialLinks(sponsor) {
  const socials = sponsor?.socials || {};
  return SOCIAL_KEYS.filter((key) => isNonEmptyString(socials[key])).map((key) => ({
    key,
    url: socials[key].trim(),
  }));
}

export function createEmptyOrgMember(tier = "admin") {
  return {
    id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    gamerTag: "",
    realName: "",
    role: "",
    avatarUrl: "",
    tier,
    order: 0,
  };
}

export function createEmptySponsor(tier = "partner") {
  return {
    id: `sponsor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    tagline: "",
    tier,
    order: 0,
    logoUrl: "",
    socials: {},
  };
}

export function createEmptyArchiveEmbed() {
  return {
    id: `embed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    youtubeUrl: "",
  };
}
