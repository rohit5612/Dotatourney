/**
 * One-off: clear registrations, seed 60 test players, 12 teams, save roster snapshot.
 * Run from server/: node scripts/seed-test-roster.js
 */
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { createRosterSnapshot, replaceTeamsAndPlayers } from "../src/services/tournamentRepository.js";

const ROLES = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];
const TEAM_COUNT = 12;
const PLAYERS_PER_TEAM = 5;
const TOTAL_PLAYERS = TEAM_COUNT * PLAYERS_PER_TEAM;
const ROSTER_NAME = "test draft roster";

async function resolveTournamentId(client) {
  const published = await client.query(
    `SELECT id, name FROM tournaments WHERE is_published = TRUE ORDER BY updated_at DESC LIMIT 1`,
  );
  if (published.rows[0]) return published.rows[0];

  const any = await client.query(`SELECT id, name FROM tournaments ORDER BY created_at DESC LIMIT 1`);
  if (!any.rows[0]) {
    throw new Error("No tournament found. Create a tournament in admin first.");
  }
  return any.rows[0];
}

async function main() {
  const client = await pool.connect();
  try {
    const tournament = await resolveTournamentId(client);
    const tournamentId = tournament.id;
    console.log(`Tournament: ${tournament.name} (${tournamentId})`);

    await client.query("BEGIN");

    await client.query("DELETE FROM player_registrations");
    console.log("Cleared all player_registrations.");

    await client.query("DELETE FROM team_players WHERE tournament_id = $1", [tournamentId]);
    await client.query("DELETE FROM players WHERE tournament_id = $1", [tournamentId]);
    await client.query("DELETE FROM teams WHERE tournament_id = $1", [tournamentId]);
    console.log("Cleared working teams/players for tournament.");

    const registrationIds = [];
    for (let i = 1; i <= TOTAL_PLAYERS; i += 1) {
      const id = randomUUID();
      const role = ROLES[(i - 1) % ROLES.length];
      const publicCode = `BPC-${String(i).padStart(3, "0")}`;
      const email = `test.player${String(i).padStart(2, "0")}@seed.bpcl.local`;
      await client.query(
        `INSERT INTO player_registrations (
          id, tournament_id, email, name, location, roles, mmr, steam_name, steam_profile,
          discord_handle, phone_number, payment_screenshot, notes, payment_status, registration_status,
          registration_flow_stage, email_verified_at, terms_accepted_at, public_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'paid', 'approved', 'submitted', NOW(), NOW(), $14)`,
        [
          id,
          tournamentId,
          email,
          `Test Player ${i}`,
          "Seed City",
          JSON.stringify([role]),
          4000 + (i % 15) * 100,
          `steam_test_${i}`,
          `https://steamcommunity.com/id/test${i}`,
          `testplayer${i}`,
          "",
          "",
          "Seeded test registration",
          publicCode,
        ],
      );
      registrationIds.push({ id, role, index: i });
    }
    console.log(`Inserted ${TOTAL_PLAYERS} test registrations (paid + approved).`);

    await client.query("COMMIT");

    const teams = [];
    const players = [];
    for (let t = 0; t < TEAM_COUNT; t += 1) {
      const teamId = randomUUID();
      const teamNum = t + 1;
      teams.push({
        id: teamId,
        name: `Test Team ${teamNum}`,
        captain: "",
        abbr: `T${teamNum}`,
        seed: teamNum,
      });

      for (let p = 0; p < PLAYERS_PER_TEAM; p += 1) {
        const reg = registrationIds[t * PLAYERS_PER_TEAM + p];
        const playerId = randomUUID();
        const isCaptain = p === 0;
        players.push({
          id: playerId,
          teamId,
          registrationId: reg.id,
          name: `Test Player ${reg.index}`,
          role: reg.role,
          roles: [reg.role],
          mmr: 4000 + (reg.index % 15) * 100,
          steamName: `steam_test_${reg.index}`,
          steamProfile: `https://steamcommunity.com/id/test${reg.index}`,
          discordHandle: `testplayer${reg.index}`,
          location: "Seed City",
          isCaptain,
        });
        if (isCaptain) {
          teams[t].captain = `Test Player ${reg.index}`;
        }
      }
    }

    const teamPlayers = players
      .filter((player) => player.teamId)
      .map((player) => ({
        id: randomUUID(),
        teamId: player.teamId,
        playerId: player.id,
      }));

    await replaceTeamsAndPlayers(tournamentId, teams, players, teamPlayers);
    console.log(`Saved ${TEAM_COUNT} teams with ${PLAYERS_PER_TEAM} players each.`);

    const roster = await createRosterSnapshot(tournamentId, ROSTER_NAME);
    console.log(`Created roster snapshot "${roster.name}" (${roster.id}, status: ${roster.status}).`);
    console.log("Done.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
