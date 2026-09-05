/**
 * Freeze Season 2 player cards into player_season_card_snapshots for the Card Deck.
 *
 * Usage (from server/):
 *   node scripts/backfill-s2-card-snapshots.js --check
 *   node scripts/backfill-s2-card-snapshots.js --apply
 *   node scripts/backfill-s2-card-snapshots.js --apply --season-slug=season-2
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { snapshotSeasonCardsForTournament } from "../src/services/cardSnapshotService.js";

dotenv.config();

function parseSeasonSlug(argv) {
  const flag = argv.find((a) => a.startsWith("--season-slug="));
  return flag ? flag.split("=")[1] : "season-2";
}

async function getSeasonContext(seasonSlug) {
  const { rows } = await pool.query(
    `SELECT s.id AS season_id, s.slug, s.number, s.status, s.tournament_id, t.name AS tournament_name
     FROM seasons s
     JOIN tournaments t ON t.id = s.tournament_id
     WHERE s.slug = $1`,
    [seasonSlug],
  );
  return rows[0] || null;
}

async function countExistingSnapshots(seasonId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM player_season_card_snapshots WHERE season_id = $1`,
    [seasonId],
  );
  return rows[0]?.count ?? 0;
}

async function countRegistrations(tournamentId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM player_registrations
     WHERE tournament_id = $1
       AND archived_at IS NULL
       AND player_account_id IS NOT NULL`,
    [tournamentId],
  );
  return rows[0]?.count ?? 0;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const seasonSlug = parseSeasonSlug(process.argv);
  const season = await getSeasonContext(seasonSlug);

  if (!season) {
    console.error(`Season not found for slug: ${seasonSlug}`);
    process.exit(1);
  }

  const registrations = await countRegistrations(season.tournament_id);
  const existing = await countExistingSnapshots(season.season_id);

  console.log(`Season: ${season.slug} (${season.tournament_name})`);
  console.log(`Status: ${season.status}`);
  console.log(`Registrations to snapshot: ${registrations}`);
  console.log(`Existing snapshots: ${existing}`);

  if (!apply) {
    console.log("\nDry run only. Pass --apply to create/update snapshots.");
    return;
  }

  const result = await snapshotSeasonCardsForTournament(season.tournament_id);
  const after = await countExistingSnapshots(season.season_id);
  console.log(`\nSnapshotted ${result.count} registration(s). Total snapshots: ${after}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
