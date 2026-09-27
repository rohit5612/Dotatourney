INSERT INTO public_site_content (key, payload)
VALUES (
  'version_changelog',
  '{"lines": []}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
