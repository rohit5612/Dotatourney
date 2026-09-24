/**
 * Import OpenDota CSV bundle (from sync-opendota-community.js --tocsv) into Postgres.
 *
 * Usage:
 *   node scripts/import-opendota-csv.js --dir ./opendota-export
 *   node scripts/import-opendota-csv.js --dir ./opendota-export --dry-run
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { readOpendotaCsvBundle } from "../src/services/opendotaCsv.js";
import { invalidatePublicCache } from "../src/services/publicCache.js";

dotenv.config();

function parseArgs(argv) {
  const out = { dir: "", dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") out.dir = argv[++i] || "";
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

async function importSnapshots(client, rows) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO player_opendota_snapshots (player_account_id, snapshot_kind, steam32, payload, fetched_at, expires_at)
       VALUES ($1::uuid, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)
       ON CONFLICT (player_account_id, snapshot_kind) DO UPDATE SET
         steam32 = EXCLUDED.steam32,
         payload = EXCLUDED.payload,
         fetched_at = EXCLUDED.fetched_at,
         expires_at = EXCLUDED.expires_at`,
      [
        row.player_account_id,
        row.snapshot_kind,
        row.steam32,
        JSON.stringify(row.payload ?? {}),
        row.fetched_at,
        row.expires_at,
      ],
    );
  }
}

async function importMatchCache(client, rows) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO opendota_match_cache (dota_match_id, payload, dota_league_id, fetched_at)
       VALUES ($1, $2::jsonb, $3, $4::timestamptz)
       ON CONFLICT (dota_match_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         dota_league_id = COALESCE(EXCLUDED.dota_league_id, opendota_match_cache.dota_league_id),
         fetched_at = EXCLUDED.fetched_at`,
      [row.dota_match_id, JSON.stringify(row.payload ?? {}), row.dota_league_id, row.fetched_at],
    );
  }
}

async function importLeagueIndex(client, rows) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO opendota_league_match_index (
         dota_match_id, dota_league_id, start_time, radiant_win, leagueid_verified, steam32_ids, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::int[], $7::timestamptz)
       ON CONFLICT (dota_match_id) DO UPDATE SET
         dota_league_id = EXCLUDED.dota_league_id,
         start_time = EXCLUDED.start_time,
         radiant_win = EXCLUDED.radiant_win,
         leagueid_verified = EXCLUDED.leagueid_verified,
         steam32_ids = EXCLUDED.steam32_ids,
         updated_at = EXCLUDED.updated_at`,
      [
        row.dota_match_id,
        row.dota_league_id,
        row.start_time ?? 0,
        row.radiant_win,
        Boolean(row.leagueid_verified),
        row.steam32_ids?.length ? row.steam32_ids : [],
        row.updated_at,
      ],
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dir) {
    console.log("Usage: node scripts/import-opendota-csv.js --dir <export-folder> [--dry-run]");
    process.exit(args.help ? 0 : 1);
  }

  const bundle = await readOpendotaCsvBundle(args.dir);
  console.log("OpenDota CSV import", {
    dir: args.dir,
    dryRun: args.dryRun,
    manifest: bundle.manifest,
    counts: {
      snapshots: bundle.snapshots.length,
      matchCache: bundle.matchCache.length,
      leagueIndex: bundle.leagueIndex.length,
    },
  });

  if (args.dryRun) {
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Importing match cache…");
    await importMatchCache(client, bundle.matchCache);
    console.log("Importing league match index…");
    await importLeagueIndex(client, bundle.leagueIndex);
    console.log("Importing player snapshots…");
    await importSnapshots(client, bundle.snapshots);
    await client.query("COMMIT");
    console.log("Import committed successfully.");
    invalidatePublicCache();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
