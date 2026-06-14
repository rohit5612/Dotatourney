-- Per-tournament solo registration player cap (shown on landing when published)

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS registration_cap INTEGER;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_registration_cap_positive;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_registration_cap_positive
  CHECK (registration_cap IS NULL OR registration_cap > 0);
