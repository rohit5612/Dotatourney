import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { slugifyPlayer } from "../utils/playerSlug.js";
import { demoAccessDisplayOverrides, isDemoAccessAccount } from "../utils/demoAccessAccount.js";

const BPC_PREFIX = "BPC";
const BPC_CODE_RE = /^BPC-(\d+)$/i;

export function formatBpcId(n) {
  return `${BPC_PREFIX}-${String(n).padStart(3, "0")}`;
}

function parsePreferredRoles(value) {
  if (Array.isArray(value)) return value.map((role) => String(role));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((role) => String(role));
    } catch {
      // ignore
    }
  }
  return [];
}

export function parseBpcIdNumber(code) {
  const m = String(code || "").trim().toUpperCase().match(BPC_CODE_RE);
  return m ? Number(m[1]) : null;
}

/** Normalize overlay/API path segments to canonical BPC-### form. */
export function normalizeBpcIdParam(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;
  if (/^\d+$/.test(input)) return formatBpcId(Number(input));
  const n = parseBpcIdNumber(input);
  return n != null ? formatBpcId(n) : null;
}

/**
 * Highest numeric BPC-### in use across player accounts and legacy registrations.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function getMaxAssignedBpcNumber(db = pool) {
  const query = db.query.bind(db);
  const { rows } = await query(
    `SELECT GREATEST(
      COALESCE(
        (SELECT MAX(NULLIF(regexp_replace(bpc_id, '^BPC-', ''), '')::int)
         FROM player_accounts WHERE bpc_id ~ '^BPC-[0-9]+$'),
        0
      ),
      COALESCE(
        (SELECT MAX(NULLIF(regexp_replace(public_code, '^BPC-', ''), '')::int)
         FROM player_registrations WHERE public_code ~ '^BPC-[0-9]+$'),
        0
      )
    )::int AS max_n`,
  );
  return Number(rows[0]?.max_n ?? 0);
}

async function isBpcIdAssigned(client, bpcId, { includeRegistrations = true } = {}) {
  const normalized = String(bpcId || "").trim().toUpperCase();
  if (!normalized) return true;
  const registrationClause = includeRegistrations
    ? `UNION ALL
     SELECT 1 FROM player_registrations WHERE upper(public_code) = $1 AND public_code IS NOT NULL`
    : "";
  const { rows } = await client.query(
    `SELECT 1 AS hit FROM player_accounts WHERE upper(bpc_id) = $1
     ${registrationClause}
     LIMIT 1`,
    [normalized],
  );
  return rows.length > 0;
}

export function publicPlayerAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    bpcId: row.bpc_id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at,
    phoneNumber: row.phone_number || "",
    displayName: row.display_name ? String(row.display_name) : "",
    slug: row.slug,
    steamId: row.steam_id || null,
    steamPersona: row.steam_persona || "",
    steamAvatarUrl: row.steam_avatar_url || "",
    steamProfile: row.steam_profile || "",
    discordId: row.discord_id || null,
    discordUsername: row.discord_username || "",
    discordAvatarUrl: row.discord_avatar_url || "",
    avatarUrl: row.avatar_url || "",
    avatarPortraitCrop:
      row.avatar_portrait_crop && typeof row.avatar_portrait_crop === "object"
        ? row.avatar_portrait_crop
        : {},
    bio: row.bio || "",
    mmr: row.mmr ?? null,
    preferredRoles: parsePreferredRoles(row.preferred_roles),
    location: row.location || "",
    profileCompletedAt: row.profile_completed_at,
    hasPassword: Boolean(row.password_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public profile page — omits private account fields. */
export function publicPlayerProfileAccount(row) {
  const pub = publicPlayerAccount(row);
  if (!pub) return null;
  const { email, phoneNumber, hasPassword, emailVerifiedAt, ...safe } = pub;
  return safe;
}

export function publicSteamOnlyProfile(account) {
  if (!account) return null;
  return {
    displayName: account.display_name || account.slug,
    bpcId: account.bpc_id,
    steamPersona: account.steam_persona || "",
    steamAvatarUrl: account.steam_avatar_url || "",
    steamProfile: account.steam_profile || "",
  };
}

