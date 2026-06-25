import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { syncRegistrationCapState } from "./registrationRepository.js";
import { env } from "../config/env.js";
import { eligibilityFromAccount } from "./playerAccountRepository.js";
import {
  createCashfreeOrder,
  cashfreeConfigured,
  publicCashfreeMode,
  verifyCashfreeWebhookSignature,
  fetchCashfreeOrder,
} from "./cashfreeService.js";
import {
  getCoinBalance,
  grantCoins,
  allocateBpcId,
} from "./playerAccountRepository.js";
import {
  getOrCreateCommerceConfig,
  publicCommerceConfig,
} from "./commerceConfigRepository.js";
import { resolveBundleLineItem, resolveUpgradeLineItem, getUpgradeableTiers, getHighestEnabledTier, tierRank, enrichCardTiers } from "./commerceBundle.js";
import { sendPaidRegistrationEmail } from "./emailService.js";
import { logAction, logError, logWarn } from "../utils/serverLogger.js";

export const CARD_TIERS = ["default", "player", "gold", "holo"];

const CHECKOUT_PENDING_TTL_MINUTES = 30;

function checkoutReturnUrl(orderId) {
  const base = env.appUrl.replace(/\/$/, "");
  return `${base}/dashboard/checkout/return?orderId=${encodeURIComponent(orderId)}`;
}

function rupeesToPaise(rupees) {
  return Math.max(0, Math.round(Number(rupees) * 100));
}

export async function loadCommerceConfig(tournamentId) {
  const row = await getOrCreateCommerceConfig(tournamentId);
  return publicCommerceConfig(row);
}

export function buildCheckoutLineItems(config, cardTier) {
  return [resolveBundleLineItem(config, cardTier)];
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

function assertProfileReadyForSubstitute(account) {
  const roles = Array.isArray(account.preferred_roles) ? account.preferred_roles : [];
  if (roles.length === 0) {
    const err = new Error("Select at least one preferred role before joining the substitute pool");
    err.status = 403;
    err.code = "PROFILE_INCOMPLETE";
    throw err;
  }
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
  const lineItems = buildCheckoutLineItems(commerce, cardTier);
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
    provider: cashfreeConfigured() ? "cashfree" : "manual",
  };
}

