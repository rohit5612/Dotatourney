/**
 * Seed 3 fresh Season 1 legacy players for the claim-account flow.
 *
 * Allocates the next 3 BPC IDs after the highest existing BPC-### in the database
 * (does not reuse BPC-001, etc.).
 *
 * Each account:
 *   - Fresh unique email + BPC ID
 *   - password_hash NULL (unclaimed — use /claim-account)
 *   - Approved Season 1 registration with matching public_code
 *
 * Usage (from server/):
 *   node scripts/seed-s1-claimable-players.js --dry-run
 *   node scripts/seed-s1-claimable-players.js --apply
 *
 * Optional env (comma-separated, must be 3 unique addresses):
 *   CLAIM_S1_EMAILS=you1@gmail.com,you2@gmail.com,you3@gmail.com
 */
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import {
  createPlayerAccount,
  findAccountByBpcId,
  findAccountByEmail,
  syncBpcIdSequenceFromMax,
} from "../src/services/playerAccountRepository.js";

dotenv.config();

const PLAYER_TEMPLATES = [
  {
    displayName: "Season One — Arjun",
    steamPersona: "S1_Arjun",
    steamId: "76561198011110001",
    steamProfile: "https://steamcommunity.com/id/s1-arjun",
    discordId: "90000000000010001",
    discordUsername: "s1_arjun",
    mmr: 4200,
    roles: ["Carry"],
  },
  {
    displayName: "Season One — Priya",
    steamPersona: "S1_Priya",
    steamId: "76561198011110002",
    steamProfile: "https://steamcommunity.com/id/s1-priya",
    discordId: "90000000000010002",
    discordUsername: "s1_priya",
    mmr: 4050,
    roles: ["Mid"],
  },
  {
    displayName: "Season One — Vikram",
    steamPersona: "S1_Vikram",
    steamId: "76561198011110003",
    steamProfile: "https://steamcommunity.com/id/s1-vikram",
    discordId: "90000000000010003",
    discordUsername: "s1_vikram",
    mmr: 3900,
    roles: ["Offlane"],
  },
];

function parseEmailOverrides() {
  const raw = String(process.env.CLAIM_S1_EMAILS || "").trim();
  if (!raw) return null;
  const emails = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length !== 3) {
    throw new Error("CLAIM_S1_EMAILS must contain exactly 3 comma-separated emails");
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error("CLAIM_S1_EMAILS must not contain duplicate addresses");
  }
  return emails;
}

