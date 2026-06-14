-- Patch the five demo.access*@bpcl.test accounts (run after reset-and-seed-season1.sql).
-- Password unchanged: BpclTest123!

BEGIN;

WITH demo_rows AS (
  SELECT *
  FROM (
    VALUES
      (1, '["Carry"]'::jsonb, 4200),
      (2, '["Mid"]'::jsonb, 4350),
      (3, '["Offlane"]'::jsonb, 4500),
      (4, '["Soft support"]'::jsonb, 4650),
      (5, '["Hard support"]'::jsonb, 4800)
  ) AS t(n, roles, mmr)
)
UPDATE player_accounts pa
SET
  email_verified_at = COALESCE(pa.email_verified_at, NOW()),
  steam_id = COALESCE(
    pa.steam_id,
    '7656119899' || LPAD(d.n::text, 7, '0')
  ),
  steam_persona = COALESCE(NULLIF(pa.steam_persona, ''), 'DemoSteam_' || d.n),
  steam_profile = COALESCE(
    NULLIF(pa.steam_profile, ''),
    'https://steamcommunity.com/id/demo-access-' || LPAD(d.n::text, 2, '0')
  ),
  discord_id = COALESCE(pa.discord_id, '9000000000' || (10000 + d.n)::text),
  discord_username = COALESCE(NULLIF(pa.discord_username, ''), 'demo_discord_' || d.n),
  mmr = COALESCE(pa.mmr, d.mmr),
  preferred_roles = CASE
    WHEN pa.preferred_roles IS NULL OR pa.preferred_roles = '[]'::jsonb THEN d.roles
    ELSE pa.preferred_roles
  END,
  location = COALESCE(NULLIF(pa.location, ''), 'Demo City, IN'),
  phone_number = COALESCE(NULLIF(pa.phone_number, ''), '+91 98765' || LPAD((43200 + d.n)::text, 5, '0')),
  profile_completed_at = COALESCE(pa.profile_completed_at, NOW()),
  admin_notes = 'Demo account — linkage + profile prefilled for registration testing.',
  updated_at = NOW()
FROM demo_rows d
WHERE pa.email = 'demo.access' || LPAD(d.n::text, 2, '0') || '@bpcl.test';

COMMIT;

SELECT email, bpc_id, display_name,
       steam_id IS NOT NULL AS steam,
       discord_id IS NOT NULL AS discord,
       mmr,
       preferred_roles,
       location,
       phone_number
FROM player_accounts
WHERE email LIKE 'demo.access%@bpcl.test'
ORDER BY email;
