/**
 * Links all player_registrations to player_accounts (additive — no deletes).
 *
 * Usage:
 *   node scripts/migrate-s1-to-player-accounts.js --dry-run
 *   node scripts/migrate-s1-to-player-accounts.js --apply
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";
import {
  allocateBpcId,
  createPlayerAccount,
  findAccountByEmail,
  syncBpcIdSequenceFromMax,
} from "../src/services/playerAccountRepository.js";

dotenv.config();

const LEGACY_EMAIL_RE = /^legacy-.*@migrated\.forge$/i;
const BPC_CODE_RE = /^BPC-(\d+)$/i;

function parseBpcNum(code) {
  const m = String(code || "").match(BPC_CODE_RE);
  return m ? Number(m[1]) : null;
}

async function countTable(table) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return rows[0].c;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");

  if (!dryRun && !apply) {
    console.error("Pass --dry-run (default) or --apply");
    process.exit(1);
  }

  const before = {
    registrations: await countTable("player_registrations"),
    matches: await countTable("matches"),
    tournaments: await countTable("tournaments"),
  };

  const { rows: regs } = await pool.query(
    `SELECT id, email, name, display_name, phone_number, public_code, email_verified_at,
            steam_name, steam_profile, discord_handle, player_account_id
     FROM player_registrations
     ORDER BY lower(email), email_verified_at NULLS LAST, created_at ASC`,
  );

  const groups = new Map();
  for (const row of regs) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email || LEGACY_EMAIL_RE.test(email)) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(row);
  }

  let accountsToCreate = 0;
  let linksToSet = 0;

  for (const [, group] of groups) {
    const withAccount = group.filter((r) => r.player_account_id);
    if (withAccount.length === group.length) continue;
    accountsToCreate += withAccount.length ? 0 : 1;
    linksToSet += group.filter((r) => !r.player_account_id).length;
  }

  console.log("=== S1 → player_accounts migration ===");
  console.log("Mode:", dryRun ? "DRY RUN" : "APPLY");
  console.log("Registration rows:", before.registrations);
  console.log("Email groups:", groups.size);
  console.log("Accounts to create (est.):", accountsToCreate);
  console.log("Registration links to set (est.):", linksToSet);

  if (dryRun) {
    await pool.end();
    return;
  }

  const { rows: existingBpc } = await pool.query(`SELECT bpc_id FROM player_accounts`);
  const usedBpcIds = new Set(existingBpc.map((r) => r.bpc_id));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [email, group] of groups) {
      let accountId = group.find((r) => r.player_account_id)?.player_account_id || null;
      let accountRow = null;

      const existingAccount = await findAccountByEmail(email);
      if (existingAccount) {
        accountId = existingAccount.id;
        accountRow = existingAccount;
      } else if (accountId) {
        const { rows } = await client.query(`SELECT * FROM player_accounts WHERE id = $1`, [accountId]);
        accountRow = rows[0];
      } else {
        const codes = group.map((r) => r.public_code).filter(Boolean);
        let bestCode = null;
        let bestNum = Infinity;
        for (const code of codes) {
          const n = parseBpcNum(code);
          if (n != null && n < bestNum) {
            bestNum = n;
            bestCode = code;
          }
        }
        let bpcId = bestCode;
        if (!bpcId || usedBpcIds.has(bpcId)) {
          bpcId = await allocateBpcId(client);
        }
        usedBpcIds.add(bpcId);

        const sample = group[0];
        const verified = group.some((r) => r.email_verified_at);
        const displayName =
          sample.display_name ||
          sample.steam_name ||
          sample.name ||
          email.split("@")[0];

        accountRow = await createPlayerAccount(client, {
          email,
          displayName,
          phoneNumber: sample.phone_number || "",
          bpcId,
          fromRegistrationPublicCode: Boolean(bestCode && bpcId === bestCode),
          emailVerifiedAt: verified ? group.find((r) => r.email_verified_at)?.email_verified_at || new Date() : null,
          steamPersona: sample.steam_name || "",
          steamProfile: sample.steam_profile || "",
          discordUsername: sample.discord_handle || "",
        });
        accountId = accountRow.id;
      }

      for (const reg of group) {
        if (!reg.player_account_id) {
          await client.query(`UPDATE player_registrations SET player_account_id = $1, updated_at = NOW() WHERE id = $2`, [
            accountId,
            reg.id,
          ]);
        }
      }
    }

    await client.query("COMMIT");
    await syncBpcIdSequenceFromMax();

    const after = {
      registrations: await countTable("player_registrations"),
      matches: await countTable("matches"),
      accounts: await countTable("player_accounts"),
    };

    console.log("Done.");
    console.log("player_accounts:", after.accounts);
    if (after.registrations !== before.registrations) {
      console.warn("WARNING: registration count changed!", before.registrations, after.registrations);
    } else {
      console.log("Registration count unchanged:", after.registrations);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
