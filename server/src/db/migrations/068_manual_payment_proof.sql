-- Manual UPI: payment proof on sponsor contributions

ALTER TABLE sponsor_contributions
ADD COLUMN IF NOT EXISTS payment_screenshot TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS payment_notes TEXT NOT NULL DEFAULT '';
