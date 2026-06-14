-- Allow up to 8 groups (A–H) to match engine_config group stage.

UPDATE roster_snapshot_teams
SET group_key = upper(trim(group_key))
WHERE group_key IS NOT NULL;

UPDATE roster_snapshot_teams
SET group_key = NULL
WHERE group_key IS NOT NULL AND group_key !~ '^[A-H]$';

ALTER TABLE roster_snapshot_teams
  DROP CONSTRAINT IF EXISTS roster_snapshot_teams_group_key_check;

ALTER TABLE roster_snapshot_teams
  ADD CONSTRAINT roster_snapshot_teams_group_key_check
  CHECK (group_key IS NULL OR group_key ~ '^[A-H]$');
