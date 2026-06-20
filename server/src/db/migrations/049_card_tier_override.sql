-- Admin-assigned card tier for profile display (independent of registration purchase tier)

ALTER TABLE player_accounts
ADD COLUMN IF NOT EXISTS card_tier_override TEXT;

COMMENT ON COLUMN player_accounts.card_tier_override IS
  'When set by admin on card upload, drives profile card render tier and premium status effects.';
