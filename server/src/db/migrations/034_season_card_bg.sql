-- Season card background image (uploaded in tournament setup, used on /seasons archive cards)

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS season_card_bg TEXT NOT NULL DEFAULT '';
