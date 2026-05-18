ALTER TABLE schedule_slots
  ADD COLUMN IF NOT EXISTS stream_url TEXT;
