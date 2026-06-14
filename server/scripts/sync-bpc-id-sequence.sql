-- =============================================================================
-- Sync bpc_id_seq after prod import / restore
-- =============================================================================
--
-- BPC IDs are stored in:
--   player_accounts.bpc_id          (new portal accounts)
--   player_registrations.public_code (Season 1+ registration rows)
--
-- Run after importing production data (especially if wipe script reset the seq):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sync-bpc-id-sequence.sql
--
-- =============================================================================

-- Current max in use
SELECT GREATEST(
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int)
     FROM player_accounts WHERE bpc_id ~ '^BPC-[0-9]+$'),
    0
  ),
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(public_code, '^BPC-', ''), '')::int)
     FROM player_registrations WHERE public_code ~ '^BPC-[0-9]+$'),
    0
  )
) AS max_bpc_number_in_use;

-- Collisions: portal account BPC matches a registration code on a different email
SELECT
  pa.bpc_id,
  pa.email AS account_email,
  pr.email AS registration_email,
  pr.public_code
FROM player_accounts pa
JOIN player_registrations pr
  ON upper(pr.public_code) = upper(pa.bpc_id)
 AND pr.public_code IS NOT NULL
WHERE lower(pa.email) <> lower(pr.email)
   OR pr.player_account_id IS NULL
   OR pr.player_account_id <> pa.id;

-- Advance sequence so next signup gets max + 1
SELECT setval(
  'bpc_id_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int)
       FROM player_accounts WHERE bpc_id ~ '^BPC-[0-9]+$'),
      0
    ),
    COALESCE(
      (SELECT MAX(NULLIF(regexp_replace(public_code, '^BPC-', ''), '')::int)
       FROM player_registrations WHERE public_code ~ '^BPC-[0-9]+$'),
      0
    ),
    1
  ),
  true
) AS bpc_id_seq_now_set_to;

-- Next ID the API will try (for verification)
SELECT 'BPC-' || LPAD((last_value + 1)::text, 3, '0') AS next_bpc_id_after_restart
FROM bpc_id_seq;
