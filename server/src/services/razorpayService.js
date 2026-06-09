import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function razorpayConfigured() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export function razorpayWebhookConfigured() {
  return Boolean(env.razorpayWebhookSecret);
}

/**
 * @param {{ amount: number, currency?: string, receipt: string, notes?: Record<string, string> }}
 */
export async function createRazorpayOrder({ amount, currency = "INR", receipt, notes = {} }) {
  if (!razorpayConfigured()) {
    return null;
  }

  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt: receipt.slice(0, 40),
      notes,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body?.error?.description || body?.message || "Failed to create Razorpay order");
    err.status = 502;
    throw err;
  }
  return body;
}

/**
 * Verify Razorpay webhook signature (X-Razorpay-Signature).
 * @param {string} rawBody
 * @param {string} signature
 */
export function verifyRazorpayWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret || !signature) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signature), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function publicRazorpayKeyId() {
  return env.razorpayKeyId || null;
}
