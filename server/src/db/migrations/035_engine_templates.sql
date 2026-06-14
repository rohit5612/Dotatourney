CREATE TABLE IF NOT EXISTS engine_templates (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_templates_updated ON engine_templates (updated_at DESC);

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS engine_template_id UUID REFERENCES engine_templates (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_engine_template ON tournaments (engine_template_id)
WHERE engine_template_id IS NOT NULL;
