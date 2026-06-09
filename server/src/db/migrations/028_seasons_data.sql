-- Season 2 Phase 5: season participations and season metadata

CREATE TABLE IF NOT EXISTS season_participations (
  id UUID PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
  player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments (id) ON DELETE SET NULL,
  team_name TEXT NOT NULL DEFAULT '',
  placement INTEGER,
  role TEXT NOT NULL DEFAULT '',
  honors JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_participations_season ON season_participations (season_id);
CREATE INDEX IF NOT EXISTS idx_season_participations_account ON season_participations (player_account_id)
WHERE player_account_id IS NOT NULL;

-- seasons.snapshot and seasons.trophy_engraving added in 025_player_accounts.sql
