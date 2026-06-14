import { createHash, randomInt, randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { invalidatePublicCache } from "./publicCache.js";

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;

/** Player-facing registration IDs: BPC-001, BPC-002, … (not tied to tournament prefix setting). */
const PLAYER_PUBLIC_ID_PREFIX = "BPC";

const otpRequestBuckets = new Map();

function otpBucketKey(tournamentId, email) {
  return `${tournamentId}:${email.toLowerCase()}`;
}

export function assertOtpRequestRateLimit(tournamentId, email) {
  const key = otpBucketKey(tournamentId, email);
  const now = Date.now();
  let b = otpRequestBuckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + RATE_WINDOW_MS };
    otpRequestBuckets.set(key, b);
  }
  b.count += 1;
  if (b.count > MAX_OTP_REQUESTS_PER_WINDOW) {
    const err = new Error("Too many verification code requests. Please try again in a few minutes.");
    err.status = 429;
    throw err;
  }
}

function hashOtp(registrationId, otp) {
  const secret = env.registrationOtpSecret || "dev-registration-otp-secret-change-me";
  return createHash("sha256").update(`${secret}:${registrationId}:${otp}`).digest("hex");
}

function generateOtpDigits() {
  return String(randomInt(100000, 1000000));
}

function defaultDisplayName({ steamName, name }) {
  const steam = String(steamName || "").trim();
  if (steam) return steam;
  return String(name || "").trim();
}

export function mapRegistrationRow(row, { includeAdminFields = true } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    tournamentId: row.tournament_id,
    email: row.email,
    name: row.name,
    displayName: row.display_name || defaultDisplayName({ steamName: row.steam_name, name: row.name }),
    location: row.location,
    roles: Array.isArray(row.roles) ? row.roles : typeof row.roles === "string" ? JSON.parse(row.roles || "[]") : [],
    mmr: row.mmr,
    steamName: row.steam_name,
    steamProfile: row.steam_profile,
    discordHandle: row.discord_handle,
    phoneNumber: row.phone_number,
    paymentScreenshot: row.payment_screenshot,
    notes: row.notes,
    paymentStatus: row.payment_status,
    registrationStatus: row.registration_status,
    publicCode: row.public_code,
    substituteFlag: Boolean(row.substitute_flag),
    cardTier: row.card_tier || null,
    paymentProvider: row.payment_provider || null,
    playerAccountId: row.player_account_id || null,
    playerBpcId: row.player_bpc_id || null,
    playerSlug: row.player_slug || null,
    registrationFlowStage: row.registration_flow_stage,
    emailVerifiedAt: row.email_verified_at,
    termsAcceptedAt: row.terms_accepted_at,
    draftPayload: row.draft_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeAdminFields) {
    base.adminNotes = row.admin_notes;
    base.archivedAt = row.archived_at;
    base.archivedBy = row.archived_by;
    base.archivedReason = row.archived_reason;
  }
  return base;
}

const listSelect = `SELECT r.id, r.tournament_id, r.email, r.name, r.display_name, r.location, r.roles, r.mmr,
      r.steam_name, r.steam_profile, r.discord_handle, r.phone_number, r.payment_screenshot, r.notes,
      r.payment_status, r.registration_status, r.admin_notes, r.public_code, r.player_account_id,
      pa.bpc_id AS player_bpc_id, pa.slug AS player_slug,
      r.registration_flow_stage, r.card_tier, r.substitute_flag, r.payment_provider,
      r.email_verified_at, r.terms_accepted_at, r.draft_payload,
      r.archived_at, r.archived_by, r.archived_reason, r.created_at, r.updated_at`;

const registrationFrom = `FROM player_registrations r
     LEFT JOIN player_accounts pa ON pa.id = r.player_account_id`;

