ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS series_rules JSONB NOT NULL DEFAULT '{}'::jsonb;
