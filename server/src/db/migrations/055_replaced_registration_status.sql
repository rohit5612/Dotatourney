-- Permanent roster replacement: audit fields on registrations and cap auto-close tracking on tournaments

ALTER TABLE player_registrations
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaced_reason TEXT;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS registrations_auto_closed_at TIMESTAMPTZ;
