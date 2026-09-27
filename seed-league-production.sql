-- BPCL league / franchise production seed & verification
-- Run against production Postgres (psql, Railway, etc.):
--   psql "$DATABASE_URL" -f seed-league-production.sql
--
-- Companion Node scripts (same DB, from repo `server/` folder):
--   node scripts/backfill-league-teams.js --check
--   node scripts/backfill-league-teams.js --apply
--   node scripts/seed-league-team-lore.js --check
--   node scripts/seed-league-team-lore.js --apply
--
-- backfill-league-teams: creates catalog franchises, links approved roster snapshots
--   to league_teams + season_team_entries across all seasons.
-- seed-league-team-lore: fills tagline + long-form lore per franchise slug.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Valve in-house league IDs (OpenDota / profile stats / match index)
--    Update season 3 ID before go-live if not set in Admin → Setup.
-- ---------------------------------------------------------------------------

UPDATE tournaments t
SET dota_league_id = 19721,
    updated_at = NOW()
FROM seasons s
WHERE s.tournament_id = t.id
  AND s.number = 1;

UPDATE tournaments
SET dota_league_id = 19721,
    updated_at = NOW()
WHERE slug = 'season-1'
  AND dota_league_id IS DISTINCT FROM 19721;

UPDATE tournaments t
SET dota_league_id = 19921,
    updated_at = NOW()
FROM seasons s
WHERE s.tournament_id = t.id
  AND s.number = 2;

UPDATE tournaments
SET dota_league_id = 19921,
    updated_at = NOW()
WHERE slug = 'season-2'
  AND dota_league_id IS DISTINCT FROM 19921;

-- Season 3: replace 0 with your Valve league id (or set via admin and re-run verify only).
-- UPDATE tournaments t
-- SET dota_league_id = 00000,
--     updated_at = NOW()
-- FROM seasons s
-- WHERE s.tournament_id = t.id
--   AND s.number = 3;

-- ---------------------------------------------------------------------------
-- 2) Franchise catalog sort order (stable directory / league teams page)
-- ---------------------------------------------------------------------------

WITH catalog(slug, sort_order) AS (
  VALUES
    ('arcane-order', 1),
    ('arrise-corp', 2),
    ('ashborn', 3),
    ('chaos-rift', 4),
    ('crimson-veil', 5),
    ('dark-horse', 6),
    ('emberfall', 7),
    ('frost-reign', 8),
    ('godsent', 9),
    ('invictus', 10),
    ('kingsguard', 11),
    ('mortal-oath', 12),
    ('nemesis', 13),
    ('northwind', 14),
    ('obsidian-core', 15),
    ('phantom-division', 16),
    ('vanguard', 17),
    ('warpath', 18)
)
UPDATE league_teams lt
SET sort_order = c.sort_order,
    updated_at = NOW()
FROM catalog c
WHERE lt.slug = c.slug
  AND lt.sort_order IS DISTINCT FROM c.sort_order;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verify: league IDs per season
-- ---------------------------------------------------------------------------

SELECT s.number AS season_number,
       s.slug AS season_slug,
       t.slug AS tournament_slug,
       t.name AS tournament_name,
       t.dota_league_id,
       t.is_published
FROM seasons s
JOIN tournaments t ON t.id = s.tournament_id
ORDER BY s.number;

-- ---------------------------------------------------------------------------
-- Verify: franchise lore / taglines (run seed-league-team-lore.js --apply if gaps)
-- ---------------------------------------------------------------------------

SELECT slug,
       name,
       status,
       length(trim(tagline)) AS tagline_len,
       length(trim(lore)) AS lore_len,
       founded_season_number,
       sort_order
FROM league_teams
ORDER BY sort_order, name;

-- ---------------------------------------------------------------------------
-- Verify: season ↔ franchise ↔ approved roster mapping
-- (expect 0 rows in "missing link" after backfill-league-teams.js --apply)
-- ---------------------------------------------------------------------------

WITH latest_approved AS (
  SELECT DISTINCT ON (rs.tournament_id)
         rs.tournament_id,
         rs.id AS roster_snapshot_id,
         rs.approved_at
  FROM roster_snapshots rs
  WHERE rs.status = 'approved'
  ORDER BY rs.tournament_id, rs.approved_at DESC NULLS LAST
)
SELECT s.number AS season_number,
       t.slug AS tournament_slug,
       rst.name AS roster_team_name,
       rst.league_team_id,
       lt.slug AS league_team_slug,
       ste.id AS season_team_entry_id
FROM seasons s
JOIN tournaments t ON t.id = s.tournament_id
JOIN latest_approved la ON la.tournament_id = t.id
JOIN roster_snapshot_teams rst ON rst.roster_snapshot_id = la.roster_snapshot_id
LEFT JOIN league_teams lt ON lt.id = rst.league_team_id
LEFT JOIN season_team_entries ste
  ON ste.season_id = s.id
 AND ste.league_team_id = rst.league_team_id
WHERE rst.league_team_id IS NULL
   OR ste.id IS NULL
ORDER BY s.number, rst.name;

-- ---------------------------------------------------------------------------
-- Verify: live tournament teams linked to franchises
-- ---------------------------------------------------------------------------

SELECT t.slug AS tournament_slug,
       s.number AS season_number,
       tm.name AS team_name,
       tm.league_team_id,
       lt.slug AS league_team_slug
FROM teams tm
JOIN tournaments t ON t.id = tm.tournament_id
LEFT JOIN seasons s ON s.tournament_id = t.id
LEFT JOIN league_teams lt ON lt.id = tm.league_team_id
WHERE tm.league_team_id IS NULL
ORDER BY s.number NULLS LAST, tm.name;
