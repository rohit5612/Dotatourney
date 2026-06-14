/**
 * Seed sponsors_config from the legacy static sponsors.js (v1 landing).
 * Run from server/: node scripts/seed-season1-sponsors.js [seasonNumber]
 * Examples: node scripts/seed-season1-sponsors.js 2
 * Add --force to overwrite existing sponsors on that season.
 */
import { pool } from "../src/db/pool.js";
import { normalizeSponsorsConfig } from "../src/services/seasonContentSchema.js";
import { invalidatePublicCache } from "../src/services/publicCache.js";

const LEGACY_SPONSORS_CONFIG = {
  section: {
    eyebrow: "Powered by partners",
    title: "Sponsors",
    subtitle: "Brands and communities backing BPC League — thank you for fueling the circuit.",
  },
  sponsors: [
    {
      id: "sponsor-co-1",
      name: "WorkInt",
      tagline: "Co-Sponsor",
      tier: "co",
      order: 1,
      logoUrl: "/images/sponsors/workint.png",
      socials: {
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
      logoUrl:
        "https://shared.fastly.steamstatic.com/community_assets/images/items/620/9b150c165611e0f04ac9edb860656d7e67d56fbe.gif",
      socials: {
        steam: "https://steamcommunity.com/profiles/76561198034030852",
        instagram: "https://www.instagram.com/linus_newbie/",
      },
    },
    {
      id: "sponsor-major-2",
      name: "RagnaR",
      tagline: "Mayank Saini",
      tier: "major",
      order: 3,
      logoUrl:
        "https://shared.fastly.steamstatic.com/community_assets/images/items/1091500/d3ca470b90fe64e5203af68b5238e99665b05e2f.gif",
      socials: {
        instagram: "https://www.instagram.com/moondiety_1/",
        steam: "https://steamcommunity.com/id/fireheart1111",
      },
    },
    {
      id: "sponsor-partner-1",
      name: "Roronoa Zoro",
      tagline: "Raj Dodia",
      tier: "partner",
      order: 4,
      logoUrl: "https://avatars.fastly.steamstatic.com/d30daa776ee29ca2630f29bcd22084b1000a65e7_full.jpg",
      socials: {
        steam: "https://steamcommunity.com/profiles/76561198338169972",
      },
    },
    {
      id: "sponsor-partner-2",
      name: "JaamVant",
      tagline: "Ashray Jayant",
      tier: "partner",
      order: 5,
      logoUrl:
        "https://shared.fastly.steamstatic.com/community_assets/images/items/546560/35f54268b2e255954d79ebbb6ef5321b0abc0e4c.gif",
      socials: {
        steam: "https://steamcommunity.com/profiles/76561198053191862",
      },
    },
  ],
};

const force = process.argv.includes("--force");
const seasonNumber = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 1);

async function main() {
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error("Season number must be a positive integer, e.g. node scripts/seed-season1-sponsors.js 2");
  }

  const sponsorsConfig = normalizeSponsorsConfig(LEGACY_SPONSORS_CONFIG);
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `SELECT id, number, slug, name, sponsors_config
       FROM seasons
       WHERE number = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [seasonNumber],
    );
    const season = rows[0];
    if (!season) {
      throw new Error(`No season with number = ${seasonNumber} found. Create or conclude a season first.`);
    }

    const existing = season.sponsors_config && typeof season.sponsors_config === "object" ? season.sponsors_config : {};
    const existingCount = Array.isArray(existing.sponsors) ? existing.sponsors.length : 0;

    if (existingCount > 0 && !force) {
      console.log(
        `Season ${seasonNumber} (${season.slug}) already has ${existingCount} sponsor(s). Re-run with --force to overwrite.`,
      );
      return;
    }

    await client.query(
      `UPDATE seasons SET sponsors_config = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [season.id, JSON.stringify(sponsorsConfig)],
    );

    invalidatePublicCache();

    console.log(
      `Seeded ${sponsorsConfig.sponsors.length} sponsors for Season ${seasonNumber} — ${season.name} (${season.slug}).`,
    );
    for (const sponsor of sponsorsConfig.sponsors) {
      console.log(`  · ${sponsor.tier.padEnd(8)} ${sponsor.name}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