export async function createPlayerRegistration(tournamentId, payload) {
  const id = randomUUID();
  const email = (payload.email || "").toLowerCase().trim();
  const { rows } = await pool.query(
    `INSERT INTO player_registrations (
      id, tournament_id, email, name, display_name, location, roles, mmr, steam_name, steam_profile,
      discord_handle, phone_number, payment_screenshot, notes, payment_status, registration_status,
      registration_flow_stage, email_verified_at, terms_accepted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'unpaid', 'pending', 'submitted', NOW(), NULL)
    RETURNING id, tournament_id AS "tournamentId", email, name, display_name AS "displayName", location, roles, mmr,
              steam_name AS "steamName", steam_profile AS "steamProfile",
              discord_handle AS "discordHandle", phone_number AS "phoneNumber",
              payment_screenshot AS "paymentScreenshot", notes, payment_status AS "paymentStatus",
              registration_status AS "registrationStatus", admin_notes AS "adminNotes",
              public_code AS "publicCode", registration_flow_stage AS "registrationFlowStage",
              archived_at AS "archivedAt", archived_reason AS "archivedReason",
              created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      id,
      tournamentId,
      email || `legacy-${id}@bpcl.local`,
      payload.name,
      defaultDisplayName({ steamName: payload.steamName, name: payload.name }),
      payload.location || "",
      JSON.stringify(payload.roles || []),
      payload.mmr || null,
      payload.steamName || "",
      payload.steamProfile || "",
      payload.discordHandle || "",
      payload.phoneNumber || "",
      payload.paymentScreenshot || "",
      payload.notes || "",
    ],
  );
  return rows[0];
}

export async function listPlayerRegistrations(tournamentId, { excludeSubstitutes = false } = {}) {
  const substituteFilter = excludeSubstitutes ? " AND r.substitute_flag = FALSE" : "";
  const { rows } = await pool.query(
    `${listSelect}
     ${registrationFrom}
     WHERE r.tournament_id = $1${substituteFilter}
     ORDER BY r.created_at DESC`,
    [tournamentId],
  );
  return rows.map((row) => mapRegistrationRow(row));
}

/** Approved main-roster registrations (excludes substitutes). */
export async function countApprovedPlayerRegistrations(tournamentId, client = pool) {
  if (!tournamentId) return 0;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM player_registrations
     WHERE tournament_id = $1
       AND registration_status = 'approved'
       AND archived_at IS NULL
       AND substitute_flag = FALSE`,
    [tournamentId],
  );
  const n = rows[0]?.c;
  return typeof n === "number" ? n : Number(n) || 0;
}

/** @returns {{ cap: number|null, count: number, reached: boolean, registrationsOpen: boolean }} */
export async function getRegistrationCapState(tournamentId, client = pool) {
  const { rows } = await client.query(
    `SELECT registration_cap, registrations_open FROM tournaments WHERE id = $1`,
    [tournamentId],
  );
  const row = rows[0];
  if (!row) {
    return { cap: null, count: 0, reached: false, registrationsOpen: false };
  }
  const capRaw = row.registration_cap;
  const cap =
    capRaw != null && Number.isFinite(Number(capRaw)) && Number(capRaw) > 0 ? Math.floor(Number(capRaw)) : null;
  const count = await countApprovedPlayerRegistrations(tournamentId, client);
  const reached = cap != null && count >= cap;
  return {
    cap,
    count,
    reached,
    registrationsOpen: row.registrations_open === true,
  };
}

/**
 * When approved main-roster count hits registration_cap, close public registration.
 * Substitute signup is allowed once registrations_open is false.
 */
export async function syncRegistrationCapState(tournamentId, { client = null, invalidateCache = true } = {}) {
  const db = client || pool;
  const state = await getRegistrationCapState(tournamentId, db);
  if (!state.reached || !state.registrationsOpen) {
    return { ...state, changed: false, substitutePoolOpen: state.reached && !state.registrationsOpen };
  }
  await db.query(
    `UPDATE tournaments SET registrations_open = FALSE, updated_at = NOW() WHERE id = $1 AND registrations_open = TRUE`,
    [tournamentId],
  );
  if (!client && invalidateCache) invalidatePublicCache();
  return {
    ...state,
    registrationsOpen: false,
    changed: true,
    substitutePoolOpen: true,
  };
}

