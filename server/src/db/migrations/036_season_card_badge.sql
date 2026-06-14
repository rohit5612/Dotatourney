-- Short label shown on season archive cards (configured in tournament setup)

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS season_card_badge VARCHAR(16) NOT NULL DEFAULT '';
