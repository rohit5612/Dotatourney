-- Fix card assets that were incorrectly assigned to the active season (migration 060 last-resort).
-- Tournament_id is the authoritative link to a season.

UPDATE player_card_assets pca
SET season_id = sub.season_id
FROM (
  SELECT DISTINCT ON (pca2.id)
    pca2.id AS asset_id,
    s.id AS season_id
  FROM player_card_assets pca2
  JOIN seasons s ON s.tournament_id = pca2.tournament_id
  WHERE pca2.tournament_id IS NOT NULL
  ORDER BY pca2.id, s.number DESC
) sub
WHERE pca.id = sub.asset_id
  AND pca.season_id IS DISTINCT FROM sub.season_id;

-- Clear stale global tier overrides on season rollover (community resets to registration tier).
UPDATE player_accounts
SET card_tier_override = NULL, updated_at = NOW()
WHERE card_tier_override IS NOT NULL;
