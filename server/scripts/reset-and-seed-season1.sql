-- =============================================================================
-- BPC League — full tournament reset + Season 1 seed
-- =============================================================================
--
-- What this does:
--   1. Deletes ALL tournament / registration / bracket / roster data
--   2. Creates Season 1 (published + active) with current sponsor config
--   3. Seeds 77 approved, paid registrants (player_accounts + registrations)
--      — email, Steam, and Discord pre-linked (registration-ready)
--   4. Creates 5 login-only demo accounts (NOT registered) for manual testing
--      — linkage bypassed; Steam/Discord + profile prefilled for registration flow
--   5. Preserves any player_accounts that already have email + Steam + Discord
--
-- Run (from server/):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reset-and-seed-season1.sql
--
-- Demo logins (password for all five): BpclTest123!
--   demo.access01@bpcl.test … demo.access05@bpcl.test
--
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Snapshot accounts to keep (fully linked: email + Steam + Discord)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _preserved_accounts ON COMMIT DROP AS
SELECT id, email, bpc_id, display_name
FROM player_accounts
WHERE email_verified_at IS NOT NULL
  AND COALESCE(steam_id, '') <> ''
  AND COALESCE(discord_id, '') <> '';

-- ---------------------------------------------------------------------------
-- 1. Wipe tournament ecosystem (deepest children first where needed)
-- ---------------------------------------------------------------------------
DELETE FROM match_lineup_players;
DELETE FROM substitution_requests;
DELETE FROM roster_snapshot_team_players;
DELETE FROM roster_snapshot_team_memberships;
DELETE FROM roster_snapshot_players;
DELETE FROM roster_snapshot_teams;
DELETE FROM roster_snapshots;
DELETE FROM team_profile_history;
DELETE FROM checkout_orders;
DELETE FROM player_registrations;
DELETE FROM season_participations;
DELETE FROM seasons;
DELETE FROM tournaments;

-- ---------------------------------------------------------------------------
-- 2. Remove non-preserved player accounts (old seeds, partial accounts, etc.)
-- ---------------------------------------------------------------------------
DELETE FROM player_accounts
WHERE id NOT IN (SELECT id FROM _preserved_accounts);

-- Reset BPC id sequence above any preserved codes
SELECT setval(
  'bpc_id_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int)
        FROM player_accounts
        WHERE bpc_id ~ '^BPC-[0-9]+$'
      ),
      0
    ),
    1
  ),
  true
);

-- ---------------------------------------------------------------------------
-- 3. Create Season 1 tournament (approved workflow → published + active)
-- ---------------------------------------------------------------------------
INSERT INTO tournaments (
  id,
  name,
  slug,
  format,
  series_type,
  team_count,
  dark_mode,
  series_rules,
  description,
  prize_pool,
  prize_pool_breakdown,
  entry_fee,
  start_date,
  end_date,
  registration_deadline,
  discord_url,
  rulebook,
  live_youtube_url,
  announcements,
  banner_announcements,
  tournament_honors,
  visibility_mode,
  bracket_active,
  status,
  is_published,
  published_at,
  registrations_open,
  registration_cap,
  registration_code_prefix,
  registration_code_seq,
  payment_upi_id,
  payment_qr_image,
  engine_template_id,
  engine_config,
  season_card_bg,
  season_card_badge,
  published_snapshot
)
VALUES (
  'f0000001-0000-4000-8000-000000000001',
  'BPC League — Season 1',
  'season-1',
  'blast',
  'bo3',
  12,
  false,
  '{}'::jsonb,
  'Season 1 — BLAST format circuit.',
  '₹50,000',
  '',
  '₹500',
  (CURRENT_DATE + INTERVAL '14 days')::date,
  (CURRENT_DATE + INTERVAL '45 days')::date,
  (CURRENT_DATE + INTERVAL '7 days'),
  '',
  '',
  '',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"displayPodiumCount":2,"mvp":null,"customCards":[]}'::jsonb,
  'tournament',
  false,
  'published',
  true,
  NOW(),
  true,
  100,
  'BPC',
  77,
  '',
  '',
  'a1000000-0000-4000-8000-000000000012',
  NULL,
  '',
  'S1',
  jsonb_strip_nulls(jsonb_build_object(
    'name', 'BPC League — Season 1',
    'slug', 'season-1',
    'format', 'blast',
    'series_type', 'bo3',
    'team_count', 12,
    'description', 'Season 1 — BLAST format circuit.',
    'prize_pool', '₹50,000',
    'entry_fee', '₹500',
    'visibility_mode', 'tournament',
    'registrations_open', true
  ))
);

