ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS google_sheet_spreadsheet_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_sheet_tab_name TEXT NOT NULL DEFAULT '';
