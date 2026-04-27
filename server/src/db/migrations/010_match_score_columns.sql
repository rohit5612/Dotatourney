-- Persist match scores in queryable columns (dual-stored with meta JSONB for API compatibility).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_score INTEGER;

UPDATE matches
SET team1_score = (NULLIF(meta->>'team1Score', ''))::INTEGER
WHERE team1_score IS NULL AND meta ? 'team1Score' AND (meta->>'team1Score') ~ '^[0-9]+$';

UPDATE matches
SET team2_score = (NULLIF(meta->>'team2Score', ''))::INTEGER
WHERE team2_score IS NULL AND meta ? 'team2Score' AND (meta->>'team2Score') ~ '^[0-9]+$';
