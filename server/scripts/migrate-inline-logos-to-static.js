/**
 * Replace inline base64 team logos in roster snapshots with static paths
 * already saved on working teams.
 *
 * Usage (from server/):
 *   node scripts/migrate-inline-logos-to-static.js --dry-run
 *   node scripts/migrate-inline-logos-to-static.js --apply
 *
 * Does not change roster status, matches, or schedule.
 */
import { pool } from "../src/db/pool.js";
import { isInlineTeamLogoUrl, isStaticTeamLogoUrl } from "../src/utils/teamLogoUrl.js";

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");

async function main() {
  const tournamentResult = await pool.query(
    `SELECT id, name FROM tournaments WHERE is_published = true ORDER BY updated_at DESC LIMIT 1`,
  );
  const tournament = tournamentResult.rows[0];
  if (!tournament) {
    console.log("No published tournament found.");
    await pool.end();
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Migrating logos for tournament: ${tournament.name} (${tournament.id})`);

  const teamsResult = await pool.query(
    `SELECT id, name, logo_url AS "logoUrl"
     FROM teams
     WHERE tournament_id = $1
     ORDER BY seed ASC NULLS LAST, created_at ASC`,
    [tournament.id],
  );

  let snapshotUpdates = 0;

  for (const team of teamsResult.rows) {
    const logoUrl = String(team.logoUrl || "").trim();
    if (isInlineTeamLogoUrl(logoUrl)) {
      console.log(`  skip ${team.name}: working team still has inline logo — pick a catalog logo and Save teams first`);
      continue;
    }
    if (!isStaticTeamLogoUrl(logoUrl)) continue;

    const snapshotResult = await pool.query(
      `SELECT id, name, logo_url AS "logoUrl"
       FROM roster_snapshot_teams
       WHERE tournament_id = $1
         AND (source_team_id = $2 OR lower(trim(name)) = lower(trim($3)))
         AND logo_url LIKE 'data:%'`,
      [tournament.id, team.id, team.name],
    );

    for (const row of snapshotResult.rows) {
      console.log(`  ${row.name}: inline snapshot -> ${logoUrl}`);
      if (!dryRun) {
        await pool.query(`UPDATE roster_snapshot_teams SET logo_url = $1 WHERE id = $2`, [logoUrl, row.id]);
      }
      snapshotUpdates += 1;
    }
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Done. ${snapshotUpdates} snapshot row(s) would be updated.`);
  if (dryRun) {
    console.log("Re-run with --apply to write changes.");
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
