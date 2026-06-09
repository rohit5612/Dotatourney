import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { eligibilityFromAccount } from "./playerAccountRepository.js";
import {
  createRazorpayOrder,
  publicRazorpayKeyId,
  razorpayConfigured,
  verifyRazorpayWebhookSignature,
} from "./razorpayService.js";
import {
  getCoinBalance,
  grantCoins,
  allocateBpcId,
} from "./playerAccountRepository.js";
import {
  getOrCreateCommerceConfig,
  publicCommerceConfig,
  DEFAULT_CARD_TIERS,
} from "./commerceConfigRepository.js";

export const CARD_TIERS = ["default", "player", "gold", "holo"];

function rupeesToPaise(rupees) {
  return Math.max(0, Math.round(Number(rupees) * 100));
}

export async function loadCommerceConfig(tournamentId) {
  const row = await getOrCreateCommerceConfig(tournamentId);
  return publicCommerceConfig(row);
}

export function buildCheckoutLineItems(config, cardTier, { bundled = true } = {}) {
  const tier = CARD_TIERS.includes(cardTier) ? cardTier : "default";
  const tiers = config?.cardTiers || DEFAULT_CARD_TIERS;
  const regFee = config?.registrationFeeRupees ?? 300;
  const items = [{ key: "registration", label: "Registration fee", amount: regFee }];
  if (tier !== "default") {
    const tierConfig = tiers[tier];
    if (tierConfig?.enabled !== false) {
      const amount = bundled ? (tierConfig?.bundledPriceRupees ?? 0) : (tierConfig?.bundledPriceRupees ?? 0);
      items.push({
        key: `card_${tier}`,
        label: tierConfig?.label || `${tier} card upgrade`,
        amount,
      });
    }
  }
  return items;
}

export function computeCheckoutTotals(lineItems, coinBalance, coinsToApply = null, minCashRupees = 100) {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const maxCoinsApplicable = Math.max(0, subtotal - minCashRupees);
  const requested = coinsToApply == null ? Math.min(coinBalance, maxCoinsApplicable) : Number(coinsToApply);
  const coinDiscount = Math.min(Math.max(0, requested), coinBalance, maxCoinsApplicable);
  const totalRupees = Math.max(minCashRupees, subtotal - coinDiscount);
  return {
    lineItems,
    subtotal,
    coinDiscount,
    coinsApplied: coinDiscount,
    maxCoinsApplicable,
    totalRupees,
    totalPaise: rupeesToPaise(totalRupees),
    currency: "INR",
  };
}

export async function findTournamentBySlugOrId(slug) {
  const key = String(slug || "").trim();
  if (!key) return null;
  const { rows } = await pool.query(
    `SELECT * FROM tournaments
     WHERE lower(slug) = lower($1) OR id::text = $1
     LIMIT 1`,
    [key],
  );
  return rows[0] || null;
}

function assertEligibleForCheckout(account) {
  const eligibility = eligibilityFromAccount(account);
  if (!eligibility.eligibleForRegistration) {
    const err = new Error("Complete email verification and link Steam + Discord before registering");
    err.status = 403;
    err.code = "NOT_ELIGIBLE";
    throw err;
  }
  return eligibility;
}

export async function previewCheckout(account, tournamentSlug, body) {
  const tournament = await findTournamentBySlugOrId(tournamentSlug);
  if (!tournament) {
    const err = new Error("Tournament not found");
    err.status = 404;
    throw err;
  }
  if (tournament.registrations_open !== true) {
    const err = new Error("Registration is closed for this tournament");
    err.status = 403;
    throw err;
  }
  assertEligibleForCheckout(account);

  const commerce = await loadCommerceConfig(tournament.id);
  const cardTier = CARD_TIERS.includes(body.cardTier) ? body.cardTier : "default";
  const lineItems = buildCheckoutLineItems(commerce, cardTier, { bundled: true });
  const coinBalance = await getCoinBalance(account.id);
  const totals = computeCheckoutTotals(
    lineItems,
    coinBalance,
    body.coinsToApply,
    commerce?.minCashRupees ?? 100,
  );

  return {
    tournament: { id: tournament.id, slug: tournament.slug, name: tournament.name },
    commerce,
    cardTier,
    ...totals,
    coinBalance,
    provider: razorpayConfigured() ? "razorpay" : "manual",
  };
}

async function findActiveRegistration(client, tournamentId, playerAccountId) {
  const { rows } = await client.query(
    `SELECT * FROM player_registrations
     WHERE tournament_id = $1 AND player_account_id = $2 AND archived_at IS NULL
     LIMIT 1`,
    [tournamentId, playerAccountId],
  );
  return rows[0] || null;
}