-- ---------------------------------------------------------------------------
-- 4. Season row — number 1, active, sponsors from current landing config
-- ---------------------------------------------------------------------------
INSERT INTO seasons (
  id,
  number,
  slug,
  theme_key,
  name,
  status,
  tournament_id,
  hero_media,
  trophy_engraving,
  sponsors_config,
  archive_embeds
)
VALUES (
  'f0000001-0000-4000-8000-000000000002',
  1,
  'season-1',
  'emerald',
  'BPC League — Season 1',
  'active',
  'f0000001-0000-4000-8000-000000000001',
  '{}'::jsonb,
  '{}'::jsonb,
  '{
    "section": {
      "eyebrow": "Powered by partners",
      "title": "Sponsors",
      "subtitle": "Brands and communities backing BPC League — thank you for fueling the circuit."
    },
    "sponsors": [
      {
        "id": "sponsor-co-1",
        "name": "WorkInt",
        "tagline": "Co-Sponsor",
        "tier": "co",
        "order": 1,
        "logoUrl": "/images/sponsors/workint.png",
        "socials": {
          "discord": "https://discord.gg/PN4ccCMyC2",
          "instagram": "https://www.instagram.com/workint_/"
        }
      },
      {
        "id": "sponsor-major-1",
        "name": "L!NU$. 4 ^ JpR",
        "tagline": "Sunil Naval",
        "tier": "major",
        "order": 2,
        "logoUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/620/9b150c165611e0f04ac9edb860656d7e67d56fbe.gif",
        "socials": {
          "steam": "https://steamcommunity.com/profiles/76561198034030852",
          "instagram": "https://www.instagram.com/linus_newbie/"
        }
      },
      {
        "id": "sponsor-major-2",
        "name": "RagnaR",
        "tagline": "Mayank Saini",
        "tier": "major",
        "order": 3,
        "logoUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/1091500/d3ca470b90fe64e5203af68b5238e99665b05e2f.gif",
        "socials": {
          "instagram": "https://www.instagram.com/moondiety_1/",
          "steam": "https://steamcommunity.com/id/fireheart1111"
        }
      },
      {
        "id": "sponsor-partner-1",
        "name": "Roronoa Zoro",
        "tagline": "Raj Dodia",
        "tier": "partner",
        "order": 4,
        "logoUrl": "https://avatars.fastly.steamstatic.com/d30daa776ee29ca2630f29bcd22084b1000a65e7_full.jpg",
        "socials": {
          "steam": "https://steamcommunity.com/profiles/76561198338169972"
        }
      },
      {
        "id": "sponsor-partner-2",
        "name": "JaamVant",
        "tagline": "Ashray Jayant",
        "tier": "partner",
        "order": 5,
        "logoUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/546560/35f54268b2e255954d79ebbb6ef5321b0abc0e4c.gif",
        "socials": {
          "steam": "https://steamcommunity.com/profiles/76561198053191862"
        }
      }
    ]
  }'::jsonb,
  '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- 5. Seed 77 player_accounts (registration-ready: email + Steam + Discord)
