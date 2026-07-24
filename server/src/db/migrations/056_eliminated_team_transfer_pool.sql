-- Eliminated team transfer pool: freeze public roster, release players to active teams

ALTER TABLE roster_snapshot_teams
  ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminated_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS elimination_source TEXT;

CREATE TABLE IF NOT EXISTS roster_snapshot_team_elimination_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_snapshot_id UUID NOT NULL REFERENCES roster_snapshots (id) ON DELETE CASCADE,
  snapshot_team_id UUID NOT NULL REFERENCES roster_snapshot_teams (id) ON DELETE CASCADE,
  snapshot_player_id UUID NOT NULL REFERENCES roster_snapshot_players (id) ON DELETE CASCADE,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roster_snapshot_id, snapshot_team_id, snapshot_player_id)
);

CREATE INDEX IF NOT EXISTS idx_rst_elimination_players_team
  ON roster_snapshot_team_elimination_players (roster_snapshot_id, snapshot_team_id);

ALTER TABLE player_registrations
  ADD COLUMN IF NOT EXISTS transfer_pool_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_pool_released_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_player_registrations_transfer_pool
  ON player_registrations (tournament_id, transfer_pool_eligible)
  WHERE transfer_pool_eligible = TRUE AND archived_at IS NULL;
