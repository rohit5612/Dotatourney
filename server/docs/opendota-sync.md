# OpenDota sync (amateur league / BPCL)

Player profiles read **cached** OpenDota data from Postgres. Public page views do not call OpenDota.

## Setup

1. Set `dota_league_id` on the tournament in **Admin → Setup** (Valve in-house league ID).
2. Optional: `OPENDOTA_API_KEY` in server `.env` for higher rate limits.

## Scripts

```bash
cd server
npm run migrate

# Profile + heroes + verified league stats (cache-first; finishes in seconds)
node scripts/sync-opendota-player.js --slug player-slug

# League index from roster + auto-link BPC matches (slow — many OpenDota calls; run after match days)
node scripts/sync-opendota-tournament.js --tournament season-2

# All Steam-linked accounts + both league tournaments (skips rows already in DB)
node scripts/sync-opendota-community.js

# Same run, export new fetches to CSV for prod import (no OpenDota table writes)
node scripts/sync-opendota-community.js --tocsv ./opendota-export

# Prod: after migrate, import the bundle
node scripts/import-opendota-csv.js --dir ./opendota-export
```

## Admin API

`POST /api/tournaments/:id/opendota/sync` (requires `setup.update`)

Body: `{ "linkMatches": true }`

## Community bulk + CSV migration

`sync-opendota-community.js` processes every `player_accounts` row with a non-empty `steam_id` (email does not matter). It:

1. Runs tournament league index + BPC match linking for each tournament that has `dota_league_id`.
2. For each player, syncs global profile/heroes if missing or expired (queries DB before calling OpenDota).
3. For each league tied to the player (lineup, registration, or `season_participations`), syncs league data or only rebuilds stats from cache.

`--tocsv <dir>` buffers **new** OpenDota rows to three CSV files plus `manifest.json` (see `src/services/opendotaCsv.js`). Existing prod data can stay in place; import upserts by primary key.

## Amateur leagues

League pages on OpenDota may be sparse. The `league_id` query often returns the **same** recent games for every league — stats are filtered by real `leagueid` from `opendota_match_cache` (filled by tournament sync) or a **small capped** number of live match lookups (`OPENDOTA_MAX_MATCH_DETAIL_FETCHES`, default 20).

**If player sync “hangs”:** an older version verified up to 200 matches × 1 HTTP call each. Pull latest code, Ctrl+C the job, re-run `sync-opendota-player.js`.
Dotabuff is a good manual check; links are shown on profiles when data exists.

## Match linking

- Auto: roster steam32 overlap + schedule time → `matches.meta.dotaMatchIds`
- Manual: `PATCH /api/tournaments/:id/matches/:matchId` with `{ "dotaMatchIds": [123] }`
