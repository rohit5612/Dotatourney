/**
 * Landing page sponsors (static v1).
 *
 * Rules:
 * - tier: "co" | "major" | "partner" | "supporter" (drives card scale; amounts are never shown).
 * - tierRank: optional override for sort order (higher = more prominent). Defaults from tier.
 * - order: tie-break within the same tier (lower = earlier).
 * - logoUrl: image under /public/images/sponsors/ or any HTTPS URL.
 * - socials: only include keys you have URLs for (instagram, discord, steam, facebook, linkedin, website).
 */

export const SPONSOR_TIERS = {
  co: { label: "Co-Sponsor", rank: 100 },
  major: { label: "Major Partner", rank: 70 },
  partner: { label: "Partner", rank: 50 },
  supporter: { label: "Supporter", rank: 30 },
};

export const SPONSORS_SECTION = {
  eyebrow: "Powered by partners",
  title: "Sponsors",
  subtitle: "Brands and communities backing BPC League — thank you for fueling the circuit.",
};

/** @typedef {'co'|'major'|'partner'|'supporter'} SponsorTier */

/**
 * @typedef {Object} SponsorSocials
 * @property {string} [instagram]
 * @property {string} [discord]
 * @property {string} [steam]
 * @property {string} [facebook]
 * @property {string} [linkedin]
 * @property {string} [website]
 */

/**
 * @typedef {Object} Sponsor
 * @property {string} id
 * @property {string} name
 * @property {string} [tagline]
 * @property {SponsorTier} tier
 * @property {number} [tierRank]
 * @property {number} [order]
 * @property {string} logoUrl
 * @property {SponsorSocials} [socials]
 */

/** @type {Sponsor[]} */
export const SPONSORS = [
  {
    id: "sponsor-co-1",
    name: "WorkInt",
    tagline: "Co-Sponsor",
    tier: "co",
    order: 1,
    logoUrl: "/images/sponsors/workint.png",
    socials: {
      website: "",
      discord: "https://discord.gg/PN4ccCMyC2",
      instagram: "https://www.instagram.com/workint_/",
    },
  },
  {
    id: "sponsor-major-1",
    name: "L!NU$. 4 ^ JpR",
    tagline: "Sunil Naval",
    tier: "major",
    order: 2,
    logoUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/620/9b150c165611e0f04ac9edb860656d7e67d56fbe.gif",
    socials: {
      steam: "hhttps://steamcommunity.com/profiles/76561198034030852",
      discord: "",
      instagram: "https://www.instagram.com/linus_newbie/",
    },
  },
  {
    id: "sponsor-major-2",
    name: "RagnaR",
    tagline: "Mayank Saini",
    tier: "major",
    order: 3,
    logoUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/1091500/d3ca470b90fe64e5203af68b5238e99665b05e2f.gif",
    socials: {
      instagram: "https://www.instagram.com/moondiety_1/",
      steam: "https://steamcommunity.com/id/fireheart1111",
      discord: "",
    },
  },
  {
    id: "sponsor-partner-1",
    name: "Roronoa Zoro",
    tagline: "Raj Dodia",
    tier: "partner",
    order: 3,
    logoUrl: "https://avatars.fastly.steamstatic.com/d30daa776ee29ca2630f29bcd22084b1000a65e7_full.jpg",
    socials: {
      instagram: "",
      steam: "https://steamcommunity.com/profiles/76561198338169972",
      discord: "",
    },
  },
  {
    id: "sponsor-partner-2",
    name: "JaamVant",
    tagline: "Ashray Jayant",
    tier: "partner",
    order: 3,
    logoUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/546560/35f54268b2e255954d79ebbb6ef5321b0abc0e4c.gif",
    socials: {
      instagram: "",
      steam: "https://steamcommunity.com/profiles/76561198053191862",
      discord: "",
    },
  },
  
];

function isValidSponsor(row) {
  if (!row || typeof row !== "object") return false;
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  const logoUrl = String(row.logoUrl ?? "").trim();
  const tier = String(row.tier ?? "").trim();
  return Boolean(id && name && logoUrl && tier in SPONSOR_TIERS);
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

/**
 * @returns {Sponsor[]}
 */
export function getSponsorsForDisplay() {
  return SPONSORS.filter(isValidSponsor).map((sponsor) => ({
    ...sponsor,
    tierRank: resolveSponsorTierRank(sponsor),
  }));
}

/** First co-sponsor entry for hero / registration callouts. */
export function getCoSponsor() {
  return getSponsorsForDisplay().find((sponsor) => sponsor.tier === "co") || null;
}

const SOCIAL_KEYS = ["instagram", "discord", "steam", "facebook", "linkedin", "website"];

/** @param {Sponsor} sponsor */
export function getSponsorSocialLinks(sponsor) {
  const socials = sponsor?.socials || {};
  return SOCIAL_KEYS.filter((key) => {
    const url = socials[key];
    return typeof url === "string" && url.trim().length > 0;
  }).map((key) => ({ key, url: socials[key].trim() }));
}
