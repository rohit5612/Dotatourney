/**
 * Upsert five demo access accounts for QA/login testing.
 *
 * Emails:
 *   demo.access01@bpcl.test ... demo.access05@bpcl.test
 *
 * Guarantees linkage/profile prerequisites:
 * - email verified
 * - steam linked
 * - discord linked
 * - profile completed
 *
 * Usage (from server/):
 *   node scripts/seed-demo-access-accounts.js
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import { hashPassword } from "../src/services/authService.js";
import {
  createPlayerAccount,
  findAccountByEmail,
  syncBpcIdSequenceFromMax,
  updatePlayerAccount,
} from "../src/services/playerAccountRepository.js";

dotenv.config();

const PASSWORD = "BpclTest123!";
const ROLES = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];

function demoProfile(index) {
  const n = index + 1;
  return {
    email: `demo.access${String(n).padStart(2, "0")}@bpcl.test`,
    displayName: `Demo Access ${n}`,
    slugHint: `demo-access-${String(n).padStart(2, "0")}`,
    mmr: 4200 + index * 150,
    preferredRoles: [ROLES[index] || "Carry"],
    steamId: `7656119899${String(n).padStart(7, "0")}`,
    steamPersona: `DemoSteam_${n}`,
    steamProfile: `https://steamcommunity.com/id/demo-access-${String(n).padStart(2, "0")}`,
    discordId: `9000000000${10000 + n}`,
    discordUsername: `demo_discord_${n}`,
    phoneNumber: `+91 98765${String(43200 + n).padStart(5, "0")}`,
  };
}

async function ensureDemoAccount(client, profile, passwordHash) {
  const existing = await findAccountByEmail(profile.email);
  if (!existing) {
    const created = await createPlayerAccount(client, {
      email: profile.email,
      passwordHash,
      displayName: profile.displayName,
      emailVerifiedAt: new Date().toISOString(),
      steamId: profile.steamId,
      steamPersona: profile.steamPersona,
      steamProfile: profile.steamProfile,
      discordId: profile.discordId,
      discordUsername: profile.discordUsername,
      phoneNumber: profile.phoneNumber,
    });
    await updatePlayerAccount(created.id, {
      mmr: profile.mmr,
      preferredRoles: profile.preferredRoles,
      location: "Demo City, IN",
      profileCompletedAt: new Date().toISOString(),
    }, client);
    return { email: profile.email, created: true, bpcId: created.bpc_id };
  }

  const updated = await updatePlayerAccount(
    existing.id,
    {
      passwordHash: existing.password_hash || passwordHash,
      emailVerifiedAt: existing.email_verified_at || new Date().toISOString(),
      steamId: existing.steam_id || profile.steamId,
      steamPersona: existing.steam_persona || profile.steamPersona,
      steamProfile: existing.steam_profile || profile.steamProfile,
      discordId: existing.discord_id || profile.discordId,
      discordUsername: existing.discord_username || profile.discordUsername,
      mmr: existing.mmr ?? profile.mmr,
      preferredRoles:
        Array.isArray(existing.preferred_roles) && existing.preferred_roles.length > 0
          ? existing.preferred_roles
          : profile.preferredRoles,
      location: existing.location || "Demo City, IN",
      phoneNumber: existing.phone_number || profile.phoneNumber,
      profileCompletedAt: existing.profile_completed_at || new Date().toISOString(),
    },
    client,
  );
  return { email: profile.email, created: false, bpcId: updated.bpc_id };
}

async function main() {
  const client = await pool.connect();
  const passwordHash = hashPassword(PASSWORD);
  try {
    await client.query("BEGIN");
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(await ensureDemoAccount(client, demoProfile(i), passwordHash));
    }
    await client.query("COMMIT");
    await syncBpcIdSequenceFromMax();

    console.log("Demo access accounts ready:");
    for (const row of results) {
      console.log(`- ${row.email} (${row.created ? "created" : "updated"}) ${row.bpcId}`);
    }
    console.log(`Password for all demo accounts: ${PASSWORD}`);
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
