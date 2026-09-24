-- Site product version + changelog (public_site_content keys)

INSERT INTO public_site_content (key, payload)
VALUES (
  'website_version',
  '{"major": 3, "minor": 0, "patch": 0}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public_site_content (key, payload)
VALUES (
  'version_history',
  '{
    "entries": [
      {
        "id": "vh-season-1",
        "version": "1.0.0",
        "seasonLabel": "Season 1",
        "summary": "First website on Render — static site, manual registration flow."
      },
      {
        "id": "vh-season-2",
        "version": "2.0.0",
        "seasonLabel": "Season 2",
        "summary": "Hostinger deployment — season card system, player accounts, online checkout."
      },
      {
        "id": "vh-season-3",
        "version": "3.0.0",
        "seasonLabel": "Season 3",
        "summary": "League team lores, new public player profiles with stats, and ongoing Season 3 improvements."
      }
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
