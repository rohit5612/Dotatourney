/**
 * Seed franchise lore (and short taglines) for league_teams.
 *
 * Usage (from server/):
 *   node scripts/seed-league-team-lore.js --check
 *   node scripts/seed-league-team-lore.js --apply
 *   node scripts/seed-league-team-lore.js --apply --force
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { FRANCHISE_COPY } from "./data/leagueFranchiseLore.js";

dotenv.config();

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  const { rows } = await pool.query(`SELECT id, slug, name, lore, tagline FROM league_teams ORDER BY name`);
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const copy = FRANCHISE_COPY[row.slug];
    if (!copy) {
      console.warn(`No copy for slug: ${row.slug} (${row.name})`);
      continue;
    }

    const hasLore = String(row.lore || "").trim().length > 0;
    const hasTagline = String(row.tagline || "").trim().length > 0;
    if (!force && hasLore && hasTagline) {
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`[check] ${row.name}: would set tagline + lore`);
      continue;
    }

    await pool.query(
      `UPDATE league_teams SET
        tagline = CASE WHEN $2::boolean OR trim(tagline) = '' THEN $3 ELSE tagline END,
        lore = CASE WHEN $2::boolean OR trim(lore) = '' THEN $4 ELSE lore END,
        updated_at = NOW()
       WHERE id = $1`,
      [row.id, force, copy.tagline, copy.lore],
    );
    updated += 1;
    console.log(`Updated ${row.name}`);
  }

  if (apply) {
    console.log(`Done. updated=${updated}, skipped=${skipped}`);
  } else {
    console.log(`Check complete. ${rows.length} teams, ${Object.keys(FRANCHISE_COPY).length} entries in seed file.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
