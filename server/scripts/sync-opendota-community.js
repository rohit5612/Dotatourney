/**
 * Bulk OpenDota sync for all Steam-linked community accounts + tournament league indexes.
 *
 * Usage:
 *   node scripts/sync-opendota-community.js
 *   node scripts/sync-opendota-community.js --tocsv ./opendota-export
 *   node scripts/sync-opendota-community.js --force --limit 5
 *   node scripts/sync-opendota-community.js --dry-run
 *
 * Writes to Postgres by default. With --tocsv <dir>, new/changed OpenDota rows are buffered
 * to CSV (existing DB rows are still read for skip logic and cache). Use import-opendota-csv.js on prod.
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { env } from "../src/config/env.js";
import {
  beginOpendotaExportBuffer,
  endOpendotaExportBuffer,
  getOpendotaExportBufferRows,
} from "../src/services/opendotaRepository.js";
import { writeOpendotaCsvBundle } from "../src/services/opendotaCsv.js";
import {
  countOpendotaCoverage,
  leagueSyncPlan,
  listLeagueIdsForPlayerAccount,
  listSteamLinkedPlayerAccounts,
  listTournamentsWithLeagueId,
  profileSyncPlan,
} from "../src/services/opendotaCommunitySync.js";
import {
  buildLeagueStatsForPlayer,
  linkTournamentMatches,
  syncLeagueIndexFromRoster,
  syncPlayerLeagueMatches,
  syncPlayerOpenDotaSnapshots,
} from "../src/services/opendotaSyncService.js";
import { invalidatePublicCache } from "../src/services/publicCache.js";

dotenv.config();

function ts() {
  return new Date().toISOString();
}

function log(msg, extra) {
  if (extra !== undefined) {
    console.log(`[${ts()}] ${msg}`, extra);
  } else {
    console.log(`[${ts()}] ${msg}`);
  }
}

function parseArgs(argv) {
  const out = {
    toCsv: "",
    force: false,
    dryRun: false,
    limit: 0,
    skipTournaments: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tocsv") out.toCsv = argv[++i] || "";
    else if (arg === "--force") out.force = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--skip-tournaments") out.skipTournaments = true;
    else if (arg === "--limit") out.limit = Number(argv[++i]) || 0;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`
sync-opendota-community.js

  --tocsv <dir>       Buffer fetched rows to CSV (no direct DB writes for OpenDota tables)
  --force             Re-fetch even when valid snapshots exist in DB
  --dry-run           Log plans only; no OpenDota HTTP / no writes
  --limit <n>         Process at most n players (after tournament phases)
  --skip-tournaments  Skip roster league index + match linking phases

Requires steam_id on player_accounts. Email does not matter.
Set OPENDOTA_API_KEY in .env for bulk runs.
`);
}

const stats = {
  playersTotal: 0,
  playersProcessed: 0,
  profileSynced: 0,
  profileSkipped: 0,
  leagueSynced: 0,
  leagueSkipped: 0,
  leagueStatsOnly: 0,
  errors: 0,
  tournaments: [],
};

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.tocsv && args.dryRun) {
    console.error("--tocsv and --dry-run cannot be combined");
    process.exit(1);
  }

  const coverage = await countOpendotaCoverage();
  log("OpenDota community sync starting", {
    mode: args.tocsv ? "csv" : "database",
    dryRun: args.dryRun,
    force: args.force,
    throttleMs: env.opendotaMinRequestIntervalMs,
    hasApiKey: Boolean(env.opendotaApiKey),
    coverage,
  });

  if (args.tocsv) {
    beginOpendotaExportBuffer();
  }

  try {
    const tournaments = await listTournamentsWithLeagueId();
    log(`Tournaments with dota_league_id: ${tournaments.length}`, tournaments.map((t) => t.slug));

    if (!args.skipTournaments && !args.dryRun) {
      for (const tournament of tournaments) {
        log(`━━ Tournament phase: ${tournament.slug} (league ${tournament.dotaLeagueId}) ━━`);
        try {
          const index = await syncLeagueIndexFromRoster(tournament.id);
          let link = { skipped: true, reason: "csv_export_mode" };
          if (!args.tocsv) {
            link = await linkTournamentMatches(tournament.id);
          } else {
            log(
              `Tournament ${tournament.slug}: skipping BPC match linking in --tocsv mode (updates matches.meta; run tournament sync on prod if needed)`,
            );
          }
          stats.tournaments.push({ slug: tournament.slug, index, link });
          log(`Tournament ${tournament.slug} done`, { index, link });
        } catch (error) {
          stats.errors += 1;
          log(`Tournament ${tournament.slug} FAILED: ${error.message}`);
        }
      }
    } else if (args.dryRun) {
      log("Dry run: skipping tournament roster sync + match linking");
    }

    const players = await listSteamLinkedPlayerAccounts();
    stats.playersTotal = players.length;
    const slice = args.limit > 0 ? players.slice(0, args.limit) : players;
    log(`Player phase: ${slice.length} steam-linked account(s) (${players.length} total)`);

    let index = 0;
    for (const player of slice) {
      index += 1;
      const label = player.slug || player.bpcId || player.id;
      log(`── [${index}/${slice.length}] ${label} (steam32 ${player.steam32}) ──`);

      try {
        const profilePlan = await profileSyncPlan(player.id, { force: args.force });
        if (profilePlan === "skip") {
          stats.profileSkipped += 1;
          log("  profile: skip (valid snapshot in DB)");
        } else if (args.dryRun) {
          log("  profile: would sync");
        } else {
          await syncPlayerOpenDotaSnapshots(player.id, player.steam32);
          stats.profileSynced += 1;
          log("  profile: synced (profile + heroes snapshots)");
        }

        const leagues = await listLeagueIdsForPlayerAccount(player.id);
        if (!leagues.length) {
          log("  leagues: none linked to this account");
          stats.playersProcessed += 1;
          continue;
        }

        for (const league of leagues) {
          const plan = await leagueSyncPlan(player.id, league.dotaLeagueId, { force: args.force });
          const leagueLabel = `${league.tournamentSlug || league.dotaLeagueId} (league ${league.dotaLeagueId})`;

          if (plan === "skip") {
            stats.leagueSkipped += 1;
            log(`  league ${leagueLabel}: skip (league + stats cached)`);
            continue;
          }

          if (plan === "stats_only") {
            stats.leagueStatsOnly += 1;
            if (args.dryRun) {
              log(`  league ${leagueLabel}: would build stats only (no OpenDota league fetch)`);
              continue;
            }
            const built = await buildLeagueStatsForPlayer(player.id, player.steam32, league.dotaLeagueId, {
              allowOpenDotaSync: false,
            });
            log(`  league ${leagueLabel}: stats built from cache`, {
              games: built.games,
              winRate: built.winRate,
            });
            continue;
          }

          if (args.dryRun) {
            log(`  league ${leagueLabel}: would sync league matches + stats`);
            continue;
          }

          const sync = await syncPlayerLeagueMatches(player.id, player.steam32, league.dotaLeagueId);
          const built = await buildLeagueStatsForPlayer(player.id, player.steam32, league.dotaLeagueId, {
            allowOpenDotaSync: false,
          });
          stats.leagueSynced += 1;
          log(`  league ${leagueLabel}: synced`, {
            matchIds: sync.matchIds?.length ?? 0,
            cached: Boolean(sync.cached),
            games: built.games,
            winRate: built.winRate,
          });
        }

        stats.playersProcessed += 1;
      } catch (error) {
        stats.errors += 1;
        log(`  ERROR: ${error.message}`);
        if (error.stack) console.error(error.stack);
      }
    }

    if (args.tocsv) {
      const buffered = getOpendotaExportBufferRows();
      await writeOpendotaCsvBundle({
        snapshots: buffered.snapshots,
        matchCache: buffered.matchCache,
        leagueIndex: buffered.leagueIndex,
        meta: {
          source: "sync-opendota-community.js",
          force: args.force,
          playersProcessed: stats.playersProcessed,
          tournaments: stats.tournaments,
        },
      }, args.tocsv);
      log(`CSV export written to ${args.tocsv}`, {
        snapshots: buffered.snapshots.length,
        matchCache: buffered.matchCache.length,
        leagueIndex: buffered.leagueIndex.length,
      });
    }

    if (!args.dryRun && !args.tocsv) {
      invalidatePublicCache();
    }

    log("OpenDota community sync finished", stats);
  } finally {
    if (args.tocsv) {
      endOpendotaExportBuffer();
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
