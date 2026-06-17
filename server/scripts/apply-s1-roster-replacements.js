/**
 * Season 1 permanent roster replacements + historical match lineups.
 *
 * Validates and (optionally) applies custom match-history data for S1 player
 * replacements before or during the tournament.
 *
 * Usage (from server/):
 *   node scripts/apply-s1-roster-replacements.js --check
 *   node scripts/apply-s1-roster-replacements.js --apply
 *   node scripts/apply-s1-roster-replacements.js --check --season-slug=season-1
 */
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { buildPublicMatchHistory } from "../src/services/playerRecognitionService.js";
import { loadActiveTeamPlayersByName } from "../src/services/rosterMembershipService.js";

dotenv.config();

const REPLACEMENTS = [
  {
    id: "invictus-shanks-sj",
    team: "Invictus",
    outgoing: ["shanks"],
    incoming: ["sj"],
    beforeAllMatches: true,
    expectedOutgoingMatches: 0,
  },
  {
    id: "emberfall-skyzard-shiro",
    team: "Emberfall",
    outgoing: ["skyzard"],
    incoming: ["shiro"],
    beforeAllMatches: true,
    expectedOutgoingMatches: 0,
  },
  {
    id: "phantom-888-demon",
    team: "Phantom Division",
    outgoing: ["888"],
    incoming: ["demon!"],
    outgoingMatches: [
      { stageKey: "blast-group-a", roundIndex: 0, matchIndex: 1, opponent: "Chaos Rift" },
      { stageKey: "blast-group-a", roundIndex: 1, matchIndex: 2, opponent: "Ashborn" },
    ],
    expectedOutgoingMatches: 2,
  },
  {
    id: "ashborn-miyamc-lucky13",
    team: "Ashborn",
    outgoing: ["miyamc"],
    incoming: ["mym | lucky13", "lucky13"],
    outgoingMatches: [
      { stageKey: "blast-group-a", roundIndex: 1, matchIndex: 2, opponent: "Phantom Division" },
      { stageKey: "blast-group-a", roundIndex: 2, matchIndex: 1, opponent: "Chaos Rift" },
    ],
    expectedOutgoingMatches: 2,
  },
  {
    id: "emberfall-dynamodon-raiden",
    team: "Emberfall",
    outgoing: ["dynamodon"],
    incoming: ["raiden"],
    outgoingMatches: [
      { stageKey: "blast-group-b", roundIndex: 0, matchIndex: 1, opponent: "Obsidian Core" },
      { stageKey: "blast-group-b", roundIndex: 1, matchIndex: 2, opponent: "Mortal Oath" },
    ],
    expectedOutgoingMatches: 2,
  },
];