async function getMaxBpcNumber(client) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(
      NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int
    ), 0) AS max_n
     FROM player_accounts
     WHERE bpc_id ~ '^BPC-[0-9]+$'`,
  );
  return Number(rows[0]?.max_n ?? 0);
}

async function buildFreshPlayers(client) {
  await syncBpcIdSequenceFromMax();
  const maxN = await getMaxBpcNumber(client);
  const emailOverrides = parseEmailOverrides();
  const runTag = Date.now().toString(36);

  return PLAYER_TEMPLATES.map((template, index) => {
    const seq = maxN + index + 1;
    const bpcId = `BPC-${String(seq).padStart(3, "0")}`;
    const email =
      emailOverrides?.[index] ||
      `s1.claim.${String(seq).padStart(3, "0")}.${runTag}@bpcl.test`;
    return {
      ...template,
      bpcId,
      email: email.toLowerCase(),
      steamId: `76561198${String(90000000 + seq).padStart(8, "0")}`,
      discordId: `9000000000${String(10000 + seq).padStart(5, "0")}`,
      discordUsername: `${template.discordUsername}_${seq}`,
    };
  });
}

async function findSeason1TournamentId(client) {
  const { rows } = await client.query(
    `SELECT t.id
     FROM tournaments t
     LEFT JOIN seasons s ON s.tournament_id = t.id
     WHERE t.slug = 'season-1' OR s.slug = 'season-1'
     ORDER BY s.number ASC NULLS LAST
     LIMIT 1`,
  );
  return rows[0]?.id || null;
}

async function assertUniqueTargets(players) {
  const bpcIds = players.map((p) => p.bpcId.toUpperCase());
  const emails = players.map((p) => p.email.toLowerCase());
  if (new Set(bpcIds).size !== bpcIds.length) throw new Error("Duplicate BPC IDs in seed batch");
  if (new Set(emails).size !== emails.length) throw new Error("Duplicate emails in seed batch");

  for (const player of players) {
    const byEmail = await findAccountByEmail(player.email);
    if (byEmail) {
      throw new Error(`Email ${player.email} is already used by ${byEmail.bpc_id}`);
    }
    const byBpc = await findAccountByBpcId(player.bpcId);
    if (byBpc) {
      throw new Error(`BPC ID ${player.bpcId} already exists (${byBpc.email})`);
    }
  }
}

async function createClaimPlayer(client, player, tournamentId) {
  const account = await createPlayerAccount(client, {
    email: player.email,
    displayName: player.displayName,
    bpcId: player.bpcId.toUpperCase(),
    emailVerifiedAt: null,
    steamId: player.steamId,
    steamPersona: player.steamPersona,
    steamProfile: player.steamProfile,
    discordId: player.discordId,
    discordUsername: player.discordUsername,
  });

  await client.query(`UPDATE player_accounts SET mmr = $2, preferred_roles = $3::jsonb WHERE id = $1`, [
    account.id,
    player.mmr,
    JSON.stringify(player.roles),
  ]);

  if (!tournamentId) return account;

  await client.query(
    `INSERT INTO player_registrations (
      id, tournament_id, player_account_id, email, name, display_name, location, roles, mmr,
      steam_name, steam_profile, discord_handle, phone_number, payment_screenshot, notes,
      payment_status, registration_status, registration_flow_stage, email_verified_at,
      terms_accepted_at, public_code
    ) VALUES (
      $1, $2, $3, $4, $5, $5, 'India', $6::jsonb, $7,
      $8, $9, $10, '', '', 'S1 legacy claim seed',
      'paid', 'approved', 'complete', NOW(),
      NOW(), $11
    )`,
    [
      randomUUID(),
      tournamentId,
      account.id,
      player.email.toLowerCase(),
      player.displayName,
      JSON.stringify(player.roles),
      player.mmr,
      player.steamPersona,
      player.steamProfile,
      player.discordUsername,
      player.bpcId.toUpperCase(),
    ],
  );

  return account;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  console.log("=== Season 1 claimable players seed ===");
  console.log("Mode:", dryRun ? "DRY RUN" : "APPLY");
  console.log("");

  const client = await pool.connect();
  let players;
  try {
    players = await buildFreshPlayers(client);
  } finally {
    client.release();
  }

  const maxBefore = await getMaxBpcNumber(pool);
  console.log(`Highest existing BPC ID number: BPC-${String(maxBefore).padStart(3, "0")}`);
  console.log("");

  await assertUniqueTargets(players);

  const tournamentId = await findSeason1TournamentId(pool);
  if (!tournamentId) {
    console.warn("Warning: Season 1 tournament not found — accounts will be created without registrations.");
  }

  for (const player of players) {
    console.log(`• ${player.bpcId}  →  ${player.email}  (${player.displayName})`);
  }
  console.log("");

  if (dryRun) {
    console.log("Pass --apply to create these fresh accounts (password unset for claim flow).");
    await pool.end();
    return;
  }

  const writeClient = await pool.connect();
  try {
    await writeClient.query("BEGIN");
    for (const player of players) {
      await createClaimPlayer(writeClient, player, tournamentId);
    }
    await writeClient.query("COMMIT");
    await syncBpcIdSequenceFromMax();

    console.log("Done. Claim flow test credentials:");
    console.log("  /claim-account — enter BPC ID + email, then open the link in your inbox.");
    for (const player of players) {
      console.log(`  ${player.bpcId}  +  ${player.email}`);
    }
    const maxN = await syncBpcIdSequenceFromMax();
    console.log(`\nNext auto-allocated BPC ID will be BPC-${String(maxN + 1).padStart(3, "0")}.`);
  } catch (error) {
    await writeClient.query("ROLLBACK");
    throw error;
  } finally {
    writeClient.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
