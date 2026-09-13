/**
 * Reconcile pending Cashfree checkout orders for a player (by BPC ID).
 * Use when Cashfree shows PAID but the site never fulfilled (no CRM row / no receipt email).
 *
 * Usage (from server/ on prod, with .env loaded):
 *   node scripts/reconcile-checkout-by-bpc.js BPC-185
 *   node scripts/reconcile-checkout-by-bpc.js 185
 *   node scripts/reconcile-checkout-by-bpc.js BPC-185 --all
 *
 * Default: reconciles the most recent pending Cashfree order only.
 * --all: reconciles every pending Cashfree order for that player.
 */
import { pool } from "../src/db/pool.js";
import { findAccountByBpcId, formatBpcId } from "../src/services/playerAccountRepository.js";
import { reconcileCashfreeCheckoutOrder, getCheckoutOrderStatus } from "../src/services/paymentService.js";

const args = process.argv.slice(2).filter((a) => a !== "--all");
const reconcileAll = process.argv.includes("--all");
const bpcArg = args[0];

if (!bpcArg) {
  console.error("Usage: node scripts/reconcile-checkout-by-bpc.js <BPC-id> [--all]");
  console.error("Example: node scripts/reconcile-checkout-by-bpc.js BPC-185");
  process.exit(1);
}

async function resolveAccount(bpcInput) {
  const raw = String(bpcInput).trim();
  let account = await findAccountByBpcId(raw);
  if (account) return account;
  if (/^\d+$/.test(raw)) {
    account = await findAccountByBpcId(formatBpcId(Number(raw)));
  }
  return account;
}

try {
  const account = await resolveAccount(bpcArg);
  if (!account) {
    console.error(`No player account found for BPC id: ${bpcArg}`);
    process.exit(1);
  }

  const { rows: orders } = await pool.query(
    `SELECT id, status, provider, total_paise, card_tier, created_at
     FROM checkout_orders
     WHERE player_account_id = $1
       AND provider = 'cashfree'
       AND status = 'pending'
     ORDER BY created_at DESC`,
    [account.id],
  );

  if (!orders.length) {
    console.log(
      JSON.stringify(
        {
          bpcId: account.bpc_id,
          playerId: account.id,
          email: account.email,
          message: "No pending Cashfree checkout orders for this player.",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const targets = reconcileAll ? orders : [orders[0]];
  const results = [];

  for (const order of targets) {
    let fulfilled = false;
    let status = null;
    let error = null;
    try {
      fulfilled = await reconcileCashfreeCheckoutOrder(order.id, account.id);
      status = await getCheckoutOrderStatus(order.id, account.id);
    } catch (err) {
      error = err.message || String(err);
    }
    results.push({
      orderId: order.id,
      createdAt: order.created_at,
      amountPaise: order.total_paise,
      cardTier: order.card_tier,
      fulfilled,
      status,
      error,
    });
  }

  const anyPaid = results.some((r) => r.fulfilled || r.status?.status === "paid");
  console.log(
    JSON.stringify(
      {
        bpcId: account.bpc_id,
        playerId: account.id,
        email: account.email,
        pendingOrdersFound: orders.length,
        reconciled: results,
      },
      null,
      2,
    ),
  );
  process.exit(anyPaid ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
