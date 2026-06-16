/**
 * Seed approved + paid test registrations for the active Season 2 tournament.
 *
 * Idempotent by email per tournament:
 * - creates/updates player_accounts
 * - creates/updates player_registrations with approved status
 *
 * Usage (from server/):
 *   node scripts/seed-season2-approved-users.js
 *   node scripts/seed-season2-approved-users.js --count=80
 */
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import {
  createPlayerAccount,
  findAccountByEmail,
  syncBpcIdSequenceFromMax,
  updatePlayerAccount,
} from "../src/services/playerAccountRepository.js";

dotenv.config();

const ROLES = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];
const DEFAULT_COUNT = 80;

function parseCount(argv) {
  const flag = argv.find((a) => a.startsWith("--count="));
  const value = flag ? Number(flag.split("=")[1]) : DEFAULT_COUNT;
  if (!Number.isFinite(value) || value < 1 || value > 500) {
    throw new Error("count must be a number between 1 and 500");
  }
  return Math.floor(value);
}

function buildUser(i) {
  const n = i + 1;
  const roleA = ROLES[i % ROLES.length];
  const roleB = ROLES[(i + 2) % ROLES.length];
  return {
    email: `seed.s2.player${String(n).padStart(2, "0")}@bpcl.test`,
    name: `S2 Seed Player ${n}`,
    displayName: `S2Player_${String(n).padStart(2, "0")}`,
    mmr: 3200 + ((i * 73) % 2200),
    roles: i % 3 === 0 ? [roleA, roleB] : [roleA],
    location: "Seed City, IN",
    steamId: `765611990${String(1000000 + n).padStart(7, "0")}`,
    steamPersona: `S2Seed_${String(n).padStart(2, "0")}`,
    steamProfile: `https://steamcommunity.com/id/s2-seed-${String(n).padStart(2, "0")}`,
    discordId: `9100000000${20000 + n}`,
    discordUsername: `s2_seed_${String(n).padStart(2, "0")}`,
    phoneNumber: `+91 99123${String(10000 + n).padStart(5, "0")}`,
  };
}

async function getActiveSeason2Tournament(client) {
  const { rows } = await client.query(
    `SELECT s.id AS season_id, s.slug AS season_slug, s.number, s.status, t.id AS tournament_id, t.name AS tournament_name
     FROM seasons s
     JOIN tournaments t ON t.id = s.tournament_id
     WHERE s.number = 2 AND s.status = 'active'
     ORDER BY s.updated_at DESC
     LIMIT 1`,
  );
  if (!rows[0]) {
    throw new Error("No active Season 2 found. Activate Season 2 first.");
  }
  return rows[0];
}

async function upsertAccount(client, user) {
  const existing = await findAccountByEmail(user.email);
  if (!existing) {
    return createPlayerAccount(client, {
      email: user.email,
      displayName: user.displayName,
      emailVerifiedAt: new Date().toISOString(),
      steamId: user.steamId,
      steamPersona: user.steamPersona,
      steamProfile: user.steamProfile,
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      phoneNumber: user.phoneNumber,
    });
  }
  return updatePlayerAccount(
    existing.id,
    {
      emailVerifiedAt: existing.email_verified_at || new Date().toISOString(),
      steamId: existing.steam_id || user.steamId,
      steamPersona: existing.steam_persona || user.steamPersona,
      steamProfile: existing.steam_profile || user.steamProfile,
      discordId: existing.discord_id || user.discordId,
      discordUsername: existing.discord_username || user.discordUsername,
      mmr: existing.mmr ?? user.mmr,
      preferredRoles:
        Array.isArray(existing.preferred_roles) && existing.preferred_roles.length > 0
          ? existing.preferred_roles
          : user.roles,
      location: existing.location || user.location,
      phoneNumber: existing.phone_number || user.phoneNumber,
      profileCompletedAt: existing.profile_completed_at || new Date().toISOString(),
      displayName: existing.display_name || user.displayName,
    },
    client,
  );
}

