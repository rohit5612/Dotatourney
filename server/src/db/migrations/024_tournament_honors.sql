ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS tournament_honors JSONB NOT NULL DEFAULT '{"displayPodiumCount":2,"mvp":null,"customCards":[]}'::jsonb;
