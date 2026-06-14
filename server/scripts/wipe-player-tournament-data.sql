-- =============================================================================
-- Wipe all player + tournament data (clean slate before prod import)
-- =============================================================================
--
-- REMOVES:
--   tournaments, seasons, teams, bracket players, matches, schedules,
--   registrations, rosters, substitutions, checkouts, player accounts, coins, etc.
--
-- KEEPS:
--   admin_users, admin_sessions, admin_invites, audit_log,
--   engine_templates, public_site_content, schema_migrations
--
-- Run (from server/):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/wipe-player-tournament-data.sql
--
-- After importing data from production, sync the BPC sequence (accounts + registrations):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sync-bpc-id-sequence.sql
--
-- If new Google signups got low BPC IDs (e.g. BPC-002 while S1 has BPC-002), run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/repair-bpc-id-collisions.sql
--
-- Optional — also clear admin audit history:
--   TRUNCATE audit_log;
--
-- Optional — reset CMS keys (org roster, etc.):
--   DELETE FROM public_site_content;
--
-- =============================================================================

BEGIN;

-- Player-side (not removed when tournaments are deleted)
DELETE FROM player_notifications;
DELETE FROM player_claim_tokens;
DELETE FROM player_sessions;
DELETE FROM player_account_links;
DELETE FROM player_card_assets;
DELETE FROM bpc_coin_ledger;

-- Tournament ecosystem (children before parents)
DELETE FROM match_lineup_players;
DELETE FROM substitution_requests;
DELETE FROM roster_snapshot_team_players;
DELETE FROM roster_snapshot_team_memberships;
DELETE FROM roster_snapshot_players;
DELETE FROM roster_snapshot_teams;
DELETE FROM roster_snapshots;
DELETE FROM team_profile_history;
DELETE FROM match_results;
DELETE FROM schedule_slots;
DELETE FROM standings_cache;
DELETE FROM checkout_orders;
DELETE FROM player_registrations;
DELETE FROM season_participations;
DELETE FROM tournament_commerce_config;
DELETE FROM team_players;
DELETE FROM players;
DELETE FROM teams;
DELETE FROM stages;
DELETE FROM matches;
DELETE FROM seasons;
DELETE FROM tournaments;

-- All player accounts last (after registrations / checkouts are gone)
DELETE FROM player_accounts;

-- Payment webhook log (standalone)
DELETE FROM payment_webhooks;

-- Reset BPC ID counter for a fresh import
SELECT setval('bpc_id_seq', 1, false);

COMMIT;

-- Quick sanity check (should all be 0)
SELECT 'player_accounts' AS tbl, COUNT(*)::int AS n FROM player_accounts
UNION ALL SELECT 'tournaments', COUNT(*)::int FROM tournaments
UNION ALL SELECT 'seasons', COUNT(*)::int FROM seasons
UNION ALL SELECT 'player_registrations', COUNT(*)::int FROM player_registrations
UNION ALL SELECT 'admin_users', COUNT(*)::int FROM admin_users;