export async function getActiveSeasonTournamentId() {
  const { rows } = await pool.query(
    `SELECT tournament_id FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
  );
  return rows[0]?.tournament_id || null;
}

async function loadPaidActiveSeasonRegistration(client, playerAccountId) {
  const tournamentId = await getActiveSeasonTournamentId();
  if (!tournamentId) return null;

  const queryClient = client || pool;
  const { rows } = await queryClient.query(
    `SELECT r.*, t.slug AS tournament_slug, t.name AS tournament_name
     FROM player_registrations r
     JOIN tournaments t ON t.id = r.tournament_id
     WHERE r.tournament_id = $1
       AND r.player_account_id = $2
       AND r.archived_at IS NULL
       AND r.payment_status = 'paid'
       AND r.substitute_flag = FALSE
     LIMIT 1`,
    [tournamentId, playerAccountId],
  );
  return rows[0] || null;
}

function mapRegistrationForUpgrade(reg, commerce) {
  const currentTier = reg.card_tier || "default";
  const standard = commerce?.registrationFeeRupees ?? 300;
  const tiers = enrichCardTiers(commerce?.cardTiers, standard);
  const upgradeOptions = getUpgradeableTiers(commerce, currentTier);
  const highestTier = getHighestEnabledTier(commerce);
  const isMaxTier = tierRank(currentTier) >= tierRank(highestTier) || upgradeOptions.length === 0;
  return {
    id: reg.id,
    cardTier: currentTier,
    registrationStatus: reg.registration_status,
    tournament: {
      id: reg.tournament_id,
      slug: reg.tournament_slug,
      name: reg.tournament_name,
    },
    currentTierLabel: tiers[currentTier]?.label || currentTier,
    upgradeOptions,
    isMaxTier,
  };
}

export async function getUpgradeEligibility(account) {
  const reg = await loadPaidActiveSeasonRegistration(null, account.id);
  if (!reg) {
    return { eligible: false, reason: "no_active_season_registration" };
  }

  const commerce = await loadCommerceConfig(reg.tournament_id);
  const registration = mapRegistrationForUpgrade(reg, commerce);

  return {
    eligible: !registration.isMaxTier && registration.upgradeOptions.length > 0,
    commerce,
    registration,
    tournament: registration.tournament,
    currentTier: registration.cardTier,
    currentTierLabel: registration.currentTierLabel,
    upgradeOptions: registration.upgradeOptions,
    isMaxTier: registration.isMaxTier,
  };
}

async function assertUpgradeEligible(account, tournamentSlug, targetTier) {
  const tournament = await findTournamentBySlugOrId(tournamentSlug);
  if (!tournament) {
    const err = new Error("Tournament not found");
    err.status = 404;
    throw err;
  }

  const activeTournamentId = await getActiveSeasonTournamentId();
  if (!activeTournamentId || activeTournamentId !== tournament.id) {
    const err = new Error("Card upgrades are only available for the active season tournament");
    err.status = 403;
    err.code = "NOT_ACTIVE_SEASON";
    throw err;
  }

  const reg = await loadPaidActiveSeasonRegistration(null, account.id);
  if (!reg || reg.tournament_id !== tournament.id) {
    const err = new Error("Paid registration required for card upgrade");
    err.status = 403;
    err.code = "NOT_REGISTERED";
    throw err;
  }

  const commerce = await loadCommerceConfig(tournament.id);
  const currentTier = reg.card_tier || "default";
  const upgradeOptions = getUpgradeableTiers(commerce, currentTier);
  const validTarget = upgradeOptions.find((o) => o.tier === targetTier);

  if (!validTarget) {
    const err = new Error("Invalid upgrade tier");
    err.status = 400;
    err.code = "INVALID_UPGRADE_TIER";
    throw err;
  }

  return { tournament, registration: reg, commerce, currentTier, targetTier };
}

export function buildUpgradeLineItems(config, fromTier, toTier) {
  return [resolveUpgradeLineItem(config, fromTier, toTier)];
}

export async function previewUpgrade(account, tournamentSlug, body) {
  const targetTier = CARD_TIERS.includes(body.targetTier) ? body.targetTier : null;
  if (!targetTier) {
    const err = new Error("Target tier is required");
    err.status = 400;
    throw err;
  }

  const { tournament, currentTier, commerce } = await assertUpgradeEligible(account, tournamentSlug, targetTier);
  const lineItems = buildUpgradeLineItems(commerce, currentTier, targetTier);
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
    currentTier,
    targetTier,
    ...totals,
    coinBalance,
    provider: cashfreeConfigured() ? "cashfree" : "manual",
    orderType: "upgrade",
  };
}

export async function confirmUpgrade(account, tournamentSlug, body) {
  const targetTier = CARD_TIERS.includes(body.targetTier) ? body.targetTier : null;
  if (!targetTier) {
    const err = new Error("Target tier is required");
    err.status = 400;
    throw err;
  }

  const preview = await previewUpgrade(account, tournamentSlug, { ...body, targetTier });
  const { tournament, registration, currentTier } = await assertUpgradeEligible(
    account,
    tournamentSlug,
    targetTier,
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await expireStaleCheckoutOrders(client, tournament.id, account.id);

    const orderId = randomUUID();
    const provider = cashfreeConfigured() ? "cashfree" : "manual";

    const { rows: orderRows } = await client.query(
      `INSERT INTO checkout_orders (
        id, player_account_id, tournament_id, line_items, subtotal, coin_discount,
        total_paise, currency, provider, status, card_tier, coins_applied,
        order_type, upgrade_from_tier, registration_id
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 'pending', $10, $11, 'upgrade', $12, $13)
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
        preview.targetTier,
        preview.coinsApplied,
        currentTier,
        registration.id,
      ],
    );

    let paymentSessionId = null;
    let providerOrderId = null;

    if (provider === "cashfree") {
      const cfOrder = await createCashfreeOrder({
        orderAmountPaise: preview.totalPaise,
        currency: preview.currency,
        orderId,
        customer: {
          id: account.id,
          name: account.display_name || account.steam_persona || account.email?.split("@")[0] || "Player",
          email: account.email,
          phone: account.phone_number || "9999999999",
        },
        returnUrl: checkoutReturnUrl(orderId),
        note: `upgrade:tournament:${tournament.id}`,
      });
      providerOrderId = cfOrder?.order_id || orderId;
      paymentSessionId = cfOrder?.payment_session_id || null;
      if (!paymentSessionId) {
        const err = new Error("Cashfree did not return a payment session");
        err.status = 502;
        throw err;
      }
      await client.query(
        `UPDATE checkout_orders
         SET provider_order_id = $2, payment_session_id = $3, updated_at = NOW()
         WHERE id = $1`,
        [orderId, providerOrderId, paymentSessionId],
      );
    }

    await client.query("COMMIT");

    logAction("payment", "upgrade.order_created", {
      orderId,
      playerId: account.id,
      bpcId: account.bpc_id,
      tournamentId: tournament.id,
      provider,
      amountPaise: preview.totalPaise,
      targetTier,
      fromTier: currentTier,
    });

    return {
      orderId,
      provider,
      amount: preview.totalPaise,
      currency: preview.currency,
      paymentSessionId,
      cashfreeMode: publicCashfreeMode(),
      lineItems: preview.lineItems,
      coinDiscount: preview.coinDiscount,
      manualMode: provider === "manual",
      orderType: "upgrade",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function expireStaleCheckoutOrders(client, tournamentId, playerAccountId) {
  await client.query(
    `UPDATE checkout_orders
     SET status = 'expired', updated_at = NOW()
     WHERE tournament_id = $1 AND player_account_id = $2
       AND status = 'pending'
       AND created_at < NOW() - ($3::text || ' minutes')::interval`,
    [tournamentId, playerAccountId, String(CHECKOUT_PENDING_TTL_MINUTES)],
  );
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
    if (existing?.payment_status === "paid") {
      const err = new Error(
        existing.registration_status === "approved"
          ? "You are already registered for this tournament"
          : "Payment received — your registration is pending admin approval",
      );
      err.status = 409;
      throw err;
    }

    await expireStaleCheckoutOrders(client, tournament.id, account.id);

    const orderId = randomUUID();
    const provider = cashfreeConfigured() ? "cashfree" : "manual";

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

    let paymentSessionId = null;
    let providerOrderId = null;

    if (provider === "cashfree") {
      const cfOrder = await createCashfreeOrder({
        orderAmountPaise: preview.totalPaise,
        currency: preview.currency,
        orderId,
        customer: {
          id: account.id,
          name: account.display_name || account.steam_persona || account.email?.split("@")[0] || "Player",
          email: account.email,
          phone: account.phone_number || "9999999999",
        },
        returnUrl: checkoutReturnUrl(orderId),
        note: `tournament:${tournament.id}`,
      });
      providerOrderId = cfOrder?.order_id || orderId;
      paymentSessionId = cfOrder?.payment_session_id || null;
      if (!paymentSessionId) {
        const err = new Error("Cashfree did not return a payment session");
        err.status = 502;
        throw err;
      }
      await client.query(
        `UPDATE checkout_orders
         SET provider_order_id = $2, payment_session_id = $3, updated_at = NOW()
         WHERE id = $1`,
        [orderId, providerOrderId, paymentSessionId],
      );
    }

    await client.query("COMMIT");

    logAction("payment", "checkout.order_created", {
      orderId,
      playerId: account.id,
      bpcId: account.bpc_id,
      tournamentId: tournament.id,
      provider,
      amountPaise: preview.totalPaise,
      cardTier: body.cardTier || "default",
    });

    return {
      orderId,
      provider,
      amount: preview.totalPaise,
      currency: preview.currency,
      paymentSessionId,
      cashfreeMode: publicCashfreeMode(),
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

/**
 * Poll Cashfree for PAID status and fulfill locally (webhook fallback for localhost / delayed webhooks).
 */
export async function reconcileCashfreeCheckoutOrder(orderId, playerAccountId) {
  if (!cashfreeConfigured()) return false;

  const { rows } = await pool.query(
    `SELECT * FROM checkout_orders WHERE id = $1 AND player_account_id = $2`,
    [orderId, playerAccountId],
  );
  const order = rows[0];
  if (!order || order.status === "paid" || order.provider !== "cashfree") return false;

  const cfOrderId = order.provider_order_id || order.id;
  let cfOrder;
  try {
    cfOrder = await fetchCashfreeOrder(cfOrderId);
  } catch (err) {
    logError("payment", "cashfree reconcile fetch order failed", err, { orderId, playerAccountId });
    return false;
  }

  const orderStatus = String(cfOrder?.order_status || "").toUpperCase();
  if (orderStatus !== "PAID") return false;

  const paymentId = `cf-reconcile-${cfOrderId}`;
  await fulfillPaidCheckout({
    checkoutOrderId: order.id,
    paymentId,
    paymentProvider: "cashfree",
    paymentRef: paymentId,
  });
  logAction("payment", "checkout.reconciled", { orderId, playerAccountId, cfOrderId });
  return true;
}

export async function getCheckoutOrderStatus(orderId, playerAccountId) {
  try {
    await reconcileCashfreeCheckoutOrder(orderId, playerAccountId);
  } catch (err) {
    logError("payment", "cashfree reconcile failed", err, { orderId, playerAccountId });
  }

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
  paymentProvider = "cashfree",
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
        logWarn("payment", "checkout.duplicate_webhook", { checkoutOrderId, paymentId });
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
      logWarn("payment", "checkout.already_paid", {
        checkoutOrderId,
        registrationId: order.registration_id,
      });
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

    const isUpgrade = order.order_type === "upgrade";

    if (isUpgrade && !existing) {
      const err = new Error("Registration not found for upgrade order");
      err.status = 409;
      throw err;
    }

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
          'paid', 'pending', 'submitted', NOW(),
          $14, $15, $16, $17, NULL,
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
    } else if (isUpgrade) {
      registrationId = existing.id;
      await client.query(
        `UPDATE player_registrations
         SET card_tier = $2,
             checkout_order_id = $3,
             payment_provider = $4,
             payment_ref = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [
          registrationId,
          order.card_tier,
          order.id,
          paymentProvider,
          paymentRef || paymentId || "",
        ],
      );
    } else {
      registrationId = existing.id;
      await client.query(
        `UPDATE player_registrations
         SET payment_status = 'paid',
             registration_status = 'pending',
             registration_flow_stage = 'submitted',
             card_tier = $2,
             checkout_order_id = $3,
             payment_provider = $4,
             payment_ref = $5,
             location = COALESCE(NULLIF($6, ''), location),
             roles = CASE WHEN $7::jsonb <> '[]'::jsonb THEN $7::jsonb ELSE roles END,
             mmr = COALESCE($8, mmr),
             phone_number = COALESCE(NULLIF($9, ''), phone_number),
             auto_approved_at = NULL,
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

    if (order.card_tier && order.card_tier !== "default") {
      await ensurePendingCardAsset(order.player_account_id, {
        tier: order.card_tier,
        tournamentId: order.tournament_id,
      });
    }

    try {
      const { rows: tourRows } = await pool.query(`SELECT name FROM tournaments WHERE id = $1`, [order.tournament_id]);
      const { rows: regRows } = await pool.query(
        `SELECT email, name, public_code FROM player_registrations WHERE id = $1`,
        [registrationId],
      );
      const reg = regRows[0];
      const email = reg?.email || account?.email;
      if (email && !String(email).includes("@migrated.")) {
        const lineItems = Array.isArray(order.line_items)
          ? order.line_items
          : typeof order.line_items === "string"
            ? JSON.parse(order.line_items)
            : [];
        await sendPaidRegistrationEmail({
          to: email,
          name: reg?.name || account?.display_name || account?.steam_persona || "",
          tournamentName: tourRows[0]?.name || "BPC League — Bharat Pro Circuit League",
          publicCode: reg?.public_code || account?.bpc_id || "",
          lineItems,
          subtotal: order.subtotal,
          coinDiscount: order.coin_discount,
          coinsApplied: order.coins_applied,
          totalPaise: order.total_paise,
          cardTier: order.card_tier,
          bundleLabel: lineItems[0]?.label || lineItems[0]?.bundleLabel,
          paymentRef: paymentRef || paymentId || "",
          orderId: order.id,
          paidAt: new Date().toISOString(),
        });
      }
    } catch (emailErr) {
      logError("email", "paid registration mail failed", emailErr, { checkoutOrderId, registrationId });
    }

    logAction("payment", "checkout.fulfilled", {
      checkoutOrderId: order.id,
      registrationId,
      playerId: order.player_account_id,
      tournamentId: order.tournament_id,
      paymentProvider,
      paymentId,
      orderType: order.order_type || "checkout",
      cardTier: order.card_tier,
      totalPaise: order.total_paise,
    });

    return { ok: true, registrationId, orderId: order.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Dev/manual provider: simulate payment when Cashfree keys are absent. */
export async function simulateManualPayment(orderId, playerAccountId) {
  if (cashfreeConfigured() && env.nodeEnv === "production") {
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
    const err = new Error("This order uses Cashfree; complete payment via checkout");
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

export async function handleCashfreeWebhook(rawBody, signature, timestamp) {
  const verified = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
  let payload;
  try {
    payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    payload = {};
  }

  const eventType = payload?.type || payload?.event || "";
  const data = payload?.data || payload?.payload || {};
  const orderEntity = data?.order || {};
  const paymentEntity = data?.payment || {};
  const providerOrderId = orderEntity.order_id || paymentEntity.order_id || null;
  const paymentId = paymentEntity.cf_payment_id || paymentEntity.payment_id || null;
  const paymentStatus = String(paymentEntity.payment_status || orderEntity.order_status || "").toUpperCase();

  logAction("payment", "webhook.received", {
    eventType,
    paymentStatus,
    providerOrderId,
    paymentId,
    signatureVerified: verified,
  });

  const webhookId = randomUUID();
  await pool.query(
    `INSERT INTO payment_webhooks (id, provider, event_type, payment_id, order_id, signature_verified, payload)
     VALUES ($1, 'cashfree', $2, $3, $4, $5, $6::jsonb)`,
    [webhookId, eventType, paymentId, providerOrderId, verified, JSON.stringify(payload)],
  );

  if (!verified) {
    logWarn("payment", "webhook.invalid_signature", { eventType, providerOrderId });
    const err = new Error("Invalid webhook signature");
    err.status = 400;
    throw err;
  }

  const successEvents = new Set([
    "PAYMENT_SUCCESS_WEBHOOK",
    "PAYMENT_USER_CONFIRMED",
    "PAYMENT_CHARGES_WEBHOOK",
  ]);
  const isPaid =
    successEvents.has(eventType) ||
    paymentStatus === "SUCCESS" ||
    paymentStatus === "PAID" ||
    String(orderEntity.order_status || "").toUpperCase() === "PAID";

  if (!isPaid) {
    logAction("payment", "webhook.ignored", { eventType, paymentStatus, providerOrderId });
    return { ok: true, ignored: true, eventType, paymentStatus };
  }

  if (!providerOrderId) {
    logWarn("payment", "webhook.missing_order_id", { eventType, paymentStatus });
    return { ok: true, ignored: true, reason: "missing order id" };
  }

  const { rows } = await pool.query(
    `SELECT id FROM checkout_orders WHERE provider_order_id = $1 OR id::text = $1`,
    [providerOrderId],
  );
  const checkoutOrder = rows[0];
  if (!checkoutOrder) {
    logWarn("payment", "webhook.order_not_found", { providerOrderId, eventType });
    return { ok: true, ignored: true, reason: "checkout order not found" };
  }

  try {
    const result = await fulfillPaidCheckout({
      checkoutOrderId: checkoutOrder.id,
      paymentId,
      paymentProvider: "cashfree",
      paymentRef: paymentId,
    });
    await pool.query(`UPDATE payment_webhooks SET processed = TRUE WHERE id = $1`, [webhookId]);
    logAction("payment", "webhook.processed", {
      checkoutOrderId: checkoutOrder.id,
      providerOrderId,
      paymentId,
      eventType,
      duplicate: Boolean(result?.duplicate),
    });
    return { ok: true, ...result };
  } catch (error) {
    logError("payment", "webhook.processing_failed", error, {
      checkoutOrderId: checkoutOrder.id,
      providerOrderId,
      paymentId,
      eventType,
    });
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
  const capState = await syncRegistrationCapState(tournament.id);
  const registrationsOpen = capState.changed ? false : tournament.registrations_open === true;
  if (registrationsOpen || !capState.reached) {
    const err = new Error("Substitute signup opens once the player roster cap is full");
    err.status = 403;
    throw err;
  }
  assertEligibleForCheckout(account);

  const { rows: accountRows } = await pool.query(`SELECT * FROM player_accounts WHERE id = $1`, [account.id]);
  const freshAccount = accountRows[0];
  if (!freshAccount) {
    const err = new Error("Player account not found");
    err.status = 404;
    throw err;
  }
  assertProfileReadyForSubstitute(freshAccount);

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
  const displayName = freshAccount.display_name || freshAccount.steam_persona || freshAccount.email.split("@")[0];
  const regLocation = freshAccount.location || "";
  const regRoles = Array.isArray(freshAccount.preferred_roles) ? freshAccount.preferred_roles : [];
  const regMmr = freshAccount.mmr ?? null;
  const regPhone = freshAccount.phone_number || "";
  const notes = [body.notes, body.availability ? `Availability: ${body.availability}` : ""].filter(Boolean).join("\n");

  await pool.query(
    `INSERT INTO player_registrations (
      id, tournament_id, player_account_id, email, name, display_name,
      location, roles, mmr, steam_name, steam_profile, discord_handle, phone_number,
      payment_status, registration_status, registration_flow_stage, email_verified_at,
      substitute_flag, notes, public_code
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8::jsonb, $9, $10, $11, $12, $13,
      'unpaid', 'pending', 'submitted', NOW(),
      TRUE, $14, $15
    )`,
    [
      registrationId,
      tournament.id,
      freshAccount.id,
      freshAccount.email,
      displayName,
      displayName,
      regLocation,
      JSON.stringify(regRoles),
      regMmr,
      freshAccount.steam_persona || displayName,
      freshAccount.steam_profile || "",
      freshAccount.discord_username || "",
      regPhone,
      notes,
      freshAccount.bpc_id,
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

export async function upsertCardAsset(
  playerAccountId,
  { tier, assetUrl, tagline, manifestJson, seasonId, tournamentId, status },
) {
  const id = randomUUID();
  const nextStatus = status || "pending";
  const manifestPayload =
    manifestJson && typeof manifestJson === "object" ? JSON.stringify(manifestJson) : null;
  const { rows } = await pool.query(
    `INSERT INTO player_card_assets (
       id, player_account_id, tier, asset_url, tagline, manifest_json, season_id, tournament_id, status
     ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), $7, $8, $9)
     ON CONFLICT (player_account_id, tier)
     DO UPDATE SET
       asset_url = COALESCE(NULLIF(EXCLUDED.asset_url, ''), player_card_assets.asset_url),
       tagline = COALESCE(NULLIF(EXCLUDED.tagline, ''), player_card_assets.tagline),
       manifest_json = CASE WHEN EXCLUDED.manifest_json <> '{}'::jsonb THEN EXCLUDED.manifest_json ELSE player_card_assets.manifest_json END,
       season_id = COALESCE(EXCLUDED.season_id, player_card_assets.season_id),
       tournament_id = COALESCE(EXCLUDED.tournament_id, player_card_assets.tournament_id),
       status = CASE WHEN $9 = 'approved' THEN 'approved' ELSE player_card_assets.status END,
       approved_at = CASE WHEN $9 = 'approved' THEN NOW() ELSE player_card_assets.approved_at END,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      playerAccountId,
      tier,
      assetUrl || "",
      tagline || "",
      manifestPayload,
      seasonId || null,
      tournamentId || null,
      nextStatus,
    ],
  );
  return rows[0];
}

export async function ensurePendingCardAsset(playerAccountId, { tier, tournamentId }) {
  if (!tier || tier === "default") return null;
  const existing = await pool.query(
    `SELECT id FROM player_card_assets WHERE player_account_id = $1 AND tier = $2`,
    [playerAccountId, tier],
  );
  if (existing.rows[0]) return existing.rows[0];

  let seasonId = null;
  if (tournamentId) {
    const season = await pool.query(
      `SELECT id FROM seasons WHERE tournament_id = $1 ORDER BY number DESC LIMIT 1`,
      [tournamentId],
    );
    seasonId = season.rows[0]?.id || null;
  }

  return upsertCardAsset(playerAccountId, {
    tier,
    tournamentId,
    seasonId,
    status: "pending",
  });
}
