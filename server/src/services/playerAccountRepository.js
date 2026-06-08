import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { slugifyPlayer } from "../utils/playerSlug.js";

const BPC_PREFIX = "BPC";

export function publicPlayerAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    bpcId: row.bpc_id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at,
    phoneNumber: row.phone_number || "",
    displayName: row.display_name || "",
    slug: row.slug,
    steamId: row.steam_id || null,
    steamPersona: row.steam_persona || "",
    steamAvatarUrl: row.steam_avatar_url || "",
    steamProfile: row.steam_profile || "",
    discordId: row.discord_id || null,
    discordUsername: row.discord_username || "",
    discordAvatarUrl: row.discord_avatar_url || "",
    avatarUrl: row.avatar_url || "",
    bio: row.bio || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eligibilityFromAccount(account) {
  const pub = publicPlayerAccount(account);
  if (!pub) return null;
  const emailVerified = Boolean(account.email_verified_at);
  const steamLinked = Boolean(account.steam_id);
  const discordLinked = Boolean(account.discord_id);
  return {
    ...pub,
    emailVerified,
    steamLinked,
    discordLinked,
    eligibleForRegistration: emailVerified && steamLinked && discordLinked,
  };
}

export async function findAccountByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE lower(email) = lower($1)`, [email]);
  return rows[0] || null;
}

export async function findAccountById(id) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findAccountBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE slug = $1`, [slug]);
  return rows[0] || null;
}

export async function findAccountByGoogleSub(sub) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE google_sub = $1`, [sub]);
  return rows[0] || null;
}

export async function findAccountBySteamId(steamId) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE steam_id = $1`, [steamId]);
  return rows[0] || null;
}

export async function findAccountByDiscordId(discordId) {
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE discord_id = $1`, [discordId]);
  return rows[0] || null;
}

async function reserveUniqueSlug(client, baseName) {
  const root = slugifyPlayer(baseName);
  for (let i = 0; i < 200; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { rows } = await client.query(`SELECT 1 FROM player_accounts WHERE slug = $1`, [candidate]);
    if (!rows.length) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 8)}`;
}

export async function allocateBpcId(client) {
  const { rows } = await client.query(`SELECT nextval('bpc_id_seq')::bigint AS n`);
  const n = Number(rows[0]?.n ?? 1);
  return `${BPC_PREFIX}-${String(n).padStart(3, "0")}`;
}

export async function syncBpcIdSequenceFromMax() {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(
      NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int
    ), 0) AS max_n FROM player_accounts WHERE bpc_id ~ '^BPC-[0-9]+$'`,
  );
  const maxN = Number(rows[0]?.max_n ?? 0);
  await pool.query(`SELECT setval('bpc_id_seq', GREATEST($1::bigint, (SELECT last_value FROM bpc_id_seq)), true)`, [
    maxN,
  ]);
  return maxN;
}

/**
 * @param {import('pg').PoolClient} client
 */
export async function createPlayerAccount(
  client,
  {
    email,
    passwordHash = null,
    displayName = "",
    phoneNumber = "",
    bpcId = null,
    emailVerifiedAt = null,
    googleSub = null,
    steamId = null,
    steamPersona = "",
    steamAvatarUrl = "",
    steamProfile = "",
    discordId = null,
    discordUsername = "",
    discordAvatarUrl = "",
    emailVerifyTokenHash = null,
    emailVerifyExpiresAt = null,
  },
) {
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();
  const assignedBpcId = bpcId || (await allocateBpcId(client));
  const slug = await reserveUniqueSlug(client, displayName || normalizedEmail.split("@")[0]);
  const now = emailVerifiedAt || null;

  const { rows } = await client.query(
    `INSERT INTO player_accounts (
      id, bpc_id, email, password_hash, google_sub, email_verified_at,
      email_verify_token_hash, email_verify_expires_at,
      phone_number, display_name, slug,
      steam_id, steam_persona, steam_avatar_url, steam_profile,
      discord_id, discord_username, discord_avatar_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8,
      $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18
    )
    RETURNING *`,
    [
      id,
      assignedBpcId,
      normalizedEmail,
      passwordHash,
      googleSub,
      now,
      emailVerifyTokenHash,
      emailVerifyExpiresAt,
      phoneNumber || "",
      displayName || normalizedEmail.split("@")[0],
      slug,
      steamId,
      steamPersona || "",
      steamAvatarUrl || "",
      steamProfile || "",
      discordId,
      discordUsername || "",
      discordAvatarUrl || "",
    ],
  );
  return rows[0];
}

export async function updatePlayerAccount(id, patch, db = pool) {
  const fields = [];
  const values = [];
  let i = 1;

  const allowed = {
    password_hash: "passwordHash",
    display_name: "displayName",
    phone_number: "phoneNumber",
    bio: "bio",
    avatar_url: "avatarUrl",
    email_verified_at: "emailVerifiedAt",
    email_verify_token_hash: "emailVerifyTokenHash",
    email_verify_expires_at: "emailVerifyExpiresAt",
    password_reset_token_hash: "passwordResetTokenHash",
    password_reset_expires_at: "passwordResetExpiresAt",
    google_sub: "googleSub",
    steam_id: "steamId",
    steam_persona: "steamPersona",
    steam_avatar_url: "steamAvatarUrl",
    steam_profile: "steamProfile",
    discord_id: "discordId",
    discord_username: "discordUsername",
    discord_avatar_url: "discordAvatarUrl",
    slug: "slug",
  };

  for (const [col, key] of Object.entries(allowed)) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(patch[key]);
    }
  }

  if (!fields.length) return findAccountById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);
  const query = db.query ? db.query.bind(db) : pool.query.bind(pool);
  const { rows } = await query(
    `UPDATE player_accounts SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values,
  );
  return rows[0] || null;
}

export async function recordAccountLink(playerAccountId, provider, externalId, client = pool) {
  const q = client.query.bind(client);
  await q(
    `INSERT INTO player_account_links (id, player_account_id, provider, external_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, external_id) DO UPDATE SET player_account_id = EXCLUDED.player_account_id, linked_at = NOW()`,
    [randomUUID(), playerAccountId, provider, externalId],
  );
}

export async function getCoinBalance(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT balance_after FROM bpc_coin_ledger
     WHERE player_account_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerAccountId],
  );
  return Number(rows[0]?.balance_after ?? 0);
}
