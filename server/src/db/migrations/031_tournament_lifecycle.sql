-- Admin rebuild: tournament engine config + concluded lifecycle

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS engine_config JSONB,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES admin_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_engine_config ON tournaments USING gin (engine_config);
