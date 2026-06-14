-- Per-match lineup snapshots, player notifications, extended substitution requests

ALTER TABLE substitution_requests
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS replaced_player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_substitution_requests_match
  ON substitution_requests (match_id, status)
  WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_substitution_requests_active_per_player
  ON substitution_requests (match_id, requesting_player_account_id)
  WHERE status = 'pending' AND match_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS match_lineup_players (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  mmr INTEGER,
  is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
  replaces_player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
  substitution_request_id UUID REFERENCES substitution_requests (id) ON DELETE SET NULL,
  slot_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, team_name, player_account_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineup_players_match ON match_lineup_players (match_id, team_name);
CREATE INDEX IF NOT EXISTS idx_match_lineup_players_account ON match_lineup_players (player_account_id);

CREATE TABLE IF NOT EXISTS player_notifications (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_notifications_type_check CHECK (
    type IN ('substitution_filed', 'substitution_assigned', 'substitution_cancelled', 'broadcast')
  )
);

CREATE INDEX IF NOT EXISTS idx_player_notifications_account
  ON player_notifications (player_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_notifications_unread
  ON player_notifications (player_account_id)
  WHERE read_at IS NULL;

-- Backfill roster snapshot player_account_id from registrations
UPDATE roster_snapshot_players rsp
SET player_account_id = pr.player_account_id
FROM player_registrations pr
WHERE rsp.registration_id = pr.id
  AND rsp.player_account_id IS NULL
  AND pr.player_account_id IS NOT NULL;
