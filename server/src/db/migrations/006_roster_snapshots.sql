CREATE TABLE IF NOT EXISTS roster_snapshots (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roster_snapshots_status_check CHECK (status IN ('draft', 'approved'))
);

CREATE TABLE IF NOT EXISTS roster_snapshot_teams (
  id UUID PRIMARY KEY,
  roster_snapshot_id UUID NOT NULL REFERENCES roster_snapshots(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  source_team_id UUID,
  name TEXT NOT NULL,
  captain TEXT,
  abbr TEXT,
  seed INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roster_snapshot_players (
  id UUID PRIMARY KEY,
  roster_snapshot_id UUID NOT NULL REFERENCES roster_snapshots(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  source_player_id UUID,
  registration_id UUID,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  mmr INTEGER,
  steam_name TEXT,
  steam_profile TEXT,
  discord_handle TEXT,
  location TEXT,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roster_snapshot_team_players (
  id UUID PRIMARY KEY,
  roster_snapshot_id UUID NOT NULL REFERENCES roster_snapshots(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES roster_snapshot_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES roster_snapshot_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roster_snapshot_id, team_id, player_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_snapshots_one_approved
ON roster_snapshots(tournament_id)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_roster_snapshots_tournament ON roster_snapshots(tournament_id);
CREATE INDEX IF NOT EXISTS idx_roster_snapshot_teams_snapshot ON roster_snapshot_teams(roster_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_roster_snapshot_players_snapshot ON roster_snapshot_players(roster_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_roster_snapshot_team_players_snapshot ON roster_snapshot_team_players(roster_snapshot_id);
