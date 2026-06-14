-- Reassign portal accounts whose bpc_id collides with registration public_code
-- (e.g. Google signup got BPC-002 while Season 1 already has BPC-002 in registrations).
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
WHERE pa.id = c.id;

-- Sync sequence to max used in accounts OR registrations (next nextval → max + 1).
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
);
