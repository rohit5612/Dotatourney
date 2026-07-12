-- Sponsor contributions: individual vs organisation

ALTER TABLE sponsor_contributions
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'person';
