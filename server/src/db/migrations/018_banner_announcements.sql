ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS banner_announcements JSONB NOT NULL DEFAULT '[]'::jsonb;
