/**
 * Rebuild concluded-season vault snapshots from season-scoped registrations/assets.
 * Run after deploying season-scoped card asset fixes.
 *
 * Usage: node server/scripts/repair-season-card-snapshots.js
 */
import { pool } from "../src/db/pool.js";
import { snapshotSeasonCardsForTournament } from "../src/services/cardSnapshotService.js";

async function main() {
  const { rows: concludedSeasons } = await pool.query(
    `SELECT id, number, name, tournament_id
     FROM seasons
     WHERE status = 'concluded'
       AND tournament_id IS NOT NULL
     ORDER BY number ASC`,
  );

  let total = 0;
  for (const season of concludedSeasons) {
    const result = await snapshotSeasonCardsForTournament(season.tournament_id);
    total += result.count;
    console.log(
      `Season ${season.number} (${season.name || season.id}): rebuilt ${result.count} snapshot(s)`,
    );
  }

  console.log(`Done. Rebuilt ${total} vault snapshot(s) across ${concludedSeasons.length} concluded season(s).`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
