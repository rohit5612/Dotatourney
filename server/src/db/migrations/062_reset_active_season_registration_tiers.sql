-- Reset active-season registration card tiers that were not earned this season.
-- Keeps premium tier when the player paid for it this season or has an approved card asset this season.

UPDATE player_registrations pr
SET card_tier = 'default', updated_at = NOW()
FROM seasons s
WHERE pr.tournament_id = s.tournament_id
  AND s.status = 'active'
  AND pr.archived_at IS NULL
  AND lower(COALESCE(NULLIF(TRIM(pr.card_tier), ''), 'default')) IN ('player', 'gold', 'holo')
  AND NOT EXISTS (
    SELECT 1
    FROM checkout_orders co
    WHERE co.player_account_id = pr.player_account_id
      AND co.tournament_id = pr.tournament_id
      AND co.status = 'paid'
      AND lower(COALESCE(NULLIF(TRIM(co.card_tier), ''), 'default')) IN ('player', 'gold', 'holo')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM player_card_assets pca
    WHERE pca.player_account_id = pr.player_account_id
      AND pca.season_id = s.id
      AND pca.status = 'approved'
  );
