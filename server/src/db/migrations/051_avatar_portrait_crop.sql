ALTER TABLE player_accounts
  ADD COLUMN IF NOT EXISTS avatar_portrait_crop JSONB NOT NULL DEFAULT '{}';