function parseSeasonSlug(argv) {
  const flag = argv.find((a) => a.startsWith("--season-slug="));
  return flag ? flag.split("=")[1] : "season-1";
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function nameMatches(displayName, aliases) {
  const n = normalizeName(displayName);
  return aliases.some((alias) => {
    const a = normalizeName(alias);
    return n === a || n.includes(a) || a.includes(n);
  });
}

function isMatchCompleted(status, scheduleStatus, winner) {
  if (winner && String(winner).trim()) return true;
  const s = String(status || "").toLowerCase();
  const ss = String(scheduleStatus || "").toLowerCase();
  return ["completed", "done", "finished"].includes(s) || ss === "finished";
}

function matchSpecMatches(match, spec, teamName) {
  if (match.stage_key !== spec.stageKey) return false;
  if (Number(match.round_index) !== Number(spec.roundIndex)) return false;
  if (Number(match.match_index) !== Number(spec.matchIndex)) return false;
  if (!spec.opponent) return true;
  const team = normalizeName(teamName);
  const opp = normalizeName(spec.opponent);
  const t1 = normalizeName(match.team1);
  const t2 = normalizeName(match.team2);
  return (t1 === team && t2 === opp) || (t2 === team && t1 === opp);
}

function outgoingPlaysMatch(rule, match, teamName) {
  if (rule.beforeAllMatches) return false;
  return (rule.outgoingMatches || []).some((spec) => matchSpecMatches(match, spec, teamName));
}

async function getSeasonContext(seasonSlug) {
  const { rows } = await pool.query(
    `SELECT s.id AS season_id, s.slug, s.tournament_id, t.slug AS tournament_slug, t.name AS tournament_name
     FROM seasons s
     JOIN tournaments t ON t.id = s.tournament_id
     WHERE s.slug = $1`,
    [seasonSlug],
  );
  return rows[0] || null;
}

async function loadApprovedRoster(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, approved_at FROM roster_snapshots
     WHERE tournament_id = $1 AND status = 'approved'
     ORDER BY approved_at DESC NULLS LAST
     LIMIT 1`,
    [tournamentId],
  );
  return rows[0] || null;
}

async function resolveRosterPlayer(rosterId, teamName, aliases) {
  const { rows } = await pool.query(
    `SELECT DISTINCT rsp.id, rsp.display_name, rsp.name, rsp.role, rsp.roles, rsp.mmr, rsp.player_account_id
     FROM roster_snapshot_players rsp
     LEFT JOIN roster_snapshot_team_players rstp
       ON rstp.player_id = rsp.id AND rstp.roster_snapshot_id = rsp.roster_snapshot_id
     LEFT JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     LEFT JOIN roster_snapshot_team_memberships rstm
       ON rstm.snapshot_player_id = rsp.id AND rstm.roster_snapshot_id = rsp.roster_snapshot_id
     LEFT JOIN roster_snapshot_teams rst2 ON rst2.id = rstm.snapshot_team_id
     WHERE rsp.roster_snapshot_id = $1
       AND (
         lower(rst.name) = lower($2)
         OR lower(rst2.name) = lower($2)
       )`,
    [rosterId, teamName],
  );
  return rows.find((row) => nameMatches(row.display_name || row.name, aliases)) || null;
}

async function captureHistoricalBaselines(rosterId, playerMap) {
  const teams = [...new Set(REPLACEMENTS.map((rule) => rule.team))];
  const map = new Map();
  for (const team of teams) {
    const teamKey = normalizeName(team);
    let players = await loadBaselineTeamPlayers(rosterId, team);

    for (const { rule, outgoing, incoming } of playerMap.values()) {
      if (normalizeName(rule.team) !== teamKey || !outgoing || !incoming) continue;
      const hasOutgoing = players.some((p) => p.id === outgoing.id);
      const hasIncoming = players.some((p) => p.id === incoming.id);
      if (!hasOutgoing && hasIncoming) {
        players = players.map((p) => (p.id === incoming.id ? outgoing : p));
      } else if (!hasOutgoing && !hasIncoming) {
        players = [...players, outgoing];
      }
    }

    map.set(teamKey, players.slice(0, 5));
  }
  return map;
}

async function loadBaselineTeamPlayers(rosterId, teamName) {
  const { rows } = await pool.query(
    `SELECT rsp.id, rsp.display_name, rsp.name, rsp.role, rsp.roles, rsp.mmr, rsp.player_account_id
     FROM roster_snapshot_players rsp
     JOIN roster_snapshot_team_players rstp ON rstp.player_id = rsp.id
     JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     WHERE rsp.roster_snapshot_id = $1
       AND lower(rst.name) = lower($2)
     ORDER BY rsp.is_captain DESC, rsp.display_name ASC NULLS LAST, rsp.name ASC`,
    [rosterId, teamName],
  );
  return rows;
}

async function loadCompletedMatches(tournamentId) {
  const { rows } = await pool.query(
    `SELECT m.id, m.team1, m.team2, m.stage_key, m.round_index, m.match_index, m.status, m.winner,
            ss.status AS schedule_status
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.tournament_id = $1
     ORDER BY m.stage_key, m.round_index, m.match_index`,
    [tournamentId],
  );
  return rows.filter((row) => isMatchCompleted(row.status, row.schedule_status, row.winner));
}

async function countTeamCompletedMatches(tournamentId, teamName) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM matches
     WHERE tournament_id = $1
       AND winner IS NOT NULL AND TRIM(winner) <> ''
       AND (lower(team1) = lower($2) OR lower(team2) = lower($2))`,
    [tournamentId, teamName],
  );
  return rows[0]?.count ?? 0;
}

function resolveTeamPlayersForMatch(baselinePlayers, teamRules, match, teamName, playerMap) {
  let players = [...baselinePlayers];

  for (const rule of teamRules) {
    const mapped = playerMap.get(rule.id);
    if (!mapped?.outgoing || !mapped?.incoming) continue;

    const outIdx = players.findIndex((p) => p.id === mapped.outgoing.id);
    if (outIdx < 0) continue;

    const useOutgoing = rule.beforeAllMatches ? false : outgoingPlaysMatch(rule, match, teamName);
    players[outIdx] = useOutgoing ? mapped.outgoing : mapped.incoming;
  }

  const seen = new Set();
  players = players.filter((p) => {
    if (!p.player_account_id || seen.has(p.player_account_id)) return false;
    seen.add(p.player_account_id);
    return true;
  });

  return players.slice(0, 5);
}

