import { createHash, randomInt, randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import {
  cashfreeConfigured,
  createCashfreeOrder,
  fetchCashfreeOrder,
  publicCashfreeMode,
} from "./cashfreeService.js";
import { sendSponsorPaymentConfirmedEmail } from "./emailService.js";
import { logAction, logError } from "../utils/serverLogger.js";

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;
const MIN_SPONSOR_AMOUNT_RUPEES = 500;

const otpRequestBuckets = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertOtpRequestRateLimit(email) {
  const key = normalizeEmail(email);
  const now = Date.now();
  let bucket = otpRequestBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    otpRequestBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_OTP_REQUESTS_PER_WINDOW) {
    const err = new Error("Too many verification code requests. Please try again in a few minutes.");
    err.status = 429;
    throw err;
  }
}

function hashSponsorOtp(contributionId, otp) {
  const secret = env.registrationOtpSecret || "dev-registration-otp-secret-change-me";
  return createHash("sha256").update(`sponsor:${secret}:${contributionId}:${otp}`).digest("hex");
}

function generateOtpDigits() {
  return String(randomInt(100000, 1000000));
}

function assertValidAmount(amountRupees) {
  const amount = Number(amountRupees);
  if (!Number.isInteger(amount) || amount < MIN_SPONSOR_AMOUNT_RUPEES) {
    const err = new Error(`Sponsor amount must be at least ₹${MIN_SPONSOR_AMOUNT_RUPEES}`);
    err.status = 400;
    throw err;
  }
  return amount;
}

function mapContributionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type || "person",
    phoneNumber: row.phone_number,
    email: row.email,
    amountRupees: row.amount_rupees,
    flowStage: row.flow_stage,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    paymentSessionId: row.payment_session_id,
    paymentRef: row.payment_ref,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sponsorReturnUrl(contributionId) {
  const base = env.appUrl.replace(/\/$/, "");
  return `${base}/sponsors?orderId=${encodeURIComponent(contributionId)}`;
}

async function findPendingByEmail(client, email) {
  const { rows } = await client.query(
    `SELECT * FROM sponsor_contributions
     WHERE lower(email) = lower($1)
       AND flow_stage IN ('awaiting_otp', 'awaiting_payment')
     ORDER BY updated_at DESC
     LIMIT 1
     FOR UPDATE`,
    [email],
  );
  return rows[0] || null;
}

/**
 * @returns {{ contributionId: string, otp: string }}
 */
