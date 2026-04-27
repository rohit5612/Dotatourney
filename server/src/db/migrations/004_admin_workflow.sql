ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_one_published
ON tournaments(is_published)
WHERE is_published = TRUE;

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

DROP INDEX IF EXISTS idx_tournaments_slug;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_published_slug
ON tournaments(slug)
WHERE slug IS NOT NULL AND is_published = TRUE;

ALTER TABLE player_registrations
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS archived_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_player_registrations_archived ON player_registrations(archived_at);