async function buildReplacementPlayerMap(rosterId) {
  const map = new Map();
  for (const rule of REPLACEMENTS) {
    const outgoing = await resolveRosterPlayer(rosterId, rule.team, rule.outgoing);
    const incoming = await resolveRosterPlayer(rosterId, rule.team, rule.incoming);
    map.set(rule.id, { rule, outgoing, incoming });
  }
  return map;
}

async function validateReplacementCases(ctx, rosterId) {
  const playerMap = await buildReplacementPlayerMap(rosterId);
  const results = [];

  for (const [id, { rule, outgoing, incoming }] of playerMap) {
    const teamMatches = await countTeamCompletedMatches(ctx.tournament_id, rule.team);
    const issues = [];

    if (!outgoing) issues.push(`outgoing player not found (${rule.outgoing.join(", ")})`);
    if (!incoming) issues.push(`incoming player not found (${rule.incoming.join(", ")})`);

    let outgoingCount = null;
    let incomingCount = null;

    if (outgoing?.player_account_id) {
      const history = await buildPublicMatchHistory(outgoing.player_account_id);
      outgoingCount = history.filter(
        (row) =>
          normalizeName(row.teamName) === normalizeName(rule.team) &&
          !row.playedAsSub &&
          !row.wasReplaced,
      ).length;
    }

    if (incoming?.player_account_id) {
      const history = await buildPublicMatchHistory(incoming.player_account_id);
      incomingCount = history.filter(
        (row) =>
          normalizeName(row.teamName) === normalizeName(rule.team) &&
          !row.playedAsSub &&
          !row.wasReplaced,
      ).length;
    }

    const expectedIncoming =
      rule.expectedIncomingMatches ??
      (rule.beforeAllMatches ? teamMatches : teamMatches - (rule.expectedOutgoingMatches ?? 0));

    if (rule.expectedOutgoingMatches != null && outgoingCount !== rule.expectedOutgoingMatches) {
      issues.push(`outgoing expected ${rule.expectedOutgoingMatches} matches, got ${outgoingCount ?? "?"}`);
    }
    if (incomingCount !== expectedIncoming) {
      issues.push(`incoming expected ${expectedIncoming} matches, got ${incomingCount ?? "?"}`);
    }

    results.push({
      id,
      team: rule.team,
      outgoing: outgoing?.display_name || outgoing?.name || "?",
      incoming: incoming?.display_name || incoming?.name || "?",
      teamMatches,
      outgoingCount,
      incomingCount,
      expectedIncoming,
      ok: issues.length === 0,
      issues,
    });
  }

  return results;
}

function printValidationReport(results) {
  console.log("=== S1 roster replacements — validation ===");
  let allOk = true;
  for (const row of results) {
    const status = row.ok ? "OK" : "FAIL";
    if (!row.ok) allOk = false;
    console.log(
      `[${status}] ${row.team}: ${row.outgoing} → ${row.incoming} | outgoing ${row.outgoingCount ?? "?"} / incoming ${row.incomingCount ?? "?"} (expected incoming ${row.expectedIncoming}, team total ${row.teamMatches})`,
    );
    for (const issue of row.issues) {
      console.log(`       · ${issue}`);
    }
  }
  console.log(allOk ? "\nAll replacement cases passed." : "\nSome cases failed — run with --apply to fix lineups.");
  return allOk;
}

