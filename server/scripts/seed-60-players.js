/**
 * Seed 60 approved test registrations with varied role counts.
 * At least 50% (30+) have 3 or more roles; the rest have 1–2 roles.
 *
 * Run from server/: node scripts/seed-60-players.js
 */
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";

const ROLES = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];
const TOTAL_PLAYERS = 60;
const MULTI_ROLE_MIN = 3;
const MULTI_ROLE_COUNT = 30;

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickRoles(count) {
  return shuffle(ROLES).slice(0, Math.max(1, Math.min(count, ROLES.length)));
}

function buildRolePlan() {
  const plan = [];
  for (let i = 0; i < MULTI_ROLE_COUNT; i += 1) {
    plan.push(pickRoles(MULTI_ROLE_MIN + (i % (ROLES.length - MULTI_ROLE_MIN + 1))));
  }
  for (let i = MULTI_ROLE_COUNT; i < TOTAL_PLAYERS; i += 1) {
    plan.push(pickRoles(1 + (i % 2)));
  }
  return shuffle(plan);
}

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

async function clearPlayerData(client, tournamentId) {
  await client.query("DELETE FROM roster_snapshot_team_players");
  await client.query("DELETE FROM roster_snapshot_players");
  await client.query("DELETE FROM roster_snapshot_teams");
  await client.query("DELETE FROM roster_snapshots");
  await client.query("DELETE FROM team_players WHERE tournament_id = $1", [tournamentId]);
  await client.query("DELETE FROM players WHERE tournament_id = $1", [tournamentId]);
  await client.query("DELETE FROM teams WHERE tournament_id = $1", [tournamentId]);
  await client.query("DELETE FROM player_registrations WHERE tournament_id = $1", [tournamentId]);
}

async function main() {
  const client = await pool.connect();
  try {
    const tournament = await resolveTournamentId(client);
    const tournamentId = tournament.id;
    const rolePlan = buildRolePlan();
    const multiRolePlayers = rolePlan.filter((roles) => roles.length >= MULTI_ROLE_MIN).length;

    await client.query("BEGIN");
    await clearPlayerData(client, tournamentId);
    console.log(`Cleared players, teams, and registrations for: ${tournament.name}`);

    for (let i = 1; i <= TOTAL_PLAYERS; i += 1) {
      const id = randomUUID();
      const roles = rolePlan[i - 1];
      const steamName = `SeedPlayer_${String(i).padStart(2, "0")}`;
      const publicCode = `BPC-${String(i).padStart(3, "0")}`;
      const email = `seed.player${String(i).padStart(2, "0")}@seed.bpcl.local`;

      await client.query(
        `INSERT INTO player_registrations (
          id, tournament_id, email, name, display_name, location, roles, mmr, steam_name, steam_profile,
          discord_handle, phone_number, payment_screenshot, notes, payment_status, registration_status,
          registration_flow_stage, email_verified_at, terms_accepted_at, public_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'paid', 'approved', 'submitted', NOW(), NOW(), $15)`,
        [
          id,
          tournamentId,
          email,
          `Seed Player ${i}`,
          steamName,
          "Seed Region",
          JSON.stringify(roles),
          3800 + (i % 20) * 75,
          steamName,
          `https://steamcommunity.com/id/${steamName.toLowerCase()}`,
          `seed${i}`,
          "",
          "",
          `Seeded test player (${roles.length} role${roles.length === 1 ? "" : "s"})`,
          publicCode,
        ],
      );
    }

    await client.query("COMMIT");

    const summary = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE jsonb_array_length(roles) >= $2)::int AS multi_role
       FROM player_registrations
       WHERE tournament_id = $1`,
      [tournamentId, MULTI_ROLE_MIN],
    );

    console.log(`Inserted ${TOTAL_PLAYERS} registrations.`);
    console.log(`Players with ${MULTI_ROLE_MIN}+ roles: ${summary.rows[0].multi_role}/${summary.rows[0].total} (planned ${multiRolePlayers}).`);
    console.log("Done — assign players from Registration CRM / Teams setup.");
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
