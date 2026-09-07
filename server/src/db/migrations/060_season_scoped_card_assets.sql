-- Allow one card asset row per player, tier, and season (not one row per tier globally).

-- Backfill season_id from tournament_id.
UPDATE player_card_assets pca
SET season_id = sub.season_id
FROM (
  SELECT DISTINCT ON (pca2.id)
    pca2.id AS asset_id,
    s.id AS season_id
  FROM player_card_assets pca2
  JOIN seasons s ON s.tournament_id = pca2.tournament_id
  WHERE pca2.season_id IS NULL
    AND pca2.tournament_id IS NOT NULL
  ORDER BY pca2.id, s.number DESC
) sub
WHERE pca.id = sub.asset_id;

-- Backfill tournament_id from season_id where missing.
UPDATE player_card_assets pca
SET tournament_id = s.tournament_id
FROM seasons s
WHERE pca.tournament_id IS NULL
  AND pca.season_id = s.id;

-- Tie orphan assets to the player's matching paid registration season.
UPDATE player_card_assets pca
SET season_id = sub.season_id,
    tournament_id = COALESCE(pca.tournament_id, sub.tournament_id)
FROM (
  SELECT DISTINCT ON (pca2.id)
    pca2.id AS asset_id,
    s.id AS season_id,
    pr.tournament_id
  FROM player_card_assets pca2
  JOIN player_registrations pr
    ON pr.player_account_id = pca2.player_account_id
   AND pr.archived_at IS NULL
   AND lower(COALESCE(NULLIF(TRIM(pr.card_tier), ''), 'default')) = lower(pca2.tier)
  JOIN seasons s ON s.tournament_id = pr.tournament_id
  WHERE pca2.season_id IS NULL
  ORDER BY pca2.id, pr.created_at DESC, s.number DESC
) sub
WHERE pca.id = sub.asset_id;

-- Last resort: assign remaining orphan assets to the active season.
UPDATE player_card_assets pca
SET season_id = sub.id,
    tournament_id = COALESCE(pca.tournament_id, sub.tournament_id)
FROM (
  SELECT id, tournament_id
  FROM seasons
  WHERE status = 'active'
  ORDER BY number DESC
  LIMIT 1
) sub
WHERE pca.season_id IS NULL;

ALTER TABLE player_card_assets
  DROP CONSTRAINT IF EXISTS player_card_assets_player_account_id_tier_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_card_assets_account_tier_season
  ON player_card_assets (player_account_id, tier, season_id)
  WHERE season_id IS NOT NULL;
