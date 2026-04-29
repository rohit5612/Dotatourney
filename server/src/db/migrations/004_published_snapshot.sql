ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS published_snapshot JSONB;

UPDATE tournaments
SET published_snapshot = jsonb_strip_nulls(
  jsonb_build_object(
    'name', name,
    'slug', slug,
    'format', format,
    'series_type', series_type,
    'team_count', team_count,
    'description', description,
    'prize_pool', prize_pool,
    'prize_pool_breakdown', prize_pool_breakdown,
    'entry_fee', entry_fee,
    'start_date', start_date,
    'end_date', end_date,
    'registration_deadline', registration_deadline,
    'discord_url', discord_url,
    'rulebook', rulebook,
    'announcements', announcements,
    'visibility_mode', visibility_mode
  )
)
WHERE is_published = TRUE AND published_snapshot IS NULL;
