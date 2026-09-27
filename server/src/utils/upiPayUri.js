import { env } from "../config/env.js";

const TN_MAX = 50;
const TR_MAX = 35;

export function sanitizeUpiTransactionRef(bpcId) {
  const raw = String(bpcId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return raw.slice(0, TR_MAX) || "BPC";
}

/**
 * @param {{
 *   vpa: string,
 *   payeeName?: string,
 *   amountRupees: number,
 *   transactionNote?: string,
 *   transactionRef?: string,
 * }}
 */
export function buildUpiPayUri({ vpa, payeeName = "BPC League", amountRupees, transactionNote = "", transactionRef = "" }) {
  const pa = String(vpa || "").trim();
  if (!pa) {
    const err = new Error("UPI VPA is not configured");
    err.status = 503;
    err.code = "UPI_NOT_CONFIGURED";
    throw err;
  }
  const amount = Math.max(0, Number(amountRupees));
  const params = new URLSearchParams();
  params.set("pa", pa);
  params.set("pn", String(payeeName || "BPC League").trim().slice(0, 99));
  params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  const tn = String(transactionNote || "").trim().slice(0, TN_MAX);
  const tr = String(transactionRef || "").trim().slice(0, TR_MAX);
  if (tn) params.set("tn", tn);
  if (tr) params.set("tr", tr);
  return `upi://pay?${params.toString()}`;
}

/**
 * @param {{ bpcId: string, orderType?: 'checkout' | 'upgrade' | 'sponsor' }}
 */
export function upiLabelsForOrder({ bpcId, orderType = "checkout" }) {
  const code = String(bpcId || "").trim().toUpperCase() || "BPC";
  const suffix =
    orderType === "upgrade" ? " UPGRADE" : orderType === "sponsor" ? " SPONSOR" : " REG";
  const tn = `${code}${suffix}`.trim().slice(0, TN_MAX);
  const tr = sanitizeUpiTransactionRef(code);
  return { tn, tr };
}

/**
 * @param {{ bpcId: string, amountRupees: number, orderType?: 'checkout' | 'upgrade' | 'sponsor' }}
 */
export function buildManualUpiPayload({ bpcId, amountRupees, orderType = "checkout" }) {
  const vpa = env.paymentUpiVpa;
  const payeeName = env.paymentUpiPayeeName;
  const { tn, tr } = upiLabelsForOrder({ bpcId, orderType });
  const uri = buildUpiPayUri({
    vpa,
    payeeName,
    amountRupees,
    transactionNote: tn,
    transactionRef: tr,
  });
  return {
    vpa,
    payeeName,
    amountRupees: Number(amountRupees),
    tn,
    tr,
    uri,
  };
}
