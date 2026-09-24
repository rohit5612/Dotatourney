/**
 * Sync league match index from roster + optional auto-link BPC matches.
 * Usage: node scripts/sync-opendota-tournament.js --tournament season-2
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { syncLeagueIndexFromRoster, linkTournamentMatches } from "../src/services/opendotaSyncService.js";

dotenv.config();

function parseArgs(argv) {
  const out = { slug: "", id: "", link: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--tournament") out.slug = argv[++i] || "";
    else if (argv[i] === "--id") out.id = argv[++i] || "";
    else if (argv[i] === "--no-link") out.link = false;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const { rows } = await pool.query(
    `SELECT id, slug, dota_league_id FROM tournaments
     WHERE ($1::text <> '' AND slug = $1) OR ($2::text <> '' AND id::text = $2)
     LIMIT 1`,
    [args.slug, args.id],
  );
  const tournament = rows[0];
  if (!tournament) {
    console.error("Tournament not found");
    process.exit(1);
  }
  if (!tournament.dota_league_id) {
    console.error("Set dota_league_id on tournament first");
    process.exit(1);
  }
  const index = await syncLeagueIndexFromRoster(tournament.id);
  let link = { linked: 0 };
  if (args.link) {
    link = await linkTournamentMatches(tournament.id);
  }
  console.log(JSON.stringify({ tournament: tournament.slug, index, link }, null, 2));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
