-- Season 2 Phase 1: permanent player accounts (additive only — no drops)

CREATE SEQUENCE IF NOT EXISTS bpc_id_seq START WITH 1;

CREATE TABLE IF NOT EXISTS player_accounts (
  id UUID PRIMARY KEY,
  bpc_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  email_verify_token_hash TEXT,
  email_verify_expires_at TIMESTAMPTZ,
  password_reset_token_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  phone_number TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  steam_id TEXT UNIQUE,
  steam_persona TEXT NOT NULL DEFAULT '',
  steam_avatar_url TEXT NOT NULL DEFAULT '',
  steam_profile TEXT NOT NULL DEFAULT '',
  discord_id TEXT UNIQUE,
  discord_username TEXT NOT NULL DEFAULT '',
  discord_avatar_url TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_accounts_slug ON player_accounts (slug);

CREATE TABLE IF NOT EXISTS player_sessions (
  id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_account ON player_sessions (player_account_id);

CREATE TABLE IF NOT EXISTS player_account_links (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS bpc_coin_ledger (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  granted_by_admin_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpc_coin_ledger_account ON bpc_coin_ledger (player_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY,
  number INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  theme_key TEXT NOT NULL DEFAULT 'emerald',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  tournament_id UUID REFERENCES tournaments (id) ON DELETE SET NULL,
  hero_media JSONB NOT NULL DEFAULT '{}'::jsonb,
  trophy_engraving JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_registrations
ADD COLUMN IF NOT EXISTS player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS card_tier TEXT,
ADD COLUMN IF NOT EXISTS substitute_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_player_registrations_account
ON player_registrations (player_account_id)
WHERE player_account_id IS NOT NULL;

ALTER TABLE players
ADD COLUMN IF NOT EXISTS player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL;

ALTER TABLE roster_snapshot_players
ADD COLUMN IF NOT EXISTS player_account_id UUID REFERENCES player_accounts (id) ON DELETE SET NULL;
