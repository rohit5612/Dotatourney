/**
 * Repair season-scoped card data after cross-season bleed bugs.
 *
 * 1. Realigns player_card_assets.season_id from tournament_id (authoritative).
 * 2. Clears stale global card_tier_override values.
 * 3. Rebuilds concluded-season vault snapshots from season-scoped data only.
 *
 * Usage: node server/scripts/repair-season-card-snapshots.js
 */
import { pool } from "../src/db/pool.js";
import { snapshotSeasonCardsForTournament } from "../src/services/cardSnapshotService.js";

async function realignCardAssetSeasons() {
  const { rowCount } = await pool.query(
    `UPDATE player_card_assets pca
     SET season_id = sub.season_id
     FROM (
       SELECT DISTINCT ON (pca2.id)
         pca2.id AS asset_id,
         s.id AS season_id
       FROM player_card_assets pca2
       JOIN seasons s ON s.tournament_id = pca2.tournament_id
       WHERE pca2.tournament_id IS NOT NULL
       ORDER BY pca2.id, s.number DESC
     ) sub
     WHERE pca.id = sub.asset_id
       AND pca.season_id IS DISTINCT FROM sub.season_id`,
  );
  return rowCount ?? 0;
}

async function clearTierOverrides() {
  const { rowCount } = await pool.query(
    `UPDATE player_accounts SET card_tier_override = NULL, updated_at = NOW() WHERE card_tier_override IS NOT NULL`,
  );
  return rowCount ?? 0;
}

async function main() {
  const realigned = await realignCardAssetSeasons();
  const clearedOverrides = await clearTierOverrides();
  console.log(`Realigned ${realigned} card asset row(s) to the correct season.`);
  console.log(`Cleared ${clearedOverrides} stale card_tier_override value(s).`);

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
      `Season ${season.number} (${season.name || season.id}): rebuilt ${result.count} vault snapshot(s)`,
    );
  }

  console.log(
    `Done. Rebuilt ${total} vault snapshot(s) across ${concludedSeasons.length} concluded season(s).`,
  );
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
