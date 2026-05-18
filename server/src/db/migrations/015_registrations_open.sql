ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS registrations_open BOOLEAN NOT NULL DEFAULT FALSE;

-- Approximate prior behavior once: deadline unset or still in future => accepting registrations.
UPDATE tournaments
SET registrations_open = TRUE
WHERE registration_deadline IS NULL OR registration_deadline > NOW();
