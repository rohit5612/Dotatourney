-- Registration flow: email OTP, public code, payment QR, draft payload

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS registration_code_prefix TEXT NOT NULL DEFAULT 'FORGE',
ADD COLUMN IF NOT EXISTS registration_code_seq INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_qr_image TEXT NOT NULL DEFAULT '';

ALTER TABLE player_registrations
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS public_code TEXT,
ADD COLUMN IF NOT EXISTS registration_flow_stage TEXT NOT NULL DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS otp_hash TEXT,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS draft_payload JSONB;

-- Legacy rows: synthetic email + treat as completed flow
UPDATE player_registrations
SET email = 'legacy-' || id::text || '@migrated.forge',
    registration_flow_stage = 'submitted'
WHERE email IS NULL OR trim(email) = '';

ALTER TABLE player_registrations ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_registrations_active_email
ON player_registrations (tournament_id, lower(email))
WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_registrations_public_code
ON player_registrations (tournament_id, public_code)
WHERE public_code IS NOT NULL;
