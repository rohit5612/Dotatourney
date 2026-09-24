-- Valve league ID for in-house amateur leagues + durable OpenDota cache.

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS dota_league_id BIGINT NULL;

CREATE TABLE IF NOT EXISTS player_opendota_snapshots (
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  snapshot_kind TEXT NOT NULL,
  steam32 INTEGER NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_account_id, snapshot_kind)
);

CREATE INDEX IF NOT EXISTS idx_player_opendota_snapshots_expires
  ON player_opendota_snapshots (expires_at);

CREATE TABLE IF NOT EXISTS opendota_league_match_index (
  dota_match_id BIGINT PRIMARY KEY,
  dota_league_id BIGINT NOT NULL,
  start_time INTEGER NOT NULL DEFAULT 0,
  radiant_win BOOLEAN NULL,
  leagueid_verified BOOLEAN NOT NULL DEFAULT FALSE,
  steam32_ids INTEGER[] NOT NULL DEFAULT '{}'::integer[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opendota_league_match_league
  ON opendota_league_match_index (dota_league_id, start_time DESC);

CREATE TABLE IF NOT EXISTS opendota_match_cache (
  dota_match_id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dota_league_id BIGINT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
