import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((name) => name.endsWith(".sql")).sort();

  for (const fileName of sqlFiles) {
    const fullPath = path.join(migrationsDir, fileName);
    const sql = await fs.readFile(fullPath, "utf8");
    await pool.query(sql);
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