export async function confirmCheckout(account, tournamentSlug, body) {
  const registrationDetails = body.registrationDetails || null;
  const preview = await previewCheckout(account, tournamentSlug, body);
  const tournament = await findTournamentBySlugOrId(tournamentSlug);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await findActiveRegistration(client, tournament.id, account.id);
    if (existing && existing.payment_status === "paid" && existing.registration_status === "approved") {
      const err = new Error("You are already registered for this tournament");
      err.status = 409;
      throw err;
    }

    const orderId = randomUUID();
    const provider = razorpayConfigured() ? "razorpay" : "manual";

    const { rows: orderRows } = await client.query(
      `INSERT INTO checkout_orders (
        id, player_account_id, tournament_id, line_items, subtotal, coin_discount,
        total_paise, currency, provider, status, card_tier, coins_applied
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 'pending', $10, $11)
      RETURNING *`,
      [
        orderId,
        account.id,
        tournament.id,
        JSON.stringify(preview.lineItems),
        preview.subtotal,
        preview.coinDiscount,
        preview.totalPaise,
        preview.currency,
        provider,
        preview.cardTier,
        preview.coinsApplied,
      ],
    );
    const order = orderRows[0];

    let razorpayOrderId = null;
    let keyId = publicRazorpayKeyId();

    if (provider === "razorpay") {
      const rzOrder = await createRazorpayOrder({
        amount: preview.totalPaise,
        currency: preview.currency,
        receipt: orderId,
        notes: {
          tournament_id: tournament.id,
          player_account_id: account.id,
          card_tier: preview.cardTier,
        },
      });
      razorpayOrderId = rzOrder.id;
      await client.query(`UPDATE checkout_orders SET razorpay_order_id = $2, updated_at = NOW() WHERE id = $1`, [
        orderId,
        razorpayOrderId,
      ]);
    }

    await client.query("COMMIT");

    return {
      orderId,
      provider,
      amount: preview.totalPaise,
      currency: preview.currency,
      keyId,
      razorpayOrderId,
      lineItems: preview.lineItems,
      coinDiscount: preview.coinDiscount,
      manualMode: provider === "manual",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCheckoutOrderStatus(orderId, playerAccountId) {
  const { rows } = await pool.query(
    `SELECT id, status, provider, total_paise, currency, card_tier, paid_at, registration_id, created_at
     FROM checkout_orders
     WHERE id = $1 AND ($2::uuid IS NULL OR player_account_id = $2)`,
    [orderId, playerAccountId || null],
  );
  const order = rows[0];
  if (!order) {
    const err = new Error("Checkout order not found");
    err.status = 404;
    throw err;
  }
  return {
    orderId: order.id,
    status: order.status,
    provider: order.provider,
    amount: order.total_paise,
    currency: order.currency,
    cardTier: order.card_tier,
    paidAt: order.paid_at,
    registrationId: order.registration_id,
    createdAt: order.created_at,
  };
}

/**
 * Mark checkout paid, create/update registration, deduct coins. Idempotent by paymentId.
 */
export async function fulfillPaidCheckout({
  checkoutOrderId,
  paymentId = null,
  paymentProvider = "razorpay",
  paymentRef = null,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (paymentId) {
      const dup = await client.query(`SELECT id FROM payment_webhooks WHERE payment_id = $1 AND processed = TRUE`, [
        paymentId,
      ]);
      if (dup.rows.length) {
        await client.query("COMMIT");
        return { ok: true, duplicate: true };
      }
    }

    const { rows: orderRows } = await client.query(`SELECT * FROM checkout_orders WHERE id = $1 FOR UPDATE`, [
      checkoutOrderId,
    ]);
    const order = orderRows[0];
    if (!order) {
      const err = new Error("Checkout order not found");
      err.status = 404;
      throw err;
    }
    if (order.status === "paid") {
      await client.query("COMMIT");
      return { ok: true, duplicate: true, registrationId: order.registration_id };
    }

    const { rows: accountRows } = await client.query(`SELECT * FROM player_accounts WHERE id = $1`, [
      order.player_account_id,
    ]);
    const account = accountRows[0];

    let registrationId = order.registration_id;
    let existing = registrationId
      ? (await client.query(`SELECT * FROM player_registrations WHERE id = $1`, [registrationId])).rows[0]
      : await findActiveRegistration(client, order.tournament_id, order.player_account_id);

    const regLocation = account.location || "";
    const regRoles = Array.isArray(account.preferred_roles) ? account.preferred_roles : [];
    const regMmr = account.mmr ?? null;
    const regPhone = account.phone_number || "";

    if (!existing) {
      registrationId = randomUUID();
      const bpcId = account.bpc_id || (await allocateBpcId(client));
      const displayName = account.display_name || account.steam_persona || account.email.split("@")[0];
      await client.query(
        `INSERT INTO player_registrations (
          id, tournament_id, player_account_id, email, name, display_name,
          location, roles, mmr, steam_name, steam_profile, discord_handle, phone_number,
          payment_status, registration_status, registration_flow_stage, email_verified_at,
          card_tier, checkout_order_id, payment_provider, payment_ref, auto_approved_at,
          public_code, substitute_flag
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8::jsonb, $9, $10, $11, $12, $13,
          'paid', 'approved', 'submitted', NOW(),
          $14, $15, $16, $17, NOW(),
          $18, FALSE
        )`,
        [
          registrationId,
          order.tournament_id,
          account.id,
          account.email,
          displayName,
          displayName,
          regLocation,
          JSON.stringify(regRoles),
          regMmr,
          account.steam_persona || displayName,
          account.steam_profile || "",
          account.discord_username || "",
          regPhone,
          order.card_tier,
          order.id,
          paymentProvider,
          paymentRef || paymentId || "",
          bpcId,
        ],
      );
    } else {
      registrationId = existing.id;
      await client.query(
        `UPDATE player_registrations
         SET payment_status = 'paid',
             registration_status = 'approved',
             registration_flow_stage = 'submitted',
             card_tier = $2,
             checkout_order_id = $3,
             payment_provider = $4,
             payment_ref = $5,
             location = COALESCE(NULLIF($6, ''), location),
             roles = CASE WHEN $7::jsonb <> '[]'::jsonb THEN $7::jsonb ELSE roles END,
             mmr = COALESCE($8, mmr),
             phone_number = COALESCE(NULLIF($9, ''), phone_number),
             auto_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          registrationId,
          order.card_tier,
          order.id,
          paymentProvider,
          paymentRef || paymentId || "",
          regLocation,
          JSON.stringify(regRoles),
          regMmr,
          regPhone,
        ],
      );
    }

    if (order.coins_applied > 0) {
      await grantCoins(
        {
          playerAccountId: order.player_account_id,
          delta: -order.coins_applied,
          reason: `Checkout ${order.id}`,
          tournamentId: order.tournament_id,
        },
        client,
      );
    }

    await client.query(
      `UPDATE checkout_orders
       SET status = 'paid', paid_at = NOW(), registration_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [order.id, registrationId],
    );

    await client.query("COMMIT");
    return { ok: true, registrationId, orderId: order.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Dev/manual provider: simulate payment when Razorpay keys are absent. */
export async function simulateManualPayment(orderId, playerAccountId) {
  if (razorpayConfigured() && env.nodeEnv === "production") {
    const err = new Error("Manual payment simulation is disabled in production");
    err.status = 403;
    throw err;
  }
  const { rows } = await pool.query(
    `SELECT * FROM checkout_orders WHERE id = $1 AND player_account_id = $2`,
    [orderId, playerAccountId],
  );
  const order = rows[0];
  if (!order) {
    const err = new Error("Checkout order not found");
    err.status = 404;
    throw err;
  }
  if (order.provider !== "manual") {
    const err = new Error("This order uses Razorpay; complete payment via checkout");
    err.status = 400;
    throw err;
  }
  return fulfillPaidCheckout({
    checkoutOrderId: orderId,
    paymentId: `manual-${orderId}`,
    paymentProvider: "manual",
    paymentRef: `manual-${orderId}`,
  });
}

export async function handleRazorpayWebhook(rawBody, signature) {
  const verified = verifyRazorpayWebhookSignature(rawBody, signature);
  let payload;
  try {
    payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    payload = {};
  }

  const eventType = payload?.event || "";
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const paymentId = paymentEntity.id || null;
  const orderId = paymentEntity.order_id || payload?.payload?.order?.entity?.id || null;

  const webhookId = randomUUID();
  await pool.query(
    `INSERT INTO payment_webhooks (id, provider, event_type, payment_id, order_id, signature_verified, payload)
     VALUES ($1, 'razorpay', $2, $3, $4, $5, $6::jsonb)`,
    [webhookId, eventType, paymentId, orderId, verified, JSON.stringify(payload)],
  );

  if (!verified) {
    const err = new Error("Invalid webhook signature");
    err.status = 400;
    throw err;
  }

  if (eventType !== "payment.captured") {
    return { ok: true, ignored: true, eventType };
  }

  if (!orderId) {
    return { ok: true, ignored: true, reason: "missing order id" };
  }

  const { rows } = await pool.query(`SELECT id FROM checkout_orders WHERE razorpay_order_id = $1`, [orderId]);
  const checkoutOrder = rows[0];
  if (!checkoutOrder) {
    return { ok: true, ignored: true, reason: "checkout order not found" };
  }

  try {
    const result = await fulfillPaidCheckout({
      checkoutOrderId: checkoutOrder.id,
      paymentId,
      paymentProvider: "razorpay",
      paymentRef: paymentId,
    });
    await pool.query(`UPDATE payment_webhooks SET processed = TRUE WHERE id = $1`, [webhookId]);
    return { ok: true, ...result };
  } catch (error) {
    await pool.query(`UPDATE payment_webhooks SET error_message = $2 WHERE id = $1`, [
      webhookId,
      error.message || "processing failed",
    ]);
    throw error;
  }
}

export async function createSubstituteSignup(account, tournamentSlug, body) {
  const tournament = await findTournamentBySlugOrId(tournamentSlug);
  if (!tournament) {
    const err = new Error("Tournament not found");
    err.status = 404;
    throw err;
  }
  if (tournament.registrations_open === true) {
    const err = new Error("Substitute signup is only available when registration is closed");
    err.status = 403;
    throw err;
  }
  assertEligibleForCheckout(account);

  const existing = await pool.query(
    `SELECT id FROM player_registrations
     WHERE tournament_id = $1 AND player_account_id = $2 AND archived_at IS NULL`,
    [tournament.id, account.id],
  );
  if (existing.rows.length) {
    const err = new Error("You already have a registration for this tournament");
    err.status = 409;
    throw err;
  }

  const registrationId = randomUUID();
  const displayName = account.display_name || account.steam_persona || account.email.split("@")[0];
  const notes = [body.notes, body.availability ? `Availability: ${body.availability}` : ""].filter(Boolean).join("\n");

  await pool.query(
    `INSERT INTO player_registrations (
      id, tournament_id, player_account_id, email, name, display_name,
      location, roles, mmr, steam_name, steam_profile, discord_handle, phone_number,
      payment_status, registration_status, registration_flow_stage, email_verified_at,
      substitute_flag, notes, public_code
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      '', $7::jsonb, $8, $9, $10, $11, $12,
      'unpaid', 'pending', 'submitted', NOW(),
      TRUE, $13, $14
    )`,
    [
      registrationId,
      tournament.id,
      account.id,
      account.email,
      displayName,
      displayName,
      JSON.stringify(body.roles || []),
      body.mmr ?? null,
      account.steam_persona || displayName,
      account.steam_profile || "",
      account.discord_username || "",
      account.phone_number || "",
      notes,
      account.bpc_id,
    ],
  );

  return {
    registrationId,
    tournament: { id: tournament.id, slug: tournament.slug, name: tournament.name },
    substitute: true,
  };
}

export async function getPlayerCoinsLedger(playerAccountId, { limit = 20 } = {}) {
  const balance = await getCoinBalance(playerAccountId);
  const { rows } = await pool.query(
    `SELECT id, delta, balance_after, reason, tournament_id, granted_by_admin_id, created_at
     FROM bpc_coin_ledger
     WHERE player_account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [playerAccountId, Math.min(Math.max(1, limit), 100)],
  );
  return {
    balance,
    ledger: rows.map((row) => ({
      id: row.id,
      delta: row.delta,
      balanceAfter: row.balance_after,
      reason: row.reason,
      tournamentId: row.tournament_id,
      grantedByAdminId: row.granted_by_admin_id,
      createdAt: row.created_at,
    })),
  };
}

export async function adminGrantCoins(adminUserId, playerAccountId, { delta, reason }) {
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0) {
    const err = new Error("delta must be a non-zero integer");
    err.status = 400;
    throw err;
  }
  const account = await pool.query(`SELECT id FROM player_accounts WHERE id = $1`, [playerAccountId]);
  if (!account.rows[0]) {
    const err = new Error("Player account not found");
    err.status = 404;
    throw err;
  }
  const entry = await grantCoins({
    playerAccountId,
    delta: amount,
    reason: reason || "Admin grant",
    grantedByAdminId: adminUserId,
  });
  return entry;
}

export async function upsertCardAsset(playerAccountId, { tier, assetUrl, tagline }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO player_card_assets (id, player_account_id, tier, asset_url, tagline, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (player_account_id, tier)
     DO UPDATE SET asset_url = EXCLUDED.asset_url, tagline = EXCLUDED.tagline,
                   status = 'pending', updated_at = NOW()
     RETURNING *`,
    [id, playerAccountId, tier, assetUrl || "", tagline || ""],
  );
  return rows[0];
}
