/**
 * Seed league_teams from logo catalog + link approved roster teams (S1/S2/…).
 *
 * Usage (from server/):
 *   node scripts/backfill-league-teams.js --check
 *   node scripts/backfill-league-teams.js --apply
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import {
  normalizeTeamName,
  slugifyLeagueTeamName,
  upsertSeasonTeamEntry,
  findLeagueTeamByNormalizedName,
} from "../src/services/leagueTeamService.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const overridesPath = join(__dirname, "league-team-overrides.json");

const TEAM_LOGO_CATALOG = [
  { id: "arcaneorder", label: "Arcane Order", url: "/images/teams/arcaneorder.png" },
  { id: "arrisecorp", label: "Arrise Corp", url: "/images/teams/arrisecorp.png" },
  { id: "ashborn", label: "Ashborn", url: "/images/teams/ashborn.png" },
  { id: "chaosrift", label: "Chaos Rift", url: "/images/teams/chaosrift.png" },
  { id: "crimsonveil", label: "Crimson Veil", url: "/images/teams/crimsonveil.png" },
  { id: "darkhorse", label: "Dark Horse", url: "/images/teams/darkhorse.png" },
  { id: "emberfall", label: "Emberfall", url: "/images/teams/emberfall.png" },
  { id: "frostreign", label: "Frost Reign", url: "/images/teams/frostreign.png" },
  { id: "godsent", label: "Godsent", url: "/images/teams/godsent.png" },
  { id: "invictus", label: "Invictus", url: "/images/teams/invictus.png" },
  { id: "kingsguard", label: "Kingsguard", url: "/images/teams/kingsguard.png" },
  { id: "mortaloath", label: "Mortal Oath", url: "/images/teams/mortaloath.png" },
  { id: "nemesis", label: "Nemesis", url: "/images/teams/nemesis.png" },
  { id: "northwind", label: "Northwind", url: "/images/teams/northwind.png" },
  { id: "obsidiancore", label: "Obsidian Core", url: "/images/teams/obsidiancore.png" },
  { id: "phantomdivision", label: "Phantom Division", url: "/images/teams/phantomdivision.png" },
  { id: "vanguard", label: "Vanguard", url: "/images/teams/vanguard.png" },
  { id: "warpath", label: "Warpath", url: "/images/teams/warpath.png" },
];

function loadOverrides() {
  try {
    return JSON.parse(readFileSync(overridesPath, "utf8"));
  } catch {
    return {};
  }
}

async function ensureCatalogTeams(apply) {
  const existing = await pool.query(`SELECT COUNT(*)::int AS c FROM league_teams`);
  if (existing.rows[0].c > 0 && !apply) {
    console.log(`league_teams already has ${existing.rows[0].c} rows (use --apply to seed missing)`);
    return;
  }

  for (const entry of TEAM_LOGO_CATALOG) {
    const normalized = normalizeTeamName(entry.label);
    let row = await findLeagueTeamByNormalizedName(normalized);
    if (row) continue;
    if (!apply) {
      console.log(`[check] would create catalog team: ${entry.label}`);
      continue;
    }
    const id = randomUUID();
    const slug = slugifyLeagueTeamName(entry.label);
    await pool.query(
      `INSERT INTO league_teams (id, slug, name, abbr, logo_url, status, sort_order)
       VALUES ($1, $2, $3, '', $4, 'dormant', 0)
       ON CONFLICT (slug) DO NOTHING`,
      [id, slug, entry.label, entry.url],
    );
    await pool.query(
      `INSERT INTO league_team_aliases (id, league_team_id, alias, alias_normalized)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (alias_normalized) DO NOTHING`,
      [randomUUID(), id, entry.label, normalized],
    );
    console.log(`Created catalog team ${entry.label}`);
  }
}

async function resolveLeagueTeamForSnapshotName(name, overrides) {
  const norm = normalizeTeamName(name);
  const overrideId = overrides[norm] || overrides[name];
  if (overrideId) {
    const { rows } = await pool.query(`SELECT * FROM league_teams WHERE id = $1`, [overrideId]);
    if (rows[0]) return rows[0];
  }
  const byName = await findLeagueTeamByNormalizedName(norm);
  if (byName) return byName;
  const catalog = TEAM_LOGO_CATALOG.find((e) => normalizeTeamName(e.label) === norm);
  if (catalog) {
    const { rows } = await pool.query(`SELECT * FROM league_teams WHERE slug = $1`, [
      slugifyLeagueTeamName(catalog.label),
    ]);
    return rows[0] || null;
  }
  return null;
}

async function linkApprovedRosters(apply) {
  const { rows: seasons } = await pool.query(
    `SELECT s.id AS season_id, s.number, s.tournament_id
     FROM seasons s
     WHERE s.tournament_id IS NOT NULL
     ORDER BY s.number`,
  );
  const overrides = loadOverrides();

  for (const season of seasons) {
    const { rows: snap } = await pool.query(
      `SELECT rs.id AS roster_id FROM roster_snapshots rs
       WHERE rs.tournament_id = $1 AND rs.status = 'approved'
       ORDER BY rs.approved_at DESC NULLS LAST LIMIT 1`,
      [season.tournament_id],
    );
    if (!snap[0]) continue;

    const { rows: teams } = await pool.query(
      `SELECT id, name, logo_url, accent_color, league_team_id
       FROM roster_snapshot_teams WHERE roster_snapshot_id = $1`,
      [snap[0].roster_id],
    );

    for (const team of teams) {
      let leagueTeamId = team.league_team_id;
      if (!leagueTeamId) {
        const league = await resolveLeagueTeamForSnapshotName(team.name, overrides);
        if (!league) {
          console.warn(`Season ${season.number}: no league team for "${team.name}"`);
          continue;
        }
        leagueTeamId = league.id;
      }

      if (!apply) {
        console.log(`[check] S${season.number} ${team.name} -> league ${leagueTeamId}`);
        continue;
      }

      await pool.query(`UPDATE roster_snapshot_teams SET league_team_id = $1 WHERE id = $2`, [
        leagueTeamId,
        team.id,
      ]);
      await pool.query(
        `UPDATE teams SET league_team_id = $1
         WHERE tournament_id = $2 AND lower(trim(name)) = lower(trim($3))`,
        [leagueTeamId, season.tournament_id, team.name],
      );

      await upsertSeasonTeamEntry({
        leagueTeamId,
        seasonId: season.season_id,
        tournamentId: season.tournament_id,
        rosterSnapshotTeamId: team.id,
        displayName: team.name,
      });

      await pool.query(
        `UPDATE league_teams SET
          status = CASE WHEN status = 'dormant' THEN 'active' ELSE status END,
          logo_url = CASE WHEN logo_url = '' THEN $2 ELSE logo_url END,
          founded_season_number = LEAST(COALESCE(founded_season_number, $3), $3),
          updated_at = NOW()
         WHERE id = $1`,
        [leagueTeamId, team.logo_url || "", season.number],
      );
    }
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  await ensureCatalogTeams(apply);
  await linkApprovedRosters(apply);
  const teams = await pool.query(`SELECT COUNT(*)::int AS c FROM league_teams`);
  const entries = await pool.query(`SELECT COUNT(*)::int AS c FROM season_team_entries`);
  console.log(`Done. league_teams=${teams.rows[0].c}, season_team_entries=${entries.rows[0].c}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
