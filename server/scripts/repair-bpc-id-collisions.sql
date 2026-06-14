-- =============================================================================
-- Fix portal accounts whose bpc_id collides with Season 1 registration codes
-- =============================================================================
--
-- Run AFTER sync-bpc-id-sequence.sql if the collision query returned rows.
-- Reassigns conflicting *player_accounts* (not registrations) to the next free
-- BPC-### above the current max.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/repair-bpc-id-collisions.sql
--
-- =============================================================================

WITH bounds AS (
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
  ) AS max_n
),
collisions AS (
  SELECT DISTINCT ON (pa.id)
    pa.id,
    pa.bpc_id AS old_bpc_id,
    pa.email,
    bounds.max_n
      + ROW_NUMBER() OVER (ORDER BY pa.created_at ASC, pa.email ASC) AS new_n
  FROM player_accounts pa
  JOIN player_registrations pr
    ON upper(pr.public_code) = upper(pa.bpc_id)
   AND pr.public_code IS NOT NULL
  CROSS JOIN bounds
  WHERE lower(pa.email) <> lower(pr.email)
     OR pr.player_account_id IS NULL
     OR pr.player_account_id <> pa.id
)
UPDATE player_accounts pa
SET
  bpc_id = 'BPC-' || LPAD(c.new_n::text, 3, '0'),
  updated_at = NOW()
FROM collisions c
WHERE pa.id = c.id
RETURNING pa.email, pa.bpc_id AS assigned_bpc_id;

-- Re-sync sequence after repairs
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