-- ---------------------------------------------------------------------------
WITH seed_rows AS (
  SELECT
    i,
    gen_random_uuid() AS account_id,
    'BPC-' || LPAD(nextval('bpc_id_seq')::text, 3, '0') AS bpc_id,
    'seed.player' || LPAD(i::text, 2, '0') || '@seed.bpcl.local' AS email,
    'seed-player-' || LPAD(i::text, 2, '0') AS slug,
    'Seed Player ' || i AS display_name,
    'SeedPlayer_' || LPAD(i::text, 2, '0') AS steam_persona,
    '765611989' || LPAD(i::text, 8, '0') AS steam_id,
    'https://steamcommunity.com/id/seedplayer' || LPAD(i::text, 2, '0') AS steam_profile,
    '9000000000000' || LPAD(i::text, 5, '0') AS discord_id,
    'seedplayer' || i AS discord_username,
    CASE (i % 5)
      WHEN 1 THEN '["Carry"]'::jsonb
      WHEN 2 THEN '["Mid"]'::jsonb
      WHEN 3 THEN '["Offlane"]'::jsonb
      WHEN 4 THEN '["Soft support"]'::jsonb
      ELSE '["Hard support"]'::jsonb
    END AS roles,
    3800 + ((i - 1) % 20) * 75 AS mmr
  FROM generate_series(1, 77) AS i
),
inserted_accounts AS (
  INSERT INTO player_accounts (
    id,
    bpc_id,
    email,
    password_hash,
    email_verified_at,
    display_name,
    slug,
    steam_id,
    steam_persona,
    steam_profile,
    discord_id,
    discord_username,
    mmr,
    preferred_roles,
    location,
    profile_completed_at
  )
  SELECT
    account_id,
    bpc_id,
    email,
    NULL,
    NOW(),
    display_name,
    slug,
    steam_id,
    steam_persona,
    steam_profile,
    discord_id,
    discord_username,
    mmr,
    roles,
    'Seed Region',
    NOW()
  FROM seed_rows
  RETURNING id, bpc_id, email
)
INSERT INTO player_registrations (
  id,
  tournament_id,
  player_account_id,
  email,
  name,
  display_name,
  location,
  roles,
  mmr,
  steam_name,
  steam_profile,
  discord_handle,
  phone_number,
  payment_screenshot,
  notes,
  payment_status,
  registration_status,
  registration_flow_stage,
  email_verified_at,
  terms_accepted_at,
  public_code
)
SELECT
  gen_random_uuid(),
  'f0000001-0000-4000-8000-000000000001',
  sr.account_id,
  sr.email,
  sr.display_name,
  sr.steam_persona,
  'Seed Region',
  sr.roles,
  sr.mmr,
  sr.steam_persona,
  sr.steam_profile,
  sr.discord_username,
  '',
  '',
  'Seeded Season 1 registrant (bypassed linkage)',
  'paid',
  'approved',
  'submitted',
  NOW(),
  NOW(),
  sr.bpc_id
FROM seed_rows sr;

