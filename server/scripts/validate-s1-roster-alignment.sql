-- Read-only validation queries for Season 1 roster / lineup / honors alignment.
-- Run after manual DB edits. Does not modify data.

-- 1) Active memberships per team (should be 5 per team on concluded season)
SELECT rst.name AS team_name,
       COUNT(*) FILTER (WHERE rstm.status = 'active') AS active_count,
       COUNT(*) FILTER (WHERE rstm.status = 'inactive') AS inactive_count
FROM roster_snapshot_team_memberships rstm
JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
JOIN roster_snapshots rs ON rs.id = rstm.roster_snapshot_id AND rs.status = 'approved'
JOIN tournaments t ON t.id = rs.tournament_id
JOIN seasons s ON s.tournament_id = t.id AND s.status = 'concluded'
GROUP BY rst.name
ORDER BY rst.name;

-- 2) Baseline team_players vs active memberships mismatch (players on baseline but not active)
SELECT rst.name AS team_name,
       rsp.display_name,
       pa.bpc_id,
       'on_baseline_not_active' AS issue
FROM roster_snapshot_team_players rstp
JOIN roster_snapshot_players rsp ON rsp.id = rstp.player_id
JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
JOIN roster_snapshots rs ON rs.id = rstp.roster_snapshot_id AND rs.status = 'approved'
LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
LEFT JOIN roster_snapshot_team_memberships rstm
  ON rstm.roster_snapshot_id = rs.id
 AND rstm.snapshot_team_id = rst.id
 AND rstm.snapshot_player_id = rsp.id
 AND rstm.status = 'active'
WHERE rstm.id IS NULL
  AND EXISTS (SELECT 1 FROM roster_snapshot_team_memberships x WHERE x.roster_snapshot_id = rs.id)
ORDER BY rst.name, rsp.display_name;

-- 3) Active membership but missing from baseline team_players
SELECT rst.name AS team_name,
       rsp.display_name,
       pa.bpc_id,
       'active_not_on_baseline' AS issue
FROM roster_snapshot_team_memberships rstm
JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
JOIN roster_snapshots rs ON rs.id = rstm.roster_snapshot_id AND rs.status = 'approved'
LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
LEFT JOIN roster_snapshot_team_players rstp
  ON rstp.roster_snapshot_id = rs.id
 AND rstp.team_id = rst.id
 AND rstp.player_id = rsp.id
WHERE rstm.status = 'active'
  AND rstp.id IS NULL
ORDER BY rst.name, rsp.display_name;

-- 4) Inactive members with zero completed match appearances (expected for replaced-before-playing)
SELECT pa.bpc_id,
       pa.display_name,
       rst.name AS team_name,
       rstm.started_at,
       rstm.ended_at,
       COUNT(DISTINCT mlp.match_id) FILTER (
         WHERE mlp.is_substitute = FALSE
           AND (
             lower(COALESCE(m.status, '')) IN ('completed', 'done', 'finished')
             OR m.winner IS NOT NULL AND TRIM(m.winner) <> ''
           )
       ) AS completed_matches
FROM roster_snapshot_team_memberships rstm
JOIN roster_snapshot_players rsp ON rsp.id = rstm.snapshot_player_id
JOIN roster_snapshot_teams rst ON rst.id = rstm.snapshot_team_id
JOIN roster_snapshots rs ON rs.id = rstm.roster_snapshot_id
JOIN player_accounts pa ON pa.id = rsp.player_account_id
LEFT JOIN match_lineup_players mlp
  ON mlp.player_account_id = pa.id
 AND lower(mlp.team_name) = lower(rst.name)
LEFT JOIN matches m ON m.id = mlp.match_id AND m.tournament_id = rs.tournament_id
WHERE rstm.status = 'inactive'
GROUP BY pa.bpc_id, pa.display_name, rst.name, rstm.started_at, rstm.ended_at
ORDER BY rst.name, pa.display_name;

-- 5) Substitute appearances (should reflect in player history)
SELECT pa.bpc_id,
       pa.display_name,
       m.team1,
       m.team2,
       mlp.team_name AS sub_for_team,
       mlp.is_substitute,
       ss.start_at
FROM match_lineup_players mlp
JOIN player_accounts pa ON pa.id = mlp.player_account_id
JOIN matches m ON m.id = mlp.match_id
LEFT JOIN schedule_slots ss ON ss.match_id = m.id
WHERE mlp.is_substitute = TRUE
ORDER BY ss.start_at DESC NULLS LAST;

-- 6) MVP / champion honors vs active roster account IDs
WITH concluded AS (
  SELECT t.id AS tournament_id,
         t.tournament_honors,
         s.number AS season_number
  FROM seasons s
  JOIN tournaments t ON t.id = s.tournament_id
  WHERE s.status = 'concluded'
)
SELECT c.season_number,
       c.tournament_honors->'mvp'->>'playerName' AS mvp_name,
       c.tournament_honors->'mvp'->>'teamName' AS mvp_team,
       c.tournament_honors->'mvp'->>'playerId' AS mvp_snapshot_player_id,
       rsp.player_account_id AS mvp_account_id,
       pa.bpc_id AS mvp_bpc_id
FROM concluded c
LEFT JOIN roster_snapshots rs ON rs.tournament_id = c.tournament_id AND rs.status = 'approved'
LEFT JOIN roster_snapshot_players rsp ON rsp.id::text = c.tournament_honors->'mvp'->>'playerId'
LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id;
