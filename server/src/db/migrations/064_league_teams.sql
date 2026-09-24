CREATE TABLE IF NOT EXISTS league_teams (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  abbr TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  lore TEXT NOT NULL DEFAULT '',
  history TEXT NOT NULL DEFAULT '',
  art JSONB NOT NULL DEFAULT '{"gallery":[]}'::jsonb,
  founded_season_number INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT league_teams_status_check CHECK (status IN ('active', 'dormant', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_league_teams_status_sort ON league_teams (status, sort_order ASC, name ASC);

CREATE TABLE IF NOT EXISTS league_team_aliases (
  id UUID PRIMARY KEY,
  league_team_id UUID NOT NULL REFERENCES league_teams (id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_team_aliases_normalized
  ON league_team_aliases (alias_normalized);

CREATE INDEX IF NOT EXISTS idx_league_team_aliases_team
  ON league_team_aliases (league_team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS season_team_entries (
  id UUID PRIMARY KEY,
  league_team_id UUID NOT NULL REFERENCES league_teams (id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  roster_snapshot_team_id UUID REFERENCES roster_snapshot_teams (id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT '',
  placement INTEGER,
  honors JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_team_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_season_team_entries_season ON season_team_entries (season_id);
CREATE INDEX IF NOT EXISTS idx_season_team_entries_snapshot_team ON season_team_entries (roster_snapshot_team_id);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS league_team_id UUID REFERENCES league_teams (id) ON DELETE SET NULL;
ALTER TABLE roster_snapshot_teams ADD COLUMN IF NOT EXISTS league_team_id UUID REFERENCES league_teams (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_league_team ON teams (league_team_id);
CREATE INDEX IF NOT EXISTS idx_roster_snapshot_teams_league_team ON roster_snapshot_teams (league_team_id);
