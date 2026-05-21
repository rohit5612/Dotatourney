ALTER TABLE roster_snapshot_teams
  ADD COLUMN IF NOT EXISTS group_key TEXT;

ALTER TABLE roster_snapshot_teams
  DROP CONSTRAINT IF EXISTS roster_snapshot_teams_group_key_check;

ALTER TABLE roster_snapshot_teams
  ADD CONSTRAINT roster_snapshot_teams_group_key_check
  CHECK (group_key IS NULL OR group_key IN ('A', 'B'));

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY roster_snapshot_id
      ORDER BY seed ASC NULLS LAST, created_at ASC
    ) - 1 AS idx,
    COUNT(*) OVER (PARTITION BY roster_snapshot_id) AS total
  FROM roster_snapshot_teams
  WHERE group_key IS NULL
)
UPDATE roster_snapshot_teams AS t
SET group_key = CASE
  WHEN r.idx < CEIL(r.total::numeric / 2) THEN 'A'
  ELSE 'B'
END
FROM ranked AS r
WHERE t.id = r.id;
