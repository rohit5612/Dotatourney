/**
 * Repair match lineups where stored team_name rows no longer match matches.team1/team2.
 * Typical cause: manual standings / BLAST seeding changed bracket teams without reseeding lineups.
 *
 * Usage:
 *   node scripts/repair-stale-match-lineups.js            # dry run
 *   node scripts/repair-stale-match-lineups.js --apply    # fix affected matches
 */
import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { reseedMatchLineups } from "../src/services/matchLineupService.js";

async function findAffectedMatches() {
  const { rows } = await pool.query(
    `SELECT DISTINCT m.id, m.tournament_id, m.team1, m.team2, m.stage_key
     FROM matches m
     JOIN match_lineup_players mlp ON mlp.match_id = m.id
     WHERE mlp.is_substitute = FALSE
       AND (
         lower(mlp.team_name) NOT IN (lower(m.team1), lower(m.team2))
         OR EXISTS (
           SELECT 1
           FROM match_lineup_players grouped
           WHERE grouped.match_id = m.id
             AND grouped.is_substitute = FALSE
           GROUP BY grouped.team_name
           HAVING COUNT(*) > 5
         )
       )
     ORDER BY m.stage_key, m.team1, m.team2`,
  );
  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const affected = await findAffectedMatches();

  if (!affected.length) {
    console.log("No stale match lineups found.");
    return;
  }

  console.log(`${apply ? "Repairing" : "Would repair"} ${affected.length} match(es):`);
  for (const match of affected) {
    console.log(`- ${match.id} [${match.stage_key || "match"}] ${match.team1} vs ${match.team2}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to reseed affected matches.");
    return;
  }

  let repaired = 0;
  for (const match of affected) {
    const result = await reseedMatchLineups(match.tournament_id, match.id);
    repaired += result.seeded || 0;
  }

  console.log(`\nReseeded ${repaired} starter lineup row(s) across ${affected.length} match(es).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
