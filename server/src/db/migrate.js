import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isApplied(filename) {
  const { rows } = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
  return rows.length > 0;
}

async function markApplied(filename) {
  await pool.query(
    "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
    [filename],
  );
}

async function databaseAlreadyInitialized() {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'tournaments'
     ) AS exists`,
  );
  return Boolean(rows[0]?.exists);
}

async function migrationStillNeeded(filename) {
  if (filename === "042_roster_group_key_expand.sql") {
    const { rows } = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'roster_snapshot_teams'::regclass
         AND conname = 'roster_snapshot_teams_group_key_check'`,
    );
    const def = rows[0]?.def || "";
    return !def.includes("[A-H]");
  }

  if (filename === "043_substitution_preferred.sql") {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'substitution_requests'
         AND column_name = 'preferred_substitute_registration_id'`,
    );
    return rows.length === 0;
  }

  if (filename === "045_roster_snapshot_player_account_id.sql") {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'roster_snapshot_players'
         AND column_name = 'player_account_id'`,
    );
    return rows.length === 0;
  }

  return false;
}

async function bootstrapExistingDatabase(sqlFiles) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM schema_migrations");
  if (rows[0]?.count > 0) return;

  const initialized = await databaseAlreadyInitialized();
  if (!initialized) return;

  let bootstrapped = 0;
  for (const fileName of sqlFiles) {
    if (await migrationStillNeeded(fileName)) continue;
    await markApplied(fileName);
    bootstrapped += 1;
  }

  if (bootstrapped > 0) {
    console.log(`Bootstrapped ${bootstrapped} migration(s) already present in this database.`);
  }
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((name) => name.endsWith(".sql")).sort();

  await ensureMigrationTable();
  await bootstrapExistingDatabase(sqlFiles);

  for (const fileName of sqlFiles) {
    if (await isApplied(fileName)) {
      console.log(`Skipped migration (already applied): ${fileName}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, fileName);
    const sql = await fs.readFile(fullPath, "utf8");
    await pool.query(sql);
    await markApplied(fileName);
    console.log(`Applied migration: ${fileName}`);
  }
}

runMigrations()
  .catch((error) => {
    console.error("Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
