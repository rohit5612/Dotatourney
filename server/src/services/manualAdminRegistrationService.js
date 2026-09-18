import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { verifyPassword } from "./authService.js";
import { findAccountById, allocateBpcId } from "./playerAccountRepository.js";
import {
  buildCheckoutLineItems,
  ensurePendingCardAsset,
  loadCommerceConfig,
  registrationTextFields,
} from "./paymentService.js";
import { sendManualAdminRegistrationEmail } from "./emailService.js";
import { logAction, logError } from "../utils/serverLogger.js";

function rupeesToPaise(rupees) {
  return Math.max(0, Math.round(Number(rupees) * 100));
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

export async function createManualAdminRegistration({
  tournamentId,
  seasonId,
  playerAccountId,
  cardTier,
  amountRupees,
  offlinePaymentAccount,
  superadminPassword,
  adminUser,
}) {
  if (!adminUser || adminUser.role !== "superadmin") {
    const err = new Error("Superadmin access required");
    err.status = 403;
    throw err;
  }
  if (!verifyPassword(superadminPassword, adminUser.password_hash)) {
    const err = new Error("Incorrect superadmin password");
    err.status = 403;
    throw err;
  }

  const account = await findAccountById(playerAccountId);
  if (!account) {
    const err = new Error("Player account not found");
    err.status = 404;
    throw err;
  }

  const { rows: tourRows } = await pool.query(`SELECT id, name, slug FROM tournaments WHERE id = $1`, [tournamentId]);
  const tournament = tourRows[0];
  if (!tournament) {
    const err = new Error("Tournament not found");
    err.status = 404;
    throw err;
  }

  if (seasonId) {
    const { rows: seasonRows } = await pool.query(`SELECT id, tournament_id FROM seasons WHERE id = $1`, [seasonId]);
    const season = seasonRows[0];
    if (!season) {
      const err = new Error("Season not found");
      err.status = 404;
      throw err;
    }
    if (season.tournament_id !== tournamentId) {
      const err = new Error("Season does not match the selected tournament");
      err.status = 400;
      throw err;
    }
  }

  const commerce = await loadCommerceConfig(tournamentId);
  const tier = ["default", "player", "gold", "holo"].includes(cardTier) ? cardTier : "default";
  const lineItems = buildCheckoutLineItems(commerce, tier);
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPaise = rupeesToPaise(amountRupees);
  const paymentRef = String(offlinePaymentAccount || "").trim();
  if (!paymentRef) {
    const err = new Error("Account number or UPI ID is required for tracking");
    err.status = 400;
    throw err;
  }

  const {
    displayName,
    regLocation: location,
    regRoles: roles,
    regMmr: mmr,
    regPhone: phone,
    steamName,
    steamProfile,
    discordHandle,
  } = registrationTextFields(account);

  const client = await pool.connect();
  let registrationId;
  let orderId;
  let publicCode;

  try {
    await client.query("BEGIN");

    const existing = await findActiveRegistration(client, tournamentId, playerAccountId);
    if (existing?.payment_status === "paid" && existing.registration_status === "approved") {
      const err = new Error("Player is already approved for this tournament");
      err.status = 409;
      throw err;
    }

    orderId = randomUUID();
    await client.query(
      `INSERT INTO checkout_orders (
        id, player_account_id, tournament_id, line_items, subtotal, coin_discount,
        total_paise, currency, provider, status, card_tier, coins_applied, paid_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, 0, $6, 'INR', 'offline_admin', 'paid', $7, 0, NOW())`,
      [
        orderId,
        playerAccountId,
        tournamentId,
        JSON.stringify(lineItems),
        subtotal,
        totalPaise,
        tier,
      ],
    );

    const adminNoteLine = `[Manual registration by ${adminUser.email}] Offline ₹${Number(amountRupees).toLocaleString("en-IN")} · ${paymentRef}`;

    if (!existing) {
      registrationId = randomUUID();
      const bpcId = account.bpc_id || (await allocateBpcId(client));
      publicCode = bpcId;
      await client.query(
        `INSERT INTO player_registrations (
          id, tournament_id, player_account_id, email, name, display_name,
          location, roles, mmr, steam_name, steam_profile, discord_handle, phone_number,
          payment_status, registration_status, registration_flow_stage, email_verified_at,
          card_tier, checkout_order_id, payment_provider, payment_ref, auto_approved_at,
          public_code, substitute_flag, admin_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8::jsonb, $9, $10, $11, $12, $13,
          'paid', 'pending', 'submitted', NOW(),
          $14, $15, 'offline_admin', $16, NULL,
          $17, FALSE, $18
        )`,
        [
          registrationId,
          tournamentId,
          account.id,
          String(account.email || ""),
          displayName,
          displayName,
          location,
          JSON.stringify(roles),
          mmr,
          steamName,
          steamProfile,
          discordHandle,
          phone,
          tier,
          orderId,
          paymentRef,
          bpcId,
          adminNoteLine,
        ],
      );
    } else {
      registrationId = existing.id;
      publicCode = existing.public_code;
      await client.query(
        `UPDATE player_registrations
         SET payment_status = 'paid',
             registration_status = 'pending',
             registration_flow_stage = 'submitted',
             card_tier = $2,
             checkout_order_id = $3,
             payment_provider = 'offline_admin',
             payment_ref = $4,
             location = COALESCE(NULLIF($5, ''), location),
             roles = CASE WHEN $6::jsonb <> '[]'::jsonb THEN $6::jsonb ELSE roles END,
             mmr = COALESCE($7, mmr),
             phone_number = COALESCE(NULLIF($8, ''), phone_number),
             steam_name = COALESCE(NULLIF($9, ''), steam_name),
             steam_profile = COALESCE(NULLIF($10, ''), steam_profile),
             auto_approved_at = NULL,
             admin_notes = CASE
               WHEN admin_notes IS NULL OR admin_notes = '' THEN $11
               ELSE admin_notes || E'\\n' || $11
             END,
             updated_at = NOW()
         WHERE id = $1`,
        [
          registrationId,
          tier,
          orderId,
          paymentRef,
          location,
          JSON.stringify(roles),
          mmr,
          phone,
          steamName,
          steamProfile,
          adminNoteLine,
        ],
      );
    }

    await client.query(`UPDATE checkout_orders SET registration_id = $2, updated_at = NOW() WHERE id = $1`, [
      orderId,
      registrationId,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (tier && tier !== "default") {
    await ensurePendingCardAsset(playerAccountId, { tier, tournamentId });
  }

  const { syncPlayerActiveSeasonCardSnapshot } = await import("./cardSnapshotService.js");
  await syncPlayerActiveSeasonCardSnapshot(playerAccountId, { tournamentId }).catch(() => {});

  const email = account.email;
  if (email && !String(email).includes("@migrated.")) {
    try {
      const bundleLabel = lineItems[0]?.label || lineItems[0]?.bundleLabel;
      await sendManualAdminRegistrationEmail({
        to: email,
        name: displayName || account.steam_persona || "",
        tournamentName: tournament.name,
        publicCode,
        lineItems,
        subtotal,
        totalPaise,
        cardTier: tier,
        bundleLabel,
        offlinePaymentAccount: paymentRef,
        orderId,
        paidAt: new Date().toISOString(),
      });
    } catch (emailErr) {
      logError("email", "manual registration mail failed", emailErr, { registrationId, tournamentId });
    }
  }

  logAction("registration", "manual_admin.create", {
    registrationId,
    tournamentId,
    playerAccountId,
    adminId: adminUser.id,
    cardTier: tier,
    amountRupees,
  });

  const { rows: regRows } = await pool.query(`SELECT * FROM player_registrations WHERE id = $1`, [registrationId]);
  return { registration: regRows[0], tournamentId, orderId };
}