async function syncMembershipDates(client, rosterId, tournamentId, playerMap) {
  for (const { rule, outgoing, incoming } of playerMap.values()) {
    if (!outgoing?.player_account_id || !incoming?.player_account_id) continue;

    const { rows: teamRows } = await client.query(
      `SELECT id FROM roster_snapshot_teams
       WHERE roster_snapshot_id = $1 AND lower(name) = lower($2)`,
      [rosterId, rule.team],
    );
    const teamId = teamRows[0]?.id;
    if (!teamId) continue;

    const matchTimes = async (accountId) => {
      const { rows } = await client.query(
        `SELECT COALESCE(ss.start_at, m.created_at) AS played_at
         FROM match_lineup_players mlp
         JOIN matches m ON m.id = mlp.match_id
         LEFT JOIN schedule_slots ss ON ss.match_id = m.id
         WHERE mlp.player_account_id = $1
           AND m.tournament_id = $2
           AND lower(mlp.team_name) = lower($3)
           AND mlp.is_substitute = FALSE
           AND m.winner IS NOT NULL AND TRIM(m.winner) <> ''
         ORDER BY played_at ASC NULLS LAST`,
        [accountId, tournamentId, rule.team],
      );
      return rows.map((r) => r.played_at).filter(Boolean);
    };

    const outgoingTimes = await matchTimes(outgoing.player_account_id);
    const incomingTimes = await matchTimes(incoming.player_account_id);

    if (rule.beforeAllMatches) {
      const { rows: rosterMeta } = await client.query(
        `SELECT approved_at FROM roster_snapshots WHERE id = $1`,
        [rosterId],
      );
      const startedAt = rosterMeta[0]?.approved_at || incomingTimes[0] || new Date();
      await client.query(
        `UPDATE roster_snapshot_team_memberships
         SET started_at = $4, ended_at = NULL
         WHERE roster_snapshot_id = $1 AND snapshot_team_id = $2 AND snapshot_player_id = $3`,
        [rosterId, teamId, incoming.id, startedAt],
      );
      await client.query(
        `UPDATE roster_snapshot_team_memberships
         SET ended_at = $4
         WHERE roster_snapshot_id = $1 AND snapshot_team_id = $2 AND snapshot_player_id = $3`,
        [rosterId, teamId, outgoing.id, startedAt],
      );
      continue;
    }

    if (outgoingTimes.length) {
      await client.query(
        `UPDATE roster_snapshot_team_memberships
         SET started_at = COALESCE(started_at, $4), ended_at = $5
         WHERE roster_snapshot_id = $1 AND snapshot_team_id = $2 AND snapshot_player_id = $3`,
        [rosterId, teamId, outgoing.id, outgoingTimes[0], outgoingTimes[outgoingTimes.length - 1]],
      );
    }

    if (incomingTimes.length) {
      await client.query(
        `UPDATE roster_snapshot_team_memberships
         SET started_at = $4, ended_at = NULL
         WHERE roster_snapshot_id = $1 AND snapshot_team_id = $2 AND snapshot_player_id = $3`,
        [rosterId, teamId, incoming.id, incomingTimes[0]],
      );
    }
  }
}

async function syncMemberships(client, rosterId, tournamentId, playerMap) {
  for (const { rule, outgoing, incoming } of playerMap.values()) {
    if (!outgoing || !incoming) continue;

    const { rows: teamRows } = await client.query(
      `SELECT id FROM roster_snapshot_teams
       WHERE roster_snapshot_id = $1 AND lower(name) = lower($2)`,
      [rosterId, rule.team],
    );
    const teamId = teamRows[0]?.id;
    if (!teamId) continue;

    await client.query(
      `UPDATE roster_snapshot_team_memberships
       SET status = 'inactive', ended_at = COALESCE(ended_at, NOW())
       WHERE roster_snapshot_id = $1
         AND snapshot_team_id = $2
         AND snapshot_player_id = $3
         AND status = 'active'`,
      [rosterId, teamId, outgoing.id],
    );

    const { rows: activeIncoming } = await client.query(
      `SELECT id FROM roster_snapshot_team_memberships
       WHERE roster_snapshot_id = $1
         AND snapshot_player_id = $2
         AND status = 'active'`,
      [rosterId, incoming.id],
    );

    if (!activeIncoming.length) {
      await client.query(
        `INSERT INTO roster_snapshot_team_memberships (
          id, roster_snapshot_id, tournament_id, snapshot_team_id, snapshot_player_id, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')`,
        [randomUUID(), rosterId, tournamentId, teamId, incoming.id],
      );
    }

    const { rows: inactiveOutgoing } = await client.query(
      `SELECT id FROM roster_snapshot_team_memberships
       WHERE roster_snapshot_id = $1 AND snapshot_player_id = $2`,
      [rosterId, outgoing.id],
    );
    if (!inactiveOutgoing.length) {
      await client.query(
        `INSERT INTO roster_snapshot_team_memberships (
          id, roster_snapshot_id, tournament_id, snapshot_team_id, snapshot_player_id, status, ended_at
        ) VALUES ($1, $2, $3, $4, $5, 'inactive', NOW())`,
        [randomUUID(), rosterId, tournamentId, teamId, outgoing.id],
      );
    }
  }
}

async function syncBaselineTeamPlayers(client, rosterId, playerMap) {
  for (const { rule, outgoing, incoming } of playerMap.values()) {
    if (!outgoing || !incoming) continue;

    const { rows: teamRows } = await client.query(
      `SELECT id FROM roster_snapshot_teams
       WHERE roster_snapshot_id = $1 AND lower(name) = lower($2)`,
      [rosterId, rule.team],
    );
    const teamId = teamRows[0]?.id;
    if (!teamId) continue;

    await client.query(
      `DELETE FROM roster_snapshot_team_players
       WHERE roster_snapshot_id = $1 AND team_id = $2 AND player_id = $3`,
      [rosterId, teamId, outgoing.id],
    );

    await client.query(
      `INSERT INTO roster_snapshot_team_players (id, roster_snapshot_id, tournament_id, team_id, player_id)
       VALUES ($1, $2, (SELECT tournament_id FROM roster_snapshots WHERE id = $2), $3, $4)
       ON CONFLICT (roster_snapshot_id, team_id, player_id) DO NOTHING`,
      [randomUUID(), rosterId, teamId, incoming.id],
    );
  }
}

