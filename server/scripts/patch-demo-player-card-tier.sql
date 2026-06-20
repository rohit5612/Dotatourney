-- Reset demo access 1 & 2 player cards to pending until admin uploads JSON.

BEGIN;

UPDATE player_card_assets pca
SET
  status = 'pending',
  manifest_json = '{}'::jsonb,
  approved_at = NULL,
  updated_at = NOW()
FROM player_accounts pa
WHERE pca.player_account_id = pa.id
  AND pa.email IN ('demo.access01@bpcl.test', 'demo.access02@bpcl.test')
  AND pca.tier = 'player';

COMMIT;

SELECT pa.email, pca.tier, pca.status, pca.manifest_json
FROM player_accounts pa
LEFT JOIN player_card_assets pca ON pca.player_account_id = pa.id AND pca.tier = 'player'
WHERE pa.email IN ('demo.access01@bpcl.test', 'demo.access02@bpcl.test')
ORDER BY pa.email;
