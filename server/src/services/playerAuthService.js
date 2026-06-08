import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import {
  createPlayerAccount,
  eligibilityFromAccount,
  findAccountByEmail,
  findAccountById,
  findAccountByDiscordId,
  findAccountByGoogleSub,
  findAccountBySteamId,
  publicPlayerAccount,
  updatePlayerAccount,
} from "./playerAccountRepository.js";
import { hashPassword, verifyPassword } from "./authService.js";

const SESSION_DAYS = 14;
const EMAIL_VERIFY_HOURS = 48;
const PASSWORD_RESET_HOURS = 2;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPlayerTokenPurpose(purpose, token) {
  const secret = env.playerTokenSecret;
  return createHash("sha256").update(`${secret}:${purpose}:${token}`).digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}

export async function createPlayerSession(playerAccountId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO player_sessions (id, token_hash, player_account_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), hashToken(token), playerAccountId, expiresAt.toISOString()],
  );
  return { token, expiresAt };
}

export async function getPlayerSessionAccount(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT a.*
     FROM player_sessions s
     JOIN player_accounts a ON a.id = s.player_account_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

export async function deletePlayerSession(token) {
  if (!token) return;
  await pool.query(`DELETE FROM player_sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export async function requirePlayer(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const account = await getPlayerSessionAccount(token);
    if (!account) {
      return res.status(401).json({ message: "Player authentication required" });
    }
    req.playerAccount = account;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function registerPlayerWithPassword({ email, password, displayName }) {
  const normalized = email.trim().toLowerCase();
  const existing = await findAccountByEmail(normalized);
  if (existing) {
    const err = new Error("An account with this email already exists");
    err.status = 409;
    throw err;
  }

  const verifyToken = createOpaqueToken();
  const verifyHash = hashPlayerTokenPurpose("email-verify", verifyToken);
  const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await createPlayerAccount(client, {
      email: normalized,
      passwordHash: hashPassword(password),
      displayName: displayName || "",
      emailVerifyTokenHash: verifyHash,
      emailVerifyExpiresAt: verifyExpires.toISOString(),
    });
    await client.query("COMMIT");
    const fresh = await findAccountById(account.id);
    return { account: fresh, verifyToken };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function verifyPlayerEmail(token, { email: emailHint } = {}) {
  const hash = hashPlayerTokenPurpose("email-verify", token);
  const { rows } = await pool.query(
    `SELECT * FROM player_accounts
     WHERE email_verify_token_hash = $1
       AND email_verify_expires_at > NOW()`,
    [hash],
  );
  let account = rows[0];

  if (!account && emailHint) {
    const existing = await findAccountByEmail(emailHint);
    if (existing?.email_verified_at) {
      return existing;
    }
    if (existing?.email_verify_token_hash) {
      const err = new Error(
        "This verification link is outdated (a newer link was sent). Use Resend below or open the latest email.",
      );
      err.status = 400;
      err.code = "OUTDATED_VERIFY_TOKEN";
      throw err;
    }
  }

  if (!account) {
    const err = new Error("Invalid or expired verification link");
    err.status = 400;
    throw err;
  }

  if (account.email_verified_at) {
    return account;
  }

  await updatePlayerAccount(account.id, {
    emailVerifiedAt: new Date().toISOString(),
    emailVerifyTokenHash: null,
    emailVerifyExpiresAt: null,
  });
  return findAccountById(account.id);
}

/** Issue a new verification link for an unverified account (e.g. after a failed first signup). */
export async function resendPlayerEmailVerification(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const account = await findAccountByEmail(normalized);
  if (!account) return null;
  if (account.email_verified_at) {
    const err = new Error("Email is already verified");
    err.status = 400;
    throw err;
  }
  const verifyToken = createOpaqueToken();
  const verifyHash = hashPlayerTokenPurpose("email-verify", verifyToken);
  const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
  await updatePlayerAccount(account.id, {
    emailVerifyTokenHash: verifyHash,
    emailVerifyExpiresAt: verifyExpires.toISOString(),
  });
  return { account: await findAccountById(account.id), verifyToken };
}

export async function loginPlayer({ email, password }) {
  const account = await findAccountByEmail(email);
  if (!account || !account.password_hash || !verifyPassword(password, account.password_hash)) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }
  if (!account.email_verified_at) {
    const err = new Error("Please verify your email before signing in");
    err.status = 403;
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }
  const session = await createPlayerSession(account.id);
  return { account, session };
}

export async function requestPasswordReset(email) {
  const account = await findAccountByEmail(email);
  if (!account) return null;
  const resetToken = createOpaqueToken();
  const resetHash = hashPlayerTokenPurpose("password-reset", resetToken);
  const resetExpires = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);
  await updatePlayerAccount(account.id, {
    passwordResetTokenHash: resetHash,
    passwordResetExpiresAt: resetExpires.toISOString(),
  });
  return { account, resetToken };
}

export async function resetPlayerPassword(token, newPassword) {
  const hash = hashPlayerTokenPurpose("password-reset", token);
  const { rows } = await pool.query(
    `SELECT * FROM player_accounts
     WHERE password_reset_token_hash = $1
       AND password_reset_expires_at > NOW()`,
    [hash],
  );
  const account = rows[0];
  if (!account) {
    const err = new Error("Invalid or expired reset link");
    err.status = 400;
    throw err;
  }
  await updatePlayerAccount(account.id, {
    passwordHash: hashPassword(newPassword),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
  });
  return findAccountById(account.id);
}

export function playerMePayload(account) {
  return {
    account: eligibilityFromAccount(account),
    coinBalance: null,
  };
}

export async function playerMeWithCoins(account) {
  const { getCoinBalance } = await import("./playerAccountRepository.js");
  const balance = await getCoinBalance(account.id);
  return {
    account: eligibilityFromAccount(account),
    coinBalance: balance,
  };
}

export async function upsertPlayerFromOAuth({
  email,
  googleSub = null,
  displayName = "",
  emailVerified = true,
  steamId = null,
  steamPersona = "",
  steamProfile = "",
  steamAvatarUrl = "",
  discordId = null,
  discordUsername = "",
  discordAvatarUrl = "",
}) {
  const normalized = (email || "").trim().toLowerCase();
  let account = googleSub ? await findAccountByGoogleSub(googleSub) : null;
  if (!account && normalized) account = await findAccountByEmail(normalized);
  if (!account && steamId) account = await findAccountBySteamId(steamId);
  if (!account && discordId) account = await findAccountByDiscordId(discordId);

  if (account) {
    if (googleSub && account.google_sub && account.google_sub !== googleSub) {
      const err = new Error("This email is linked to a different Google account");
      err.status = 409;
      err.code = "GOOGLE_ACCOUNT_MISMATCH";
      throw err;
    }
    const patch = {};
    if (googleSub && !account.google_sub) patch.googleSub = googleSub;
    if (emailVerified && !account.email_verified_at) patch.emailVerifiedAt = new Date().toISOString();
    if (steamId) {
      patch.steamId = steamId;
      patch.steamPersona = steamPersona;
      patch.steamProfile = steamProfile;
      patch.steamAvatarUrl = steamAvatarUrl;
    }
    if (discordId) {
      patch.discordId = discordId;
      patch.discordUsername = discordUsername;
      patch.discordAvatarUrl = discordAvatarUrl;
    }
    if (displayName && !account.display_name) patch.displayName = displayName;
    if (Object.keys(patch).length) account = await updatePlayerAccount(account.id, patch);
    return account;
  }

  if (!normalized) {
    const err = new Error("Email is required to create a new account");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    account = await createPlayerAccount(client, {
      email: normalized,
      displayName,
      googleSub,
      emailVerifiedAt: emailVerified ? new Date().toISOString() : null,
      steamId,
      steamPersona,
      steamProfile,
      steamAvatarUrl,
      discordId,
      discordUsername,
      discordAvatarUrl,
    });
    await client.query("COMMIT");
    return account;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export { publicPlayerAccount, eligibilityFromAccount };