async function rebuildCompletedLineups(client, ctx, rosterId, historicalBaselines) {
  const matches = await loadCompletedMatches(ctx.tournament_id);
  const rulesByTeam = new Map();
  for (const rule of REPLACEMENTS) {
    if (!rulesByTeam.has(normalizeName(rule.team))) rulesByTeam.set(normalizeName(rule.team), []);
    rulesByTeam.get(normalizeName(rule.team)).push(rule);
  }

  const replacementMap = await buildReplacementPlayerMap(rosterId);

  let inserted = 0;

  for (const match of matches) {
    for (const teamName of [match.team1, match.team2]) {
      if (!teamName?.trim()) continue;

      const teamKey = normalizeName(teamName);
      const teamRules = rulesByTeam.get(teamKey) || [];

      let players;
      if (teamRules.length) {
        const baseline = historicalBaselines.get(teamKey) || (await loadBaselineTeamPlayers(rosterId, teamName));
        players = resolveTeamPlayersForMatch(baseline, teamRules, match, teamName, replacementMap);
      } else {
        players = await loadActiveTeamPlayersByName(rosterId, teamName, client);
      }

      await client.query(
        `DELETE FROM match_lineup_players
         WHERE match_id = $1 AND lower(team_name) = lower($2) AND is_substitute = FALSE`,
        [match.id, teamName],
      );

      let slotIndex = 0;
      for (const player of players) {
        if (!player.player_account_id) continue;
        await client.query(
          `INSERT INTO match_lineup_players (
            id, match_id, tournament_id, team_name, player_account_id, display_name, roles, mmr,
            is_substitute, slot_index
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)
          ON CONFLICT (match_id, team_name, player_account_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            roles = EXCLUDED.roles,
            mmr = EXCLUDED.mmr,
            slot_index = EXCLUDED.slot_index,
            is_substitute = FALSE,
            replaces_player_account_id = NULL,
            updated_at = NOW()
          WHERE match_lineup_players.is_substitute = FALSE`,
          [
            randomUUID(),
            match.id,
            ctx.tournament_id,
            teamName,
            player.player_account_id,
            player.display_name || player.name || "Player",
            JSON.stringify(Array.isArray(player.roles) ? player.roles : []),
            player.mmr ?? null,
            slotIndex++,
          ],
        );
        inserted += 1;
      }
    }
  }

  return { matches: matches.length, inserted };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const seasonSlug = parseSeasonSlug(process.argv);

  const ctx = await getSeasonContext(seasonSlug);
  if (!ctx) {
    console.error(`Season not found: ${seasonSlug}`);
    process.exit(1);
  }

  const roster = await loadApprovedRoster(ctx.tournament_id);
  if (!roster) {
    console.error("No approved roster snapshot for this tournament.");
    process.exit(1);
  }

  console.log(`Season: ${ctx.slug} → ${ctx.tournament_name} (${ctx.tournament_id})`);
  console.log(`Approved roster: ${roster.id}`);

  if (!apply) {
    const results = await validateReplacementCases(ctx, roster.id);
    const ok = printValidationReport(results);
    await pool.end();
    process.exit(ok ? 0 : 1);
  }

  console.log("\n=== S1 roster replacements — apply ===");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const playerMap = await buildReplacementPlayerMap(roster.id);

    for (const { rule, outgoing, incoming } of playerMap.values()) {
      if (!outgoing || !incoming) {
        throw new Error(
          `Missing roster player for ${rule.id}: outgoing=${outgoing?.display_name || "?"} incoming=${incoming?.display_name || "?"}`,
        );
      }
    }

    const historicalBaselines = await captureHistoricalBaselines(roster.id, playerMap);
    await syncMemberships(client, roster.id, ctx.tournament_id, playerMap);
    const seed = await rebuildCompletedLineups(client, ctx, roster.id, historicalBaselines);
    await syncMembershipDates(client, roster.id, ctx.tournament_id, playerMap);
    await syncBaselineTeamPlayers(client, roster.id, playerMap);

    await client.query("COMMIT");
    console.log(`Rebuilt lineups for ${seed.matches} completed matches (${seed.inserted} starter rows).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const results = await validateReplacementCases(ctx, roster.id);
  const ok = printValidationReport(results);
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
