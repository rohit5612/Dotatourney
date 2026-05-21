/**
 * Assign gamertags (3–14 chars) to all seeded registrations, build 12 teams,
 * save working roster, and create snapshot "test draft roster".
 *
 * Run from server/: node scripts/seed-test-draft-roster.js
 */
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { createRosterSnapshot, replaceTeamsAndPlayers } from "../src/services/tournamentRepository.js";

const ROSTER_NAME = "test draft roster";
const PLAYERS_PER_TEAM = 5;

const TEAM_NAMES = [
  "Warpath",
  "Arrise",
  "Phantom Division",
  "Emberfall",
  "Mortal oath",
  "Vanguard",
  "Ashborn",
  "Crimson Veil",
  "Chaos Theory",
  "Obsidian core",
  "Invictus",
  "Arcane order",
];

const TAG_PREFIXES = [
  "Neo",
  "Dark",
  "Iron",
  "Storm",
  "Ghost",
  "Wild",
  "Blaze",
  "Cold",
  "Swift",
  "Myst",
  "Royal",
  "Toxic",
  "Savage",
  "Prime",
  "Stealth",
  "Void",
  "Rogue",
  "Hex",
  "Bolt",
  "Rift",
];

const TAG_CORES = [
  "Wolf",
  "Fox",
  "Hawk",
  "Fang",
  "Edge",
  "Nova",
  "Flux",
  "Rune",
  "Sage",
  "Claw",
  "Soul",
  "Shade",
  "Volt",
  "Drift",
  "Spark",
  "Wraith",
  "Pulse",
  "Frost",
  "Ember",
  "Onyx",
];

function clampGamertag(raw) {
  const cleaned = String(raw || "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 14);
  if (cleaned.length >= 3) return cleaned;
  return (cleaned + "Tag").slice(0, 3).padEnd(3, "X");
}

function generateGamertags(count) {
  const used = new Set();
  const tags = [];
  let attempt = 0;

  while (tags.length < count) {
    const prefix = TAG_PREFIXES[attempt % TAG_PREFIXES.length];
    const core = TAG_CORES[Math.floor(attempt / TAG_PREFIXES.length) % TAG_CORES.length];
    const suffix = tags.length >= TAG_PREFIXES.length * TAG_CORES.length ? String((tags.length % 90) + 1) : "";
    const tag = clampGamertag(`${prefix}${core}${suffix}`);
    const key = tag.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      tags.push(tag);
    }
    attempt += 1;
  }

  return tags;
}

function teamAbbr(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function parseRoles(row) {
  if (Array.isArray(row.roles)) return row.roles;
  if (typeof row.roles === "string") {
    try {
      return JSON.parse(row.roles || "[]");
    } catch {
      return [];
    }
  }
  return [];
}

async function resolveTournamentId(client) {
  const published = await client.query(
    `SELECT id, name FROM tournaments WHERE is_published = TRUE ORDER BY updated_at DESC LIMIT 1`,
  );
  if (published.rows[0]) return published.rows[0];

  const any = await client.query(`SELECT id, name FROM tournaments ORDER BY created_at DESC LIMIT 1`);
  if (!any.rows[0]) throw new Error("No tournament found. Create a tournament in admin first.");
  return any.rows[0];
}

async function main() {
  const client = await pool.connect();
  try {
    const tournament = await resolveTournamentId(client);
    const tournamentId = tournament.id;

    const { rows: registrations } = await client.query(
      `SELECT id, name, roles, mmr, steam_name, steam_profile, discord_handle, location, public_code
       FROM player_registrations
       WHERE tournament_id = $1 AND archived_at IS NULL
       ORDER BY public_code ASC NULLS LAST, created_at ASC`,
      [tournamentId],
    );

    const expected = TEAM_NAMES.length * PLAYERS_PER_TEAM;
    if (registrations.length < expected) {
      throw new Error(`Need ${expected} registrations, found ${registrations.length}. Run seed-60-players.js first.`);
    }

    const rosterRegs = registrations.slice(0, expected);
    const gamertags = generateGamertags(rosterRegs.length);

    await client.query("BEGIN");

    for (let i = 0; i < rosterRegs.length; i += 1) {
      const reg = rosterRegs[i];
      const tag = gamertags[i];
      await client.query(
        `UPDATE player_registrations
         SET display_name = $3, updated_at = NOW()
         WHERE tournament_id = $1 AND id = $2`,
        [tournamentId, reg.id, tag],
      );
    }

    await client.query("COMMIT");
    console.log(`Assigned ${gamertags.length} gamertags (3–14 chars).`);

    const teams = [];
    const players = [];

    for (let t = 0; t < TEAM_NAMES.length; t += 1) {
      const teamId = randomUUID();
      const teamName = TEAM_NAMES[t];
      let captainTag = "";

      teams.push({
        id: teamId,
        name: teamName,
        captain: "",
        abbr: teamAbbr(teamName),
        seed: t + 1,
        logoUrl: "",
        accentColor: "",
      });

      for (let p = 0; p < PLAYERS_PER_TEAM; p += 1) {
        const index = t * PLAYERS_PER_TEAM + p;
        const reg = rosterRegs[index];
        const roles = parseRoles(reg);
        const primaryRole = roles[0] || "Carry";
        const tag = gamertags[index];
        const isCaptain = p === 0;
        const playerId = randomUUID();

        if (isCaptain) captainTag = tag;

        players.push({
          id: playerId,
          teamId,
          registrationId: reg.id,
          name: tag,
          displayName: tag,
          role: primaryRole,
          roles,
          mmr: reg.mmr,
          steamName: reg.steam_name || tag,
          steamProfile: reg.steam_profile || "",
          discordHandle: reg.discord_handle || "",
          location: reg.location || "",
          isCaptain,
        });
      }

      teams[t].captain = captainTag;
    }

    const teamPlayers = players.map((player) => ({
      id: randomUUID(),
      teamId: player.teamId,
      playerId: player.id,
    }));

    await replaceTeamsAndPlayers(tournamentId, teams, players, teamPlayers);
    console.log(`Saved ${teams.length} teams × ${PLAYERS_PER_TEAM} players.`);

    const roster = await createRosterSnapshot(tournamentId, ROSTER_NAME);
    console.log(`Created roster snapshot "${roster.name}" (${roster.id}, status: ${roster.status}).`);
    console.log("Teams:", TEAM_NAMES.join(" · "));
    console.log("Sample gamertags:", gamertags.slice(0, 8).join(", "));
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