-- ---------------------------------------------------------------------------
-- 6. Five demo accounts for you (login only — NOT registered)
--    Password for all: BpclTest123!
--    Linkage + profile are prefilled; server also auto-fills on first login.
-- ---------------------------------------------------------------------------
WITH demo_rows AS (
  SELECT *
  FROM (
    VALUES
      (1, 'f00000d1-0000-4000-8000-000000000001'::uuid, 'Demo Access 1', 'demo-access-01', '["Carry"]'::jsonb, 4200),
      (2, 'f00000d1-0000-4000-8000-000000000002'::uuid, 'Demo Access 2', 'demo-access-02', '["Mid"]'::jsonb, 4350),
      (3, 'f00000d1-0000-4000-8000-000000000003'::uuid, 'Demo Access 3', 'demo-access-03', '["Offlane"]'::jsonb, 4500),
      (4, 'f00000d1-0000-4000-8000-000000000004'::uuid, 'Demo Access 4', 'demo-access-04', '["Soft support"]'::jsonb, 4650),
      (5, 'f00000d1-0000-4000-8000-000000000005'::uuid, 'Demo Access 5', 'demo-access-05', '["Hard support"]'::jsonb, 4800)
  ) AS t(n, id, display_name, slug, roles, mmr)
),
demo_hashes AS (
  SELECT *
  FROM (
    VALUES
      (1, '747f21f98d66aff8116ef6717be7d32e:bb86cddc7da4a6d3543eb49826764420b245cb37fdc5d6d2d58f65173bc38d5ba70e2bc9ded039b1eab6d943584c8bbf6e3ce7c1166e7935c2fe1a230c0fbb97'),
      (2, '5a92e982b30a4b6d0c865da3496d846d:246b1285d3f2ea9c3eeccb7e6e8a3a65175a203602519385ad5819cbd8ec278d8e84b3749bd4093a751d401bdf9750ad7b3e784cda54c3686b85d1439287a889'),
      (3, 'd840ddf59d3b88b8446239322f45df27:a71298d6fedb7ba7485da20aa0276500cee904854d71fe08aa697c5974687fb705fd551b80764205b33093a3ffe0e7a6dcaef035c6a284b57d141cb6b18bcc44'),
      (4, '3abba39ccd7835255ec3f019b3ceeb32:62b627d2a5d3432ef2869de37690cd7d499608f17e5a54bf6d6a95193e0b2333c24d40221855f4552b15cedf154148c56fc0b978ed279904ba9de195f554cd69'),
      (5, 'b7a9319b797f1d83b38158855895a114:53dce361162403f559d0b70a8b59f85bae7b1296f058a7f32e390f774ff4e63c43e70103a5ef57a11af08e9b9dae3f4115470cd3b2c075e47a306f56510de8dc')
  ) AS h(n, password_hash)
)
INSERT INTO player_accounts (
  id,
  bpc_id,
  email,
  password_hash,
  email_verified_at,
  display_name,
  slug,
  steam_id,
  steam_persona,
  steam_profile,
  discord_id,
  discord_username,
  mmr,
  preferred_roles,
  location,
  phone_number,
  profile_completed_at,
  admin_notes
)
SELECT
  d.id,
  'BPC-' || LPAD(nextval('bpc_id_seq')::text, 3, '0'),
  'demo.access' || LPAD(d.n::text, 2, '0') || '@bpcl.test',
  h.password_hash,
  NOW(),
  d.display_name,
  d.slug,
  '7656119899' || LPAD(d.n::text, 7, '0'),
  'DemoSteam_' || d.n,
  'https://steamcommunity.com/id/demo-access-' || LPAD(d.n::text, 2, '0'),
  '9000000000' || (10000 + d.n)::text,
  'demo_discord_' || d.n,
  d.mmr,
  d.roles,
  'Demo City, IN',
  '+91 98765' || LPAD((43200 + d.n)::text, 5, '0'),
  NOW(),
  'Manual test account — not registered. Demo linkage + profile prefilled.'
FROM demo_rows d
JOIN demo_hashes h ON h.n = d.n;

COMMIT;

-- =============================================================================
-- Verification (read-only)
-- =============================================================================

SELECT '--- Preserved accounts (your linked logins) ---' AS section;
SELECT email, bpc_id, display_name, steam_id IS NOT NULL AS steam, discord_id IS NOT NULL AS discord
FROM player_accounts
WHERE id IN (SELECT id FROM player_accounts WHERE email_verified_at IS NOT NULL AND steam_id IS NOT NULL AND discord_id IS NOT NULL)
  AND email NOT LIKE 'seed.player%@seed.bpcl.local'
ORDER BY email;

SELECT '--- Season 1 ---' AS section;
SELECT s.number, s.name, s.status, s.slug, t.status AS tournament_status, t.is_published, t.registrations_open
FROM seasons s
JOIN tournaments t ON t.id = s.tournament_id
WHERE s.number = 1;

SELECT '--- Sponsor count ---' AS section;
SELECT jsonb_array_length(sponsors_config->'sponsors') AS sponsor_count
FROM seasons WHERE number = 1;

SELECT '--- Approved registrations ---' AS section;
SELECT COUNT(*)::int AS approved_count
FROM player_registrations pr
JOIN tournaments t ON t.id = pr.tournament_id
WHERE t.slug = 'season-1'
  AND pr.registration_status = 'approved'
  AND pr.archived_at IS NULL;

SELECT '--- Demo accounts (not registered) ---' AS section;
SELECT pa.email, pa.bpc_id, pa.display_name,
       pa.steam_id IS NOT NULL AS has_steam,
       pa.discord_id IS NOT NULL AS has_discord,
       EXISTS (
         SELECT 1 FROM player_registrations pr
         WHERE pr.player_account_id = pa.id AND pr.archived_at IS NULL
       ) AS is_registered
FROM player_accounts pa
WHERE pa.email LIKE 'demo.access%@bpcl.test'
ORDER BY pa.email;
