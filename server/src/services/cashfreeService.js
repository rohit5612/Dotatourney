import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const API_VERSION = "2023-08-01";

export function cashfreeConfigured() {
  return Boolean(env.cashfreeClientId && env.cashfreeClientSecret);
}

function cashfreeBaseUrl() {
  return env.cashfreeEnv === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
}

function cashfreeHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": env.cashfreeClientId,
    "x-client-secret": env.cashfreeClientSecret,
  };
}

/**
 * @param {{
 *   orderAmountPaise: number,
 *   currency?: string,
 *   orderId: string,
 *   customer: { id: string, name?: string, email?: string, phone?: string },
 *   returnUrl?: string,
 *   note?: string,
 * }}
 */
export async function createCashfreeOrder({
  orderAmountPaise,
  currency = "INR",
  orderId,
  customer,
  returnUrl,
  note = "",
}) {
  if (!cashfreeConfigured()) {
    return null;
  }

  const orderAmount = Number((orderAmountPaise / 100).toFixed(2));
  const response = await fetch(`${cashfreeBaseUrl()}/pg/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_amount: orderAmount,
      order_currency: currency,
      order_id: orderId,
      customer_details: {
        customer_id: customer.id,
        customer_name: customer.name || "Player",
        customer_email: customer.email || "",
        customer_phone: customer.phone || "9999999999",
      },
      order_meta: returnUrl ? { return_url: returnUrl } : undefined,
      order_note: note || undefined,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(
      body?.message || body?.error?.message || body?.error?.description || "Failed to create Cashfree order",
    );
    err.status = 502;
    throw err;
  }

  return body;
}

/** @param {string} providerOrderId Cashfree order_id from create response */
export async function fetchCashfreeOrder(providerOrderId) {
  if (!cashfreeConfigured() || !providerOrderId) return null;

  const response = await fetch(`${cashfreeBaseUrl()}/pg/orders/${encodeURIComponent(providerOrderId)}`, {
    method: "GET",
    headers: cashfreeHeaders(),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body?.message || "Failed to fetch Cashfree order");
    err.status = 502;
    throw err;
  }
  return body;
}

/**
 * Verify Cashfree webhook signature.
 * @param {string} rawBody
 * @param {string} signature from x-webhook-signature
 * @param {string} timestamp from x-webhook-timestamp
 */
export function verifyCashfreeWebhookSignature(rawBody, signature, timestamp) {
  if (!env.cashfreeClientSecret || !signature || !timestamp) return false;

  const signedPayload = `${timestamp}${rawBody}`;
  const expected = createHmac("sha256", env.cashfreeClientSecret).update(signedPayload).digest("base64");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signature), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function publicCashfreeMode() {
  return env.cashfreeEnv === "production" ? "production" : "sandbox";
}