async function upsertRegistration(client, tournamentId, account, user) {
  const existing = await client.query(
    `SELECT id
     FROM player_registrations
     WHERE tournament_id = $1 AND lower(email) = lower($2) AND archived_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    [tournamentId, user.email],
  );

  if (existing.rows[0]) {
    const regId = existing.rows[0].id;
    await client.query(
      `UPDATE player_registrations
       SET player_account_id = $2,
           name = COALESCE(NULLIF(name, ''), $3),
           display_name = COALESCE(NULLIF(display_name, ''), $4),
           location = COALESCE(NULLIF(location, ''), $5),
           roles = CASE WHEN roles IS NULL OR roles = '[]'::jsonb THEN $6::jsonb ELSE roles END,
           mmr = COALESCE(mmr, $7),
           steam_name = COALESCE(NULLIF(steam_name, ''), $8),
           steam_profile = COALESCE(NULLIF(steam_profile, ''), $9),
           discord_handle = COALESCE(NULLIF(discord_handle, ''), $10),
           phone_number = COALESCE(NULLIF(phone_number, ''), $11),
           payment_status = 'paid',
           registration_status = 'approved',
           registration_flow_stage = 'submitted',
           email_verified_at = COALESCE(email_verified_at, NOW()),
           terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
           public_code = COALESCE(NULLIF(public_code, ''), $12),
           updated_at = NOW()
       WHERE id = $1`,
      [
        regId,
        account.id,
        user.name,
        user.displayName,
        user.location,
        JSON.stringify(user.roles),
        user.mmr,
        user.steamPersona,
        user.steamProfile,
        user.discordUsername,
        user.phoneNumber,
        account.bpc_id,
      ],
    );
    return { created: false };
  }

  await client.query(
    `INSERT INTO player_registrations (
      id, tournament_id, player_account_id, email, name, display_name, location, roles, mmr,
      steam_name, steam_profile, discord_handle, phone_number, payment_screenshot, notes,
      payment_status, registration_status, registration_flow_stage, email_verified_at, terms_accepted_at, public_code
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, '', 'Seeded Season 2 approved user',
      'paid', 'approved', 'submitted', NOW(), NOW(), $14
    )`,
    [
      randomUUID(),
      tournamentId,
      account.id,
      user.email,
      user.name,
      user.displayName,
      user.location,
      JSON.stringify(user.roles),
      user.mmr,
      user.steamPersona,
      user.steamProfile,
      user.discordUsername,
      user.phoneNumber,
      account.bpc_id,
    ],
  );
  return { created: true };
}

async function main() {
  const count = parseCount(process.argv.slice(2));
  const client = await pool.connect();
  try {
    const season = await getActiveSeason2Tournament(client);
    let createdRegs = 0;
    let updatedRegs = 0;
    let createdAccounts = 0;

    await client.query("BEGIN");
    for (let i = 0; i < count; i += 1) {
      const user = buildUser(i);
      const before = await findAccountByEmail(user.email);
      const account = await upsertAccount(client, user);
      if (!before) createdAccounts += 1;
      const reg = await upsertRegistration(client, season.tournament_id, account, user);
      if (reg.created) createdRegs += 1;
      else updatedRegs += 1;
    }
    await client.query("COMMIT");
    await syncBpcIdSequenceFromMax();

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS approved_count
       FROM player_registrations
       WHERE tournament_id = $1
         AND archived_at IS NULL
         AND registration_status = 'approved'`,
      [season.tournament_id],
    );

    console.log(`Season: ${season.season_slug} (${season.status}) | Tournament: ${season.tournament_name}`);
    console.log(`Accounts created: ${createdAccounts}`);
    console.log(`Registrations created: ${createdRegs}, updated: ${updatedRegs}`);
    console.log(`Approved registrations now on Season 2: ${rows[0]?.approved_count ?? 0}`);
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
