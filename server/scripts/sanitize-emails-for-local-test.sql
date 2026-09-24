-- =============================================================================
-- LOCAL TEST ONLY — run after restoring production into a dev database.
-- Rewrites all stored emails to @local.invalid (RFC 2606 — not routable).
-- Does NOT change registration_status, payment_status, or email_verified_at.
--
-- Also set EMAIL_SKIP_SEND=true in server/.env as a second safety net.
-- =============================================================================

BEGIN;

-- Player accounts (login / OTP / notifications)
UPDATE player_accounts
SET email = 'player+' || replace(id::text, '-', '') || '@local.invalid',
    updated_at = NOW()
WHERE email NOT LIKE '%@local.invalid';

-- Registrations: align with linked account when present
UPDATE player_registrations pr
SET email = pa.email,
    updated_at = NOW()
FROM player_accounts pa
WHERE pr.player_account_id = pa.id
  AND pr.email IS DISTINCT FROM pa.email;

-- Remaining registrations (no account or legacy rows)
UPDATE player_registrations pr
SET email = 'reg+' || replace(pr.id::text, '-', '') || '@local.invalid',
    updated_at = NOW()
WHERE pr.email NOT LIKE '%@local.invalid';

-- Admin (invites + sign-in email)
UPDATE admin_users
SET email = 'admin+' || replace(id::text, '-', '') || '@local.invalid',
    updated_at = NOW()
WHERE email NOT LIKE '%@local.invalid';

UPDATE admin_invites
SET email = 'invite+' || replace(id::text, '-', '') || '@local.invalid',
    updated_at = NOW()
WHERE email NOT LIKE '%@local.invalid';

-- Sponsor form submissions (if any)
UPDATE sponsor_contributions
SET email = 'sponsor+' || replace(id::text, '-', '') || '@local.invalid',
    updated_at = NOW()
WHERE email NOT LIKE '%@local.invalid';

COMMIT;

-- Quick check: approved registrations should be unchanged except email
-- SELECT registration_status, payment_status, count(*) FROM player_registrations GROUP BY 1, 2;
