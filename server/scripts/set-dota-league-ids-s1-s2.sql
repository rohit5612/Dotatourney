-- Valve in-house league IDs for BPCL seasons (OpenDota / profile stats).
-- Safe to re-run: sets explicit IDs by season number (and slug fallback).

BEGIN;

-- Season 1 → league 19721
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

-- Season 2 → league 19921
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

COMMIT;

-- Verify
SELECT s.number AS season_number,
       s.slug AS season_slug,
       t.slug AS tournament_slug,
       t.name AS tournament_name,
       t.dota_league_id
FROM seasons s
JOIN tournaments t ON t.id = s.tournament_id
WHERE s.number IN (1, 2)
ORDER BY s.number;
