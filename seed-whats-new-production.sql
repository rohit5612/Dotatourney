-- What's New page — production seed (public_site_content)
-- Run: psql "$DATABASE_URL" -f seed-whats-new-production.sql
--
-- Seeds the data the /whats-new page reads from the API:
--   website_version   — current site semver (footer / meta)
--   version_history   — major releases (Season 1–3 cards, dates, summaries)
--   version_changelog — patch/minor lines for the "View changelog" modal
--
-- Rich Season 2 / Season 3 layouts and screenshots live in the frontend repo
-- (React + dota/public/whats-new/season-3/*.png), not in Postgres.
-- After this SQL, add patch lines via Admin → Site version or PUT /api/admin/site-content.

BEGIN;

INSERT INTO public_site_content (key, payload, updated_at)
VALUES (
  'website_version',
  '{"major": 3, "minor": 0, "patch": 0}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = NOW();

INSERT INTO public_site_content (key, payload, updated_at)
VALUES (
  'version_history',
  '{
    "entries": [
      {
        "id": "vh-season-1",
        "version": "1.0.0",
        "seasonLabel": "Season 1",
        "releasedAt": "2026-04-24",
        "summary": "First website on Render — static site, manual registration flow."
      },
      {
        "id": "vh-season-2",
        "version": "2.0.0",
        "seasonLabel": "Season 2",
        "releasedAt": "2026-06-15",
        "summary": "Hostinger deployment — season card system, player accounts, and dashboard checkout."
      },
      {
        "id": "vh-season-3",
        "version": "3.0.0",
        "seasonLabel": "Season 3",
        "releasedAt": "2026-09-25",
        "summary": "League team lores, new public player profiles with stats, and ongoing Season 3 improvements."
      }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = NOW();

INSERT INTO public_site_content (key, payload, updated_at)
VALUES (
  'version_changelog',
  '{"lines": []}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  payload = CASE
    WHEN public_site_content.payload->'lines' IS NULL
      OR jsonb_array_length(COALESCE(public_site_content.payload->'lines', '[]'::jsonb)) = 0
    THEN EXCLUDED.payload
    ELSE public_site_content.payload
  END,
  updated_at = NOW();

COMMIT;

-- Verify
SELECT key, jsonb_pretty(payload) AS payload
FROM public_site_content
WHERE key IN ('website_version', 'version_history', 'version_changelog')
ORDER BY key;