export function substitutePoolIsOpen(capState) {
  return Boolean(capState?.reached && capState?.registrationsOpen === false);
}

export async function getActiveRegistrationByEmail(tournamentId, email) {
  const { rows } = await pool.query(
    `${listSelect}
     ${registrationFrom}
     WHERE r.tournament_id = $1 AND lower(r.email) = lower($2) AND r.archived_at IS NULL`,
    [tournamentId, email],
  );
  return rows[0] || null;
}

export async function getActiveRegistrationByEmailAndCode(tournamentId, email, publicCode) {
  const { rows } = await pool.query(
    `${listSelect}
     ${registrationFrom}
     WHERE r.tournament_id = $1 AND lower(r.email) = lower($2) AND r.public_code = $3 AND r.archived_at IS NULL`,
    [tournamentId, email, publicCode.trim().toUpperCase()],
  );
  return rows[0] || null;
}

/** @returns {{ stage: string | null }} */
export async function lookupRegistrationFlowStage(tournamentId, email) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  if (!emailNorm) return { stage: null };
  const row = await getActiveRegistrationByEmail(tournamentId, emailNorm);
  if (!row) return { stage: null };
  return { stage: row.registration_flow_stage || null };
}

/**
 * @returns {{ registrationId: string, otp: string }}
 */
