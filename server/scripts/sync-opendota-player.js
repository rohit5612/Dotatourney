/**
 * Sync OpenDota profile + heroes for one player account (by slug or BPC id).
 * Usage: node scripts/sync-opendota-player.js --slug addictzz
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { steam64ToSteam32 } from "../src/utils/steamId.js";
import {
  buildLeagueStatsForPlayer,
  syncPlayerLeagueMatches,
  syncPlayerOpenDotaSnapshots,
} from "../src/services/opendotaSyncService.js";
import { invalidatePublicCache } from "../src/services/publicCache.js";

dotenv.config();

function parseArgs(argv) {
  const out = { slug: "", bpcId: "" };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--slug") out.slug = argv[++i] || "";
    else if (argv[i] === "--bpc") out.bpcId = argv[++i] || "";
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.slug && !args.bpcId) {
    console.error("Provide --slug or --bpc");
    process.exit(1);
  }
  const { rows } = await pool.query(
    `SELECT id, steam_id, slug, bpc_id FROM player_accounts
     WHERE ($1::text <> '' AND lower(slug) = lower($1))
        OR ($2::text <> '' AND bpc_id = $2)
     LIMIT 1`,
    [args.slug, args.bpcId],
  );
  const account = rows[0];
  if (!account) {
    console.error("Player not found");
    process.exit(1);
  }
  const steam32 = steam64ToSteam32(account.steam_id);
  if (!steam32) {
    console.error("No Steam linked");
    process.exit(1);
  }
  const profile = await syncPlayerOpenDotaSnapshots(account.id, steam32);

  const { rows: leagueRows } = await pool.query(
    `SELECT DISTINCT t.dota_league_id
     FROM tournaments t
     WHERE t.dota_league_id IS NOT NULL
       AND t.id IN (
         SELECT DISTINCT mlp.tournament_id FROM match_lineup_players mlp WHERE mlp.player_account_id = $1
         UNION
         SELECT DISTINCT pr.tournament_id FROM player_registrations pr
         WHERE pr.player_account_id = $1 AND pr.archived_at IS NULL
       )
     ORDER BY t.dota_league_id`,
    [account.id],
  );

  const leagues = [];
  for (const row of leagueRows) {
    const leagueId = Number(row.dota_league_id);
    console.log(`[opendota] League ${leagueId} — syncing (cache-first)…`);
    const sync = await syncPlayerLeagueMatches(account.id, steam32, leagueId);
    const stats = await buildLeagueStatsForPlayer(account.id, steam32, leagueId);
    leagues.push({
      leagueId,
      matchIds: sync.matchIds?.length ?? 0,
      games: stats.games,
      winRate: stats.winRate,
      cached: Boolean(sync.cached),
    });
    console.log(`[opendota] League ${leagueId} — ${stats.games} games, ${stats.winRate ?? "n/a"}% WR`);
  }

  console.log(JSON.stringify({ account: account.slug, steam32, profile, leagues }, null, 2));
  invalidatePublicCache();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
