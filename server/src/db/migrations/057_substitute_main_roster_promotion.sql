-- Audit trail when a substitute-pool player is promoted to the main tournament roster

ALTER TABLE player_registrations
  ADD COLUMN IF NOT EXISTS promoted_from_substitute_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_from_substitute_by UUID REFERENCES admin_users (id) ON DELETE SET NULL;
