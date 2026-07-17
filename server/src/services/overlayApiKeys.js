import { timingSafeEqual } from "crypto";
import { env } from "../config/env.js";

/** @type {Map<string, { label: string, tier: string }> | null} */
let keyIndex = null;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function buildKeyIndex() {
  const index = new Map();
  const raw = env.overlayApiKeysRaw;
  if (!raw?.trim()) return index;

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const label = trimmed.slice(0, colon).trim();
    const key = trimmed.slice(colon + 1).trim();
    if (!label || !key) continue;
    index.set(key, { label, tier: "trusted" });
  }
  return index;
}

function getKeyIndex() {
  if (!keyIndex) keyIndex = buildKeyIndex();
  return keyIndex;
}

/** @returns {string} */
export function extractOverlayApiKey(req) {
  const header = req.get("x-bpcl-api-key")?.trim();
  if (header) return header;

  const auth = req.get("authorization")?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

/**
 * @param {string} apiKey
 * @returns {{ label: string, tier: string } | null}
 */
export function resolveOverlayApiClient(apiKey) {
  const candidate = String(apiKey || "").trim();
  if (!candidate) return null;

  const index = getKeyIndex();
  for (const [storedKey, client] of index.entries()) {
    if (safeEqual(candidate, storedKey)) {
      return client;
    }
  }
  return null;
}

export function overlayApiKeysConfigured() {
  return getKeyIndex().size > 0;
}

/** Test helper — rebuild index after env changes. */
export function resetOverlayApiKeyIndex() {
  keyIndex = null;
}