export async function requestSponsorOtp({ name, phone, email, amountRupees, entityType = "person" }) {
  const emailNorm = normalizeEmail(email);
  const phoneNorm = String(phone || "").trim();
  const nameNorm = String(name || "").trim();
  const amount = assertValidAmount(amountRupees);
  const entity = entityType === "org" ? "org" : "person";

  if (!emailNorm || !nameNorm || !phoneNorm) {
    const err = new Error(entity === "org" ? "Company name, phone, and email are required" : "Name, phone, and email are required");
    err.status = 400;
    throw err;
  }

  assertOtpRequestRateLimit(emailNorm);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await findPendingByEmail(client, emailNorm);
    const contributionId = existing?.id || randomUUID();
    const otp = generateOtpDigits();
    const otpHash = hashSponsorOtp(contributionId, otp);
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

    if (existing) {
      await client.query(
        `UPDATE sponsor_contributions
         SET name = $2,
             phone_number = $3,
             amount_rupees = $4,
             entity_type = $5,
             flow_stage = 'awaiting_otp',
             otp_hash = $6,
             otp_expires_at = $7,
             otp_attempts = 0,
             provider = NULL,
             provider_order_id = NULL,
             payment_session_id = NULL,
             payment_ref = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [contributionId, nameNorm, phoneNorm, amount, entity, otpHash, expires],
      );
    } else {
      await client.query(
        `INSERT INTO sponsor_contributions (
          id, name, phone_number, email, amount_rupees, entity_type, flow_stage,
          otp_hash, otp_expires_at, otp_attempts
        ) VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_otp', $7, $8, 0)`,
        [contributionId, nameNorm, phoneNorm, emailNorm, amount, entity, otpHash, expires],
      );
    }

    await client.query("COMMIT");
    return { contributionId, otp };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifySponsorOtp(email, otpInput) {
  const emailNorm = normalizeEmail(email);
  const otp = String(otpInput || "").replace(/\s/g, "");
  if (!emailNorm || otp.length !== 6) {
    const err = new Error("Invalid verification code");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await findPendingByEmail(client, emailNorm);
    if (!row) {
      const err = new Error("No pending sponsor contribution found for this email");
      err.status = 404;
      throw err;
    }
    if (row.flow_stage !== "awaiting_otp") {
      const err = new Error("This contribution is not awaiting email verification");
      err.status = 409;
      throw err;
    }
    if (!row.otp_expires_at || new Date(row.otp_expires_at) <= new Date()) {
      const err = new Error("Verification code expired. Request a new code.");
      err.status = 400;
      throw err;
    }
    if (row.otp_attempts >= MAX_OTP_ATTEMPTS) {
      const err = new Error("Too many failed attempts. Request a new verification code.");
      err.status = 429;
      throw err;
    }

    const expectedHash = row.otp_hash;
    const actualHash = hashSponsorOtp(row.id, otp);
    if (!expectedHash || expectedHash !== actualHash) {
      await client.query(
        `UPDATE sponsor_contributions SET otp_attempts = otp_attempts + 1, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await client.query("COMMIT");
      const err = new Error("Invalid verification code");
      err.status = 400;
      throw err;
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE sponsor_contributions
       SET flow_stage = 'awaiting_payment',
           otp_hash = NULL,
           otp_expires_at = NULL,
           otp_attempts = 0,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [row.id],
    );

    await client.query("COMMIT");
    const contribution = mapContributionRow(updatedRows[0]);
    return { contribution, contributionId: contribution.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSponsorCheckout(email) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) {
    const err = new Error("Email is required");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await findPendingByEmail(client, emailNorm);
    if (!row || row.flow_stage !== "awaiting_payment") {
      const err = new Error("Verify your email before continuing to payment");
      err.status = 403;
      throw err;
    }

    if (row.payment_session_id && row.provider === "cashfree") {
      await client.query("COMMIT");
      return {
        contributionId: row.id,
        provider: "cashfree",
        amount: row.amount_rupees * 100,
        currency: "INR",
        paymentSessionId: row.payment_session_id,
        cashfreeMode: publicCashfreeMode(),
        amountRupees: row.amount_rupees,
        name: row.name,
        email: row.email,
      };
    }

    const provider = cashfreeConfigured() ? "cashfree" : "manual";
    if (provider === "manual") {
      const err = new Error("Online payments are not configured. Contact organisers to complete your sponsorship.");
      err.status = 503;
      throw err;
    }

    const amountPaise = row.amount_rupees * 100;
    const cfOrder = await createCashfreeOrder({
      orderAmountPaise: amountPaise,
      currency: "INR",
      orderId: row.id,
      customer: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone_number || "9999999999",
      },
      returnUrl: sponsorReturnUrl(row.id),
      note: `sponsor:${row.id}`,
    });

    const providerOrderId = cfOrder?.order_id || row.id;
    const paymentSessionId = cfOrder?.payment_session_id || null;
    if (!paymentSessionId) {
      const err = new Error("Cashfree did not return a payment session");
      err.status = 502;
      throw err;
    }

    await client.query(
      `UPDATE sponsor_contributions
       SET provider = 'cashfree',
           provider_order_id = $2,
           payment_session_id = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, providerOrderId, paymentSessionId],
    );

    await client.query("COMMIT");

    logAction("payment", "sponsor.checkout_created", {
      contributionId: row.id,
      amountRupees: row.amount_rupees,
      email: row.email,
    });

    return {
      contributionId: row.id,
      provider: "cashfree",
      amount: amountPaise,
      currency: "INR",
      paymentSessionId,
      cashfreeMode: publicCashfreeMode(),
      amountRupees: row.amount_rupees,
      name: row.name,
      email: row.email,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function fulfillPaidSponsorContribution(contributionId, { paymentRef = null, paymentId = null } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(`SELECT * FROM sponsor_contributions WHERE id = $1 FOR UPDATE`, [
      contributionId,
    ]);
    const row = rows[0];
    if (!row) {
      const err = new Error("Sponsor contribution not found");
      err.status = 404;
      throw err;
    }
    if (row.flow_stage === "paid") {
      await client.query("COMMIT");
      return { ok: true, duplicate: true, contribution: mapContributionRow(row) };
    }

    const ref = paymentRef || paymentId || row.payment_ref || "";
    const { rows: updatedRows } = await client.query(
      `UPDATE sponsor_contributions
       SET flow_stage = 'paid',
           paid_at = NOW(),
           payment_ref = COALESCE(NULLIF($2, ''), payment_ref),
           otp_hash = NULL,
           otp_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [contributionId, ref],
    );

    await client.query("COMMIT");

    const contribution = mapContributionRow(updatedRows[0]);

    try {
      await sendSponsorPaymentConfirmedEmail({
        to: contribution.email,
        name: contribution.name,
        email: contribution.email,
        phoneNumber: contribution.phoneNumber,
        entityType: contribution.entityType,
        amountRupees: contribution.amountRupees,
        paymentRef: contribution.paymentRef,
        orderId: contribution.id,
        provider: contribution.provider,
        paidAt: contribution.paidAt,
      });
    } catch (err) {
      logError("email", "sponsor payment confirmed mail failed", err, { contributionId });
    }

    logAction("payment", "sponsor.paid", {
      contributionId,
      amountRupees: contribution.amountRupees,
      email: contribution.email,
    });

    return { ok: true, contribution };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reconcileSponsorContribution(contributionId) {
  if (!cashfreeConfigured()) return false;

  const { rows } = await pool.query(`SELECT * FROM sponsor_contributions WHERE id = $1`, [contributionId]);
  const row = rows[0];
  if (!row || row.flow_stage === "paid" || row.provider !== "cashfree") return false;

  const cfOrderId = row.provider_order_id || row.id;
  let cfOrder;
  try {
    cfOrder = await fetchCashfreeOrder(cfOrderId);
  } catch (err) {
    logError("payment", "sponsor reconcile fetch order failed", err, { contributionId });
    return false;
  }

  const orderStatus = String(cfOrder?.order_status || "").toUpperCase();
  if (orderStatus !== "PAID") return false;

  const paymentId = `cf-reconcile-${cfOrderId}`;
  await fulfillPaidSponsorContribution(contributionId, { paymentRef: paymentId, paymentId });
  logAction("payment", "sponsor.reconciled", { contributionId, cfOrderId });
  return true;
}

export async function getSponsorCheckoutStatus(contributionId) {
  try {
    await reconcileSponsorContribution(contributionId);
  } catch (err) {
    logError("payment", "sponsor reconcile failed", err, { contributionId });
  }

  const { rows } = await pool.query(`SELECT * FROM sponsor_contributions WHERE id = $1`, [contributionId]);
  const row = rows[0];
  if (!row) {
    const err = new Error("Sponsor contribution not found");
    err.status = 404;
    throw err;
  }

  const contribution = mapContributionRow(row);
  return {
    contributionId: contribution.id,
    status: contribution.flowStage === "paid" ? "paid" : contribution.flowStage,
    flowStage: contribution.flowStage,
    provider: contribution.provider,
    amount: contribution.amountRupees * 100,
    amountRupees: contribution.amountRupees,
    currency: "INR",
    paidAt: contribution.paidAt,
    name: contribution.name,
    email: contribution.email,
    entityType: contribution.entityType,
    createdAt: contribution.createdAt,
  };
}

export async function findSponsorContributionByProviderOrderId(providerOrderId) {
  if (!providerOrderId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM sponsor_contributions
     WHERE id::text = $1 OR provider_order_id = $1
     LIMIT 1`,
    [providerOrderId],
  );
  return rows[0] || null;
}
