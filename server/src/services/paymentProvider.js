import { env } from "../config/env.js";
import { cashfreeConfigured } from "./cashfreeService.js";

export function isManualPaymentMode() {
  return env.paymentMode === "manual";
}

export function manualUpiConfigured() {
  return Boolean(env.paymentUpiVpa?.trim());
}

export function assertCheckoutProviderAvailable() {
  const provider = resolveCheckoutProvider();
  if (provider === "cashfree") return provider;
  if (provider === "manual") {
    if (!manualUpiConfigured()) {
      const err = new Error("Manual UPI payments are not configured (set PAYMENT_UPI_VPA)");
      err.status = 503;
      err.code = "UPI_NOT_CONFIGURED";
      throw err;
    }
    return provider;
  }
  const err = new Error(
    "Payments are not configured. Set PAYMENT_MODE=manual with PAYMENT_UPI_VPA, or enable gateway mode with the required credentials.",
  );
  err.status = 503;
  err.code = "PAYMENT_UNAVAILABLE";
  throw err;
}

/** @returns {'cashfree' | 'manual'} */
export function resolveCheckoutProvider() {
  if (env.paymentMode === "manual") return "manual";
  if (env.paymentMode === "gateway") {
    if (cashfreeConfigured()) return "cashfree";
    return null;
  }
  if (cashfreeConfigured()) return "cashfree";
  return "manual";
}

export function publicPaymentFlags() {
  const provider = resolveCheckoutProvider();
  return {
    paymentMode: env.paymentMode,
    provider: provider || "unavailable",
    manualUpiConfigured: manualUpiConfigured(),
    manualMode: provider === "manual",
  };
}

export function allowSimulateManualPayment() {
  if (env.paymentAllowSimulate) return true;
  return env.nodeEnv !== "production" && isManualPaymentMode();
}
