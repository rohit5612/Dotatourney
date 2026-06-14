-- Restored prod dumps may predate player_account_id on roster rows (025 bootstrapped as applied).
ALTER TABLE roster_snapshot_players
  ADD COLUMN IF NOT EXISTS player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roster_snapshot_players_account
  ON roster_snapshot_players (player_account_id)
  WHERE player_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_account
  ON players (player_account_id)
  WHERE player_account_id IS NOT NULL;

-- Link roster players via registration → player_account
UPDATE roster_snapshot_players rsp
SET player_account_id = pr.player_account_id
FROM player_registrations pr
WHERE rsp.registration_id = pr.id
  AND rsp.player_account_id IS NULL
  AND pr.player_account_id IS NOT NULL;

-- Fallback: match registration email to player_accounts
UPDATE roster_snapshot_players rsp
SET player_account_id = pa.id
FROM player_registrations pr
JOIN player_accounts pa ON lower(pa.email) = lower(pr.email)
WHERE rsp.registration_id = pr.id
  AND rsp.player_account_id IS NULL;
