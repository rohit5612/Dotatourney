-- Per-season frozen player card manifests for the Card Deck collection.

CREATE TABLE IF NOT EXISTS player_season_card_snapshots (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments (id) ON DELETE SET NULL,
  card_tier TEXT NOT NULL DEFAULT 'default',
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_account_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_player_season_card_snapshots_account
  ON player_season_card_snapshots (player_account_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_season_card_snapshots_season
  ON player_season_card_snapshots (season_id);

-- Season 3: active card tier comes from current-season registration only.
UPDATE player_accounts
SET card_tier_override = NULL, updated_at = NOW()
WHERE card_tier_override IS NOT NULL;
