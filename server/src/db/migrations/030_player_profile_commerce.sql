-- Season 2: player profile fields, per-tournament commerce config, legacy claim tokens

ALTER TABLE player_accounts
ADD COLUMN IF NOT EXISTS mmr INTEGER,
ADD COLUMN IF NOT EXISTS preferred_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS tournament_commerce_config (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL UNIQUE REFERENCES tournaments (id) ON DELETE CASCADE,
  registration_fee_rupees INTEGER NOT NULL DEFAULT 300,
  card_tiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_cash_rupees INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_commerce_config_tournament
ON tournament_commerce_config (tournament_id);

CREATE TABLE IF NOT EXISTS player_claim_tokens (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_claim_tokens_hash
ON player_claim_tokens (token_hash)
WHERE used_at IS NULL;
