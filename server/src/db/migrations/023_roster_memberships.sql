CREATE TABLE IF NOT EXISTS roster_snapshot_team_memberships (
  id UUID PRIMARY KEY,
  roster_snapshot_id UUID NOT NULL REFERENCES roster_snapshots(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  snapshot_team_id UUID NOT NULL REFERENCES roster_snapshot_teams(id) ON DELETE CASCADE,
  snapshot_player_id UUID NOT NULL REFERENCES roster_snapshot_players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  adjusted_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_membership_active_player
  ON roster_snapshot_team_memberships (roster_snapshot_id, snapshot_player_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_roster_memberships_snapshot
  ON roster_snapshot_team_memberships (roster_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_roster_memberships_team
  ON roster_snapshot_team_memberships (snapshot_team_id);

-- Seed active memberships from existing approved roster assignments
INSERT INTO roster_snapshot_team_memberships (
  id,
  roster_snapshot_id,
  tournament_id,
  snapshot_team_id,
  snapshot_player_id,
  status,
  started_at,
  adjusted_by
)
SELECT
  gen_random_uuid(),
  rstp.roster_snapshot_id,
  rstp.tournament_id,
  rstp.team_id,
  rstp.player_id,
  'active',
  COALESCE(rs.approved_at, rstp.created_at, NOW()),
  rs.approved_by
FROM roster_snapshot_team_players rstp
JOIN roster_snapshots rs ON rs.id = rstp.roster_snapshot_id
WHERE rs.status = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM roster_snapshot_team_memberships existing
    WHERE existing.roster_snapshot_id = rstp.roster_snapshot_id
  );
