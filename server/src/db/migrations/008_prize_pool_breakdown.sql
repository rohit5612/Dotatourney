ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS prize_pool_breakdown TEXT NOT NULL DEFAULT '';
