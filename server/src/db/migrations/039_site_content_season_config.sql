-- Global public site content + per-season sponsors / archive embeds

CREATE TABLE IF NOT EXISTS public_site_content (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS sponsors_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archive_embeds JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed org roster (migrated from static core team constants)
INSERT INTO public_site_content (key, payload)
VALUES (
  'org_roster',
  '{
    "section": {
      "eyebrow": "Behind the circuit",
      "title": "The people behind BPC"
    },
    "members": [
      { "id": "core-1", "gamerTag": "AddicTzZ", "realName": "Rohit Negi", "role": "Chief Technical Officer", "avatarUrl": "https://avatars.fastly.steamstatic.com/452fe4e6dc20cca18b813015c09905163af9eada_full.jpg", "tier": "founder", "order": 1 },
      { "id": "core-2", "gamerTag": "RagnaR", "realName": "Mayank Saini", "role": "Director of Strategy & Art", "avatarUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/1091500/d3ca470b90fe64e5203af68b5238e99665b05e2f.gif", "tier": "founder", "order": 2 },
      { "id": "core-3", "gamerTag": "Rengoku -M-", "realName": "Anirudh Gupta", "role": "Chief Operating Officer", "avatarUrl": "https://avatars.fastly.steamstatic.com/0d66c1967d928672d2b7f8ff01d706393120ec2c_full.jpg", "tier": "founder", "order": 3 },
      { "id": "core-4", "gamerTag": "Mind_Flay3r", "realName": "Mohit Rathore", "role": "Marketing Director", "avatarUrl": "https://avatars.fastly.steamstatic.com/076800a63f9a5e17d4f40d6fc87db25450434a64_full.jpg", "tier": "admin", "order": 4 },
      { "id": "core-5", "gamerTag": "L!NU$. 4 ^ JpR", "realName": "Sunil Naval", "role": "Senior Designer", "avatarUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/620/9b150c165611e0f04ac9edb860656d7e67d56fbe.gif", "tier": "admin", "order": 5 },
      { "id": "core-6", "gamerTag": "alferno...", "realName": "Krishan K. Yadav", "role": "Strategy Execution Manager", "avatarUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/2055050/c59f1f3beafa934af92b51dcd0521298600239fb.gif", "tier": "admin", "order": 6 },
      { "id": "core-7", "gamerTag": "4Pos5", "realName": "Siddharth Goyal", "role": "Strategy Analyst", "avatarUrl": "https://avatars.fastly.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg", "tier": "admin", "order": 7 },
      { "id": "core-8", "gamerTag": "JaamVant", "realName": "Ashray Jayant", "role": "Risk Manager", "avatarUrl": "https://shared.fastly.steamstatic.com/community_assets/images/items/546560/35f54268b2e255954d79ebbb6ef5321b0abc0e4c.gif", "tier": "admin", "order": 8 },
      { "id": "core-9", "gamerTag": "Agent Chandi", "realName": "Kush Rawat", "role": "Supply Manager", "avatarUrl": "https://avatars.fastly.steamstatic.com/626772a6e57101a76dac9fd9d6bd8789ad66da9a_full.jpg", "tier": "admin", "order": 9 }
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
