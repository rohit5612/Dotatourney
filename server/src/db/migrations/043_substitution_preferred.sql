ALTER TABLE substitution_requests
  ADD COLUMN IF NOT EXISTS preferred_substitute_registration_id UUID REFERENCES player_registrations (id) ON DELETE SET NULL;
