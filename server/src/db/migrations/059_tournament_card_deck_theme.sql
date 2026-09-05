-- Card deck season badge colors configured per tournament in Setup → Content.
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS season_card_deck_theme JSONB NOT NULL DEFAULT '{}'::jsonb;
