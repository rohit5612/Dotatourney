/**
 * Manually reconcile a Cashfree checkout order that is PAID at Cashfree but still pending locally.
 *
 * Usage:
 *   node scripts/reconcile-checkout-order.js <orderId> <playerAccountId>
 *
 * Example (BPC-185):
 *   node scripts/reconcile-checkout-order.js 1345c2df-697d-4085-8a58-e8403d2cc562 7507608b-9ab3-44dd-83bb-2aa2aa7bcbf7
 */
import { pool } from "../src/db/pool.js";
import { reconcileCashfreeCheckoutOrder, getCheckoutOrderStatus } from "../src/services/paymentService.js";

const [orderId, playerAccountId] = process.argv.slice(2);

if (!orderId || !playerAccountId) {
  console.error("Usage: node scripts/reconcile-checkout-order.js <orderId> <playerAccountId>");
  process.exit(1);
}

try {
  const fulfilled = await reconcileCashfreeCheckoutOrder(orderId, playerAccountId);
  const status = await getCheckoutOrderStatus(orderId, playerAccountId);
  console.log(JSON.stringify({ fulfilled, status }, null, 2));
  process.exit(fulfilled || status.status === "paid" ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
