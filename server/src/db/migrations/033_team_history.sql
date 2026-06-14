CREATE TABLE IF NOT EXISTS team_profile_history (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  snapshot_team_id UUID NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES admin_users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_team_profile_history_team ON team_profile_history (tournament_id, snapshot_team_id, effective_at DESC);
ALTER TABLE player_accounts ADD COLUMN IF NOT EXISTS admin_notes TEXT NOT NULL DEFAULT '';
