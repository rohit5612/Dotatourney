-- Player card JSON payloads from offline generator + season scoping

ALTER TABLE player_card_assets
ADD COLUMN IF NOT EXISTS manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES admin_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_player_card_assets_season ON player_card_assets (season_id)
WHERE season_id IS NOT NULL;
