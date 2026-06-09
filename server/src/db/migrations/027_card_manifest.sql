-- Season 2 Phase 4: profile enrichment for card manifest

ALTER TABLE player_accounts
ADD COLUMN IF NOT EXISTS clips JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_player_accounts_display_name ON player_accounts (lower(display_name));
