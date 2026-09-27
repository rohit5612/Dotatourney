-- Add release dates to major version history entries (idempotent by version)

UPDATE public_site_content
SET payload = jsonb_build_object(
  'entries',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN e->>'version' = '1.0.0' THEN e || '{"releasedAt":"2026-04-24"}'::jsonb
          WHEN e->>'version' = '2.0.0' THEN e || '{"releasedAt":"2026-06-15"}'::jsonb
          WHEN e->>'version' = '3.0.0' THEN e || '{"releasedAt":"2026-09-25"}'::jsonb
          ELSE e
        END
        ORDER BY e->>'version' DESC
      )
      FROM jsonb_array_elements(payload->'entries') AS e
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'version_history'
  AND jsonb_typeof(payload->'entries') = 'array';