export async function requestRegistrationOtp(tournamentId, form, termsAcceptedAtIso) {
  const email = String(form.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    const err = new Error("Email is required");
    err.status = 400;
    throw err;
  }

  assertOtpRequestRateLimit(tournamentId, email);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT * FROM player_registrations
       WHERE tournament_id = $1 AND lower(email) = lower($2) AND archived_at IS NULL
       FOR UPDATE`,
      [tournamentId, email],
    );
    const row = existing.rows[0];
    if (!row) {
      const capState = await getRegistrationCapState(tournamentId, client);
      if (capState.reached) {
        await client.query("ROLLBACK");
        const err = new Error("Registration is full. Join the substitute pool from your player dashboard.");
        err.status = 403;
        throw err;
      }
    }
    if (row?.registration_flow_stage === "submitted") {
      await client.query("ROLLBACK");
      const err = new Error("This email already has a registration under review or completed.");
      err.status = 409;
      err.registrationConflict = { stage: "submitted" };
      throw err;
    }
    if (row?.registration_flow_stage === "awaiting_payment") {
      await client.query("ROLLBACK");
      const err = new Error("Email already verified. Continue to the payment step with your registration ID.");
      err.status = 400;
      err.registrationConflict = { stage: "awaiting_payment" };
      throw err;
    }

    const otp = generateOtpDigits();
    const draftJson = JSON.stringify({
      name: form.name,
      location: form.location || "",
      roles: form.roles || [],
      mmr: form.mmr,
      steamName: form.steamName,
      steamProfile: form.steamProfile,
      discordHandle: form.discordHandle,
      phoneNumber: form.phoneNumber,
    });
    const termsAt = termsAcceptedAtIso ? new Date(termsAcceptedAtIso).toISOString() : new Date().toISOString();

    let registrationId;
    if (row) {
      registrationId = row.id;
      const otpHash = hashOtp(registrationId, otp);
      const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
      await client.query(
        `UPDATE player_registrations SET
          name = $2, display_name = $3, location = $4, roles = $5, mmr = $6, steam_name = $7, steam_profile = $8,
          discord_handle = $9, phone_number = $10, terms_accepted_at = $11, draft_payload = $12::jsonb,
          registration_flow_stage = 'awaiting_otp', otp_hash = $13, otp_expires_at = $14, otp_attempts = 0,
          updated_at = NOW()
        WHERE id = $1`,
        [
          registrationId,
          form.name,
          defaultDisplayName({ steamName: form.steamName, name: form.name }),
          form.location || "",
          JSON.stringify(form.roles || []),
          form.mmr ?? null,
          form.steamName || "",
          form.steamProfile || "",
          form.discordHandle || "",
          form.phoneNumber || "",
          termsAt,
          draftJson,
          otpHash,
          expires,
        ],
      );
    } else {
      registrationId = randomUUID();
      const otpHash = hashOtp(registrationId, otp);
      const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
      await client.query(
        `INSERT INTO player_registrations (
          id, tournament_id, email, name, display_name, location, roles, mmr, steam_name, steam_profile,
          discord_handle, phone_number, payment_screenshot, notes, payment_status, registration_status,
          registration_flow_stage, terms_accepted_at, draft_payload, otp_hash, otp_expires_at, otp_attempts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', '', 'unpaid', 'pending',
          'awaiting_otp', $13, $14::jsonb, $15, $16, 0)`,
        [
          registrationId,
          tournamentId,
          email,
          form.name,
          defaultDisplayName({ steamName: form.steamName, name: form.name }),
          form.location || "",
          JSON.stringify(form.roles || []),
          form.mmr ?? null,
          form.steamName || "",
          form.steamProfile || "",
          form.discordHandle || "",
          form.phoneNumber || "",
          termsAt,
          draftJson,
          otpHash,
          expires,
        ],
      );
    }
    await client.query("COMMIT");
    return { registrationId, otp };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function verifyRegistrationOtp(tournamentId, email, otpInput) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const otp = String(otpInput || "").replace(/\s/g, "");
  if (!emailNorm || otp.length !== 6) {
    const err = new Error("Invalid verification code");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM player_registrations
       WHERE tournament_id = $1 AND lower(email) = lower($2) AND archived_at IS NULL
       FOR UPDATE`,
      [tournamentId, emailNorm],
    );
    const row = rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      const err = new Error("Registration not found");
      err.status = 404;
      throw err;
    }
    if (row.registration_flow_stage !== "awaiting_otp") {
      await client.query("ROLLBACK");
      const err = new Error("No pending verification for this email");
      err.status = 400;
      throw err;
    }
    if (!row.otp_expires_at || new Date(row.otp_expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      const err = new Error("Verification code expired. Request a new code.");
      err.status = 400;
      throw err;
    }
    if (row.otp_attempts >= MAX_OTP_ATTEMPTS) {
      await client.query("ROLLBACK");
      const err = new Error("Too many failed attempts. Request a new verification code.");
      err.status = 429;
      throw err;
    }

    const expectedHash = row.otp_hash;
    const actualHash = hashOtp(row.id, otp);
    if (expectedHash !== actualHash) {
      await client.query(
        `UPDATE player_registrations SET otp_attempts = otp_attempts + 1, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await client.query("COMMIT");
      const err = new Error("Invalid verification code");
      err.status = 400;
      throw err;
    }

    const tRow = await client.query(
      `UPDATE tournaments SET registration_code_seq = registration_code_seq + 1
       WHERE id = $1
       RETURNING registration_code_seq, registration_code_prefix`,
      [tournamentId],
    );
    const seq = tRow.rows[0]?.registration_code_seq ?? 1;
    const publicCode = `${PLAYER_PUBLIC_ID_PREFIX}-${String(seq).padStart(3, "0")}`;

    await client.query(
      `UPDATE player_registrations SET
        email_verified_at = NOW(),
        public_code = $2,
        registration_flow_stage = 'awaiting_payment',
        otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0,
        updated_at = NOW()
       WHERE id = $1`,
      [row.id, publicCode],
    );

    await client.query("COMMIT");

    const updated = await pool.query(`SELECT * FROM player_registrations WHERE id = $1`, [row.id]);
    return { registration: mapRegistrationRow(updated.rows[0], { includeAdminFields: false }), publicCode };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors after failed begin
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function getPublicRegistrationSession(tournamentId, email, publicCodeQuery) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  if (!emailNorm) return null;
  const row = await getActiveRegistrationByEmail(tournamentId, emailNorm);
  if (!row) return null;
  const codeTrim = publicCodeQuery ? String(publicCodeQuery).trim().toUpperCase() : "";

  if (row.registration_flow_stage === "awaiting_otp") {
    return mapRegistrationRow(row, { includeAdminFields: false });
  }
  if (row.registration_flow_stage === "awaiting_payment" || row.registration_flow_stage === "submitted") {
    if (!codeTrim || String(row.public_code || "").toUpperCase() !== codeTrim) return null;
    return mapRegistrationRow(row, { includeAdminFields: false });
  }
  return mapRegistrationRow(row, { includeAdminFields: false });
}

export async function completeRegistrationPayment(tournamentId, email, publicCode, paymentScreenshot, notes) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const code = String(publicCode || "")
    .trim()
    .toUpperCase();
  if (!emailNorm || !code || !paymentScreenshot) {
    const err = new Error("Email, registration ID, and payment screenshot are required");
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE player_registrations SET
      payment_screenshot = $4,
      notes = COALESCE($5, notes),
      registration_flow_stage = 'submitted',
      updated_at = NOW()
    WHERE tournament_id = $1 AND lower(email) = lower($2) AND public_code = $3
      AND archived_at IS NULL AND registration_flow_stage = 'awaiting_payment'
    RETURNING *`,
    [tournamentId, emailNorm, code, paymentScreenshot, notes || ""],
  );
  if (!rows[0]) {
    const err = new Error("Registration not found or payment step not available");
    err.status = 404;
    throw err;
  }
  return mapRegistrationRow(rows[0]);
}

export async function updatePlayerRegistration(tournamentId, registrationId, payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE player_registrations
       SET payment_status = COALESCE($3, payment_status),
           registration_status = COALESCE($4, registration_status),
           admin_notes = COALESCE($5, admin_notes),
           display_name = COALESCE($6, display_name),
           updated_at = NOW()
       WHERE tournament_id = $1 AND id = $2
       RETURNING *`,
      [
        tournamentId,
        registrationId,
        payload.paymentStatus,
        payload.registrationStatus,
        payload.adminNotes,
        payload.displayName !== undefined ? String(payload.displayName || "").trim() : null,
      ],
    );
    if (rows[0] && payload.displayName !== undefined) {
      const displayName = String(payload.displayName || "").trim();
      await client.query(
        `UPDATE players
         SET display_name = $3, name = $3
         WHERE tournament_id = $1 AND registration_id = $2`,
        [tournamentId, registrationId, displayName],
      );
    }
    if (
      rows[0] &&
      payload.registrationStatus === "approved" &&
      !rows[0].substitute_flag
    ) {
      await syncRegistrationCapState(tournamentId, { client, invalidateCache: false });
    }
    await client.query("COMMIT");
    if (rows[0] && payload.registrationStatus === "approved" && !rows[0].substitute_flag) {
      invalidatePublicCache();
    }
    return rows[0] ? mapRegistrationRow(rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlayerRegistrationById(tournamentId, registrationId) {
  const { rows } = await pool.query(`${listSelect} ${registrationFrom} WHERE r.tournament_id = $1 AND r.id = $2`, [
    tournamentId,
    registrationId,
  ]);
  return rows[0] ? mapRegistrationRow(rows[0]) : null;
}

export async function archivePlayerRegistration(tournamentId, registrationId, { reason, adminUserId }) {
  const assigned = await pool.query(
    `SELECT p.id
     FROM players p
     JOIN team_players tp ON tp.player_id = p.id
     WHERE p.tournament_id = $1 AND p.registration_id = $2
     LIMIT 1`,
    [tournamentId, registrationId],
  );
  if (assigned.rows[0]) {
    const error = new Error("Unassign this player from teams before archiving the registration");
    error.status = 409;
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE player_registrations
     SET archived_at = NOW(),
         archived_by = $3,
         archived_reason = $4,
         registration_status = 'rejected',
         updated_at = NOW()
     WHERE tournament_id = $1 AND id = $2
     RETURNING *`,
    [tournamentId, registrationId, adminUserId, reason || ""],
  );
  return rows[0] ? mapRegistrationRow(rows[0]) : null;
}
