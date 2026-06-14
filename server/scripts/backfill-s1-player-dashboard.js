/**
 * Wire Season 1 player data for dashboard history (team + match appearances).
 *
 * Prerequisites: player_accounts exist and player_registrations.player_account_id is set
 * (run migrate-s1-to-player-accounts.js --apply first).
 *
 * Usage (from server/):
 *   node scripts/backfill-s1-player-dashboard.js --check
 *   node scripts/backfill-s1-player-dashboard.js --apply
 *   node scripts/backfill-s1-player-dashboard.js --apply --season-slug=season-1
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { seedMatchLineupsForTournament } from "../src/services/matchLineupService.js";

dotenv.config();

function parseSeasonSlug(argv) {
  const flag = argv.find((a) => a.startsWith("--season-slug="));
  return flag ? flag.split("=")[1] : "season-1";
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

async function linkRosterPlayers(tournamentId) {
  const viaReg = await pool.query(
    `UPDATE roster_snapshot_players rsp
     SET player_account_id = pr.player_account_id
     FROM player_registrations pr
     WHERE rsp.registration_id = pr.id
       AND rsp.roster_snapshot_id IN (
         SELECT id FROM roster_snapshots WHERE tournament_id = $1
       )
       AND rsp.player_account_id IS NULL
       AND pr.player_account_id IS NOT NULL`,
    [tournamentId],
  );

  const viaEmail = await pool.query(
    `UPDATE roster_snapshot_players rsp
     SET player_account_id = pa.id
     FROM player_registrations pr
     JOIN player_accounts pa ON lower(pa.email) = lower(pr.email)
     WHERE rsp.registration_id = pr.id
       AND rsp.roster_snapshot_id IN (
         SELECT id FROM roster_snapshots WHERE tournament_id = $1
       )
       AND rsp.player_account_id IS NULL`,
    [tournamentId],
  );

  return { viaReg: viaReg.rowCount, viaEmail: viaEmail.rowCount };
}

async function backfillProfiles() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (r.player_account_id)
        r.player_account_id, r.mmr, r.roles, r.location
     FROM player_registrations r
     WHERE r.player_account_id IS NOT NULL AND r.archived_at IS NULL
     ORDER BY r.player_account_id, r.created_at DESC`,
  );

  let updated = 0;
  for (const row of rows) {
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const result = await pool.query(
      `UPDATE player_accounts
       SET mmr = COALESCE(mmr, $2),
           preferred_roles = CASE WHEN preferred_roles = '[]'::jsonb THEN $3::jsonb ELSE preferred_roles END,
           location = CASE WHEN location = '' THEN COALESCE($4, '') ELSE location END,
           updated_at = NOW()
       WHERE id = $1`,
      [row.player_account_id, row.mmr, JSON.stringify(roles), row.location || ""],
    );
    updated += result.rowCount;
  }
  return updated;
}

async function diagnose(season) {
  const tournamentId = season.tournament_id;
  const report = { seasonSlug: season.slug, tournamentId, tournamentSlug: season.tournament_slug };

  const { rows: rosterRows } = await pool.query(
    `SELECT id, status, approved_at FROM roster_snapshots
     WHERE tournament_id = $1 ORDER BY status = 'approved' DESC, approved_at DESC NULLS LAST`,
    [tournamentId],
  );
  report.rosterSnapshots = rosterRows;

  const approved = rosterRows.find((r) => r.status === "approved");
  report.approvedRosterId = approved?.id || null;

  const { rows: matchCount } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM matches WHERE tournament_id = $1`,
    [tournamentId],
  );
  report.matchCount = matchCount[0]?.count ?? 0;

  if (approved?.id) {
    const { rows: playerLink } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE player_account_id IS NOT NULL)::int AS linked
       FROM roster_snapshot_players
       WHERE roster_snapshot_id = $1`,
      [approved.id],
    );
    report.rosterPlayers = playerLink[0];

    const { rows: sampleTeams } = await pool.query(
      `SELECT name FROM roster_snapshot_teams WHERE roster_snapshot_id = $1 ORDER BY name LIMIT 5`,
      [approved.id],
    );
    const { rows: sampleMatchTeams } = await pool.query(
      `SELECT DISTINCT team1 AS name FROM matches WHERE tournament_id = $1
       UNION
       SELECT DISTINCT team2 FROM matches WHERE tournament_id = $1
       ORDER BY name LIMIT 5`,
      [tournamentId],
    );
    report.sampleRosterTeamNames = sampleTeams.map((r) => r.name);
    report.sampleMatchTeamNames = sampleMatchTeams.map((r) => r.name);

    const { rows: mismatches } = await pool.query(
      `WITH match_teams AS (
         SELECT DISTINCT trim(team1) AS name FROM matches WHERE tournament_id = $1 AND trim(team1) <> ''
         UNION
         SELECT DISTINCT trim(team2) FROM matches WHERE tournament_id = $1 AND trim(team2) <> ''
       ),
       roster_teams AS (
         SELECT DISTINCT trim(name) AS name FROM roster_snapshot_teams WHERE roster_snapshot_id = $2
       )
       SELECT mt.name AS match_team
       FROM match_teams mt
       LEFT JOIN roster_teams rt ON lower(rt.name) = lower(mt.name)
       WHERE rt.name IS NULL
       ORDER BY mt.name`,
      [tournamentId, approved.id],
    );
    report.unmatchedMatchTeamNames = mismatches.map((r) => r.match_team);
  }

  const { rows: regLink } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE player_account_id IS NOT NULL)::int AS linked
     FROM player_registrations
     WHERE tournament_id = $1 AND archived_at IS NULL`,
    [tournamentId],
  );
  report.registrations = regLink[0];

  const { rows: lineupCount } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM match_lineup_players WHERE tournament_id = $1`,
    [tournamentId],
  );
  report.existingLineupRows = lineupCount[0]?.count ?? 0;

  return report;
}

function printReport(report) {
  console.log("=== S1 player dashboard backfill — check ===");
  console.log(`Season: ${report.seasonSlug} → tournament ${report.tournamentSlug} (${report.tournamentId})`);
  console.log(`Registrations linked: ${report.registrations?.linked ?? 0} / ${report.registrations?.total ?? 0}`);
  console.log(`Roster snapshots: ${report.rosterSnapshots?.length ?? 0}`);
  console.log(`Approved roster: ${report.approvedRosterId || "(none)"}`);
  console.log(`Matches: ${report.matchCount}`);
  if (report.rosterPlayers) {
    console.log(
      `Roster players linked: ${report.rosterPlayers.linked} / ${report.rosterPlayers.total}`,
    );
  }
  console.log(`Existing lineup rows: ${report.existingLineupRows}`);
  if (report.sampleRosterTeamNames?.length) {
    console.log("Sample roster teams:", report.sampleRosterTeamNames.join(", "));
  }
  if (report.sampleMatchTeamNames?.length) {
    console.log("Sample match teams:", report.sampleMatchTeamNames.join(", "));
  }
  if (report.unmatchedMatchTeamNames?.length) {
    console.warn("Match teams with NO roster name match:", report.unmatchedMatchTeamNames.join(", "));
  }

  if (!report.approvedRosterId) {
    console.warn("BLOCKER: No approved roster snapshot for this tournament.");
  } else if (report.matchCount === 0) {
    console.warn("BLOCKER: No matches on this tournament.");
  } else if ((report.rosterPlayers?.linked ?? 0) === 0) {
    const regOk = (report.registrations?.linked ?? 0) > 0;
    if (regOk) {
      console.warn(
        "BLOCKER: Roster players have no player_account_id — registrations are linked; run: node scripts/backfill-s1-player-dashboard.js --apply",
      );
    } else {
      console.warn(
        "BLOCKER: Roster players have no player_account_id — run migrate-s1-to-player-accounts.js --apply first, then backfill-s1-player-dashboard.js --apply",
      );
    }
  } else if (report.unmatchedMatchTeamNames?.length) {
    console.warn("BLOCKER: Team names in matches do not match approved roster team names.");
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const checkOnly = process.argv.includes("--check") || !apply;
  const seasonSlug = parseSeasonSlug(process.argv);

  const season = await getSeasonContext(seasonSlug);
  if (!season) {
    console.error(`Season not found: ${seasonSlug}`);
    process.exit(1);
  }

  if (checkOnly && !process.argv.includes("--apply")) {
    printReport(await diagnose(season));
    await pool.end();
    return;
  }

  console.log("=== S1 player dashboard backfill — apply ===");
  let report = await diagnose(season);
  printReport(report);

  const linked = await linkRosterPlayers(season.tournament_id);
  console.log(`Linked roster players via registration: ${linked.viaReg}, via email fallback: ${linked.viaEmail}`);

  const profiles = await backfillProfiles();
  console.log(`Updated player_accounts profile fields: ${profiles}`);

  report = await diagnose(season);
  const seedResult = await seedMatchLineupsForTournament(season.tournament_id);
  console.log(`Seeded lineup rows: ${seedResult.seeded}`);

  if (seedResult.seeded === 0) {
    printReport(report);
    console.error("Seeding produced 0 rows — see blockers above.");
    process.exit(1);
  }

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
