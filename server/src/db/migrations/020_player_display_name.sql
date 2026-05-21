ALTER TABLE player_registrations
ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

ALTER TABLE players
ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

ALTER TABLE roster_snapshot_players
ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

UPDATE player_registrations
SET display_name = COALESCE(NULLIF(TRIM(steam_name), ''), name)
WHERE TRIM(display_name) = '';

UPDATE players
SET display_name = COALESCE(NULLIF(TRIM(steam_name), ''), name)
WHERE TRIM(display_name) = '';

UPDATE roster_snapshot_players
SET display_name = COALESCE(NULLIF(TRIM(steam_name), ''), name)
WHERE TRIM(display_name) = '';