export function eligibilityFromAccount(account) {
  const pub = publicPlayerAccount(account);
  if (!pub) return null;

  if (isDemoAccessAccount(account)) {
    const overrides = demoAccessDisplayOverrides(account);
    return { ...pub, ...overrides };
  }

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

export async function findAccountByBpcId(bpcId) {
  const normalized = String(bpcId || "").trim().toUpperCase();
  if (!normalized) return null;
  const { rows } = await pool.query(`SELECT * FROM player_accounts WHERE upper(bpc_id) = $1`, [normalized]);
  return rows[0] || null;
}

export async function findAccountByDisplayName(displayName) {
  const name = String(displayName || "").trim();
  if (!name) return null;
  const { rows } = await pool.query(
    `SELECT * FROM player_accounts WHERE lower(display_name) = lower($1)`,
    [name],
  );
  if (rows.length !== 1) return null;
  return rows[0];
}

export async function resolveAccountByIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) return findAccountByEmail(raw);
  if (/^bpc-/i.test(raw)) return findAccountByBpcId(raw);
  const bySlug = await findAccountBySlug(raw);
  if (bySlug) return bySlug;
  return findAccountByDisplayName(raw);
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
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const { rows } = await client.query(`SELECT nextval('bpc_id_seq')::bigint AS n`);
    const n = Number(rows[0]?.n ?? 1);
    const candidate = formatBpcId(n);
    const taken = await isBpcIdAssigned(client, candidate);
    if (!taken) return candidate;
  }
  const err = new Error("Unable to allocate a unique BPC ID");
  err.status = 500;
  throw err;
}

export async function syncBpcIdSequenceFromMax() {
  const maxN = await getMaxAssignedBpcNumber(pool);
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
    /** When true, allow assigning a BPC ID that exists only on player_registrations.public_code (S1 migration). */
    fromRegistrationPublicCode = false,
  },
) {
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();
  let assignedBpcId = bpcId;
  if (assignedBpcId) {
    const normalized = String(assignedBpcId).trim().toUpperCase();
    if (await isBpcIdAssigned(client, normalized, { includeRegistrations: !fromRegistrationPublicCode })) {
      const err = new Error(`BPC ID ${normalized} is already assigned`);
      err.status = 409;
      err.code = "BPC_ID_TAKEN";
      throw err;
    }
    assignedBpcId = normalized;
  } else {
    assignedBpcId = await allocateBpcId(client);
  }
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
    mmr: "mmr",
    preferred_roles: "preferredRoles",
    location: "location",
    profile_completed_at: "profileCompletedAt",
    welcome_email_sent_at: "welcomeEmailSentAt",
  };

  for (const [col, key] of Object.entries(allowed)) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      if (col === "preferred_roles") {
        values.push(JSON.stringify(Array.isArray(patch[key]) ? patch[key].map((role) => String(role)) : []));
      } else if (col === "display_name" || col === "location" || col === "bio" || col === "steam_persona" || col === "discord_username") {
        values.push(patch[key] == null ? patch[key] : String(patch[key]));
      } else {
        values.push(patch[key]);
      }
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

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function grantCoins(
  { playerAccountId, delta, reason = "", grantedByAdminId = null, tournamentId = null },
  db = pool,
) {
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0) {
    const err = new Error("Coin delta must be a non-zero integer");
    err.status = 400;
    throw err;
  }
  const query = db.query.bind(db);
  const { rows: balRows } = await query(
    `SELECT balance_after FROM bpc_coin_ledger
     WHERE player_account_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerAccountId],
  );
  const current = Number(balRows[0]?.balance_after ?? 0);
  const next = current + amount;
  if (next < 0) {
    const err = new Error("Insufficient BPC coin balance");
    err.status = 400;
    throw err;
  }
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO bpc_coin_ledger (
      id, player_account_id, delta, balance_after, reason, granted_by_admin_id, tournament_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [id, playerAccountId, amount, next, reason, grantedByAdminId, tournamentId],
  );
  return {
    id: rows[0].id,
    delta: rows[0].delta,
    balanceAfter: rows[0].balance_after,
    reason: rows[0].reason,
    createdAt: rows[0].created_at,
  };
}
