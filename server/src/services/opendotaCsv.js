import fs from "fs/promises";
import path from "path";

export const OPENDOTA_CSV_FILES = {
  snapshots: "player_opendota_snapshots.csv",
  matchCache: "opendota_match_cache.csv",
  leagueIndex: "opendota_league_match_index.csv",
  manifest: "manifest.json",
};

const SNAPSHOT_HEADER =
  "player_account_id,snapshot_kind,steam32,payload,fetched_at,expires_at";
const MATCH_CACHE_HEADER = "dota_match_id,dota_league_id,payload,fetched_at";
const LEAGUE_INDEX_HEADER =
  "dota_match_id,dota_league_id,start_time,radiant_win,leagueid_verified,steam32_ids,updated_at";

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** @param {string[]} fields */
export function csvRow(fields) {
  return `${fields.map(csvEscape).join(",")}\n`;
}

/**
 * Parse one CSV row (RFC 4180). Returns null if line is empty.
 * @param {string} line
 */
export function parseCsvLine(line) {
  const out = [];
  let i = 0;
  let field = "";
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      out.push(field);
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  out.push(field);
  return out;
}

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

/**
 * @param {{
 *   snapshots: Array<Record<string, unknown>>,
 *   matchCache: Array<Record<string, unknown>>,
 *   leagueIndex: Array<Record<string, unknown>>,
 *   meta?: Record<string, unknown>,
 * }} bundle
 * @param {string} outDir
 */
export async function writeOpendotaCsvBundle(bundle, outDir) {
  await fs.mkdir(outDir, { recursive: true });

  let snapshotsBody = SNAPSHOT_HEADER + "\n";
  for (const row of bundle.snapshots) {
    snapshotsBody += csvRow([
      row.player_account_id,
      row.snapshot_kind,
      row.steam32 ?? "",
      JSON.stringify(row.payload ?? {}),
      row.fetched_at,
      row.expires_at,
    ]);
  }

  let matchBody = MATCH_CACHE_HEADER + "\n";
  for (const row of bundle.matchCache) {
    matchBody += csvRow([
      row.dota_match_id,
      row.dota_league_id ?? "",
      JSON.stringify(row.payload ?? {}),
      row.fetched_at,
    ]);
  }

  let indexBody = LEAGUE_INDEX_HEADER + "\n";
  for (const row of bundle.leagueIndex) {
    indexBody += csvRow([
      row.dota_match_id,
      row.dota_league_id,
      row.start_time ?? 0,
      row.radiant_win === null || row.radiant_win === undefined ? "" : String(row.radiant_win),
      row.leagueid_verified ? "true" : "false",
      JSON.stringify(row.steam32_ids ?? []),
      row.updated_at,
    ]);
  }

  await fs.writeFile(path.join(outDir, OPENDOTA_CSV_FILES.snapshots), snapshotsBody, "utf8");
  await fs.writeFile(path.join(outDir, OPENDOTA_CSV_FILES.matchCache), matchBody, "utf8");
  await fs.writeFile(path.join(outDir, OPENDOTA_CSV_FILES.leagueIndex), indexBody, "utf8");

  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      snapshots: bundle.snapshots.length,
      matchCache: bundle.matchCache.length,
      leagueIndex: bundle.leagueIndex.length,
    },
    files: OPENDOTA_CSV_FILES,
    ...(bundle.meta || {}),
  };
  await fs.writeFile(
    path.join(outDir, OPENDOTA_CSV_FILES.manifest),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

/**
 * @param {string} dir
 */
export async function readOpendotaCsvBundle(dir) {
  const readTable = async (filename, headerExpected) => {
    const raw = await fs.readFile(path.join(dir, filename), "utf8");
    const rows = parseCsv(raw);
    if (!rows.length) return [];
    const header = rows[0];
    if (header.join(",") !== headerExpected) {
      throw new Error(`${filename}: unexpected header (got ${header.join(",")})`);
    }
    return rows.slice(1);
  };

  const snapshotRows = await readTable(OPENDOTA_CSV_FILES.snapshots, SNAPSHOT_HEADER);
  const matchRows = await readTable(OPENDOTA_CSV_FILES.matchCache, MATCH_CACHE_HEADER);
  const indexRows = await readTable(OPENDOTA_CSV_FILES.leagueIndex, LEAGUE_INDEX_HEADER);

  const snapshots = snapshotRows.map((c) => ({
    player_account_id: c[0],
    snapshot_kind: c[1],
    steam32: c[2] === "" ? null : Number(c[2]),
    payload: JSON.parse(c[3] || "{}"),
    fetched_at: c[4],
    expires_at: c[5],
  }));

  const matchCache = matchRows.map((c) => ({
    dota_match_id: Number(c[0]),
    dota_league_id: c[1] === "" ? null : Number(c[1]),
    payload: JSON.parse(c[2] || "{}"),
    fetched_at: c[3],
  }));

  const leagueIndex = indexRows.map((c) => ({
    dota_match_id: Number(c[0]),
    dota_league_id: Number(c[1]),
    start_time: Number(c[2]) || 0,
    radiant_win: c[3] === "" ? null : c[3] === "true",
    leagueid_verified: c[4] === "true",
    steam32_ids: JSON.parse(c[5] || "[]"),
    updated_at: c[6],
  }));

  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(dir, OPENDOTA_CSV_FILES.manifest), "utf8"));
  } catch {
    manifest = null;
  }

  return { snapshots, matchCache, leagueIndex, manifest };
}
