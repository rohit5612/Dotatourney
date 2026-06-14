CREATE TABLE IF NOT EXISTS substitution_requests (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  snapshot_team_id UUID,
  requesting_player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
  substitute_registration_id UUID REFERENCES player_registrations (id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  window_expires_at TIMESTAMPTZ,
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT substitution_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  )
);
CREATE INDEX IF NOT EXISTS idx_substitution_requests_tournament ON substitution_requests (tournament_id, status, created_at DESC);
