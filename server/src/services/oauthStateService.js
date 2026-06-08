import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

function secret() {
  return env.playerTokenSecret || "dev-player-oauth-state";
}

export function createOAuthState(payload) {
  const nonce = randomBytes(16).toString("hex");
  const data = JSON.stringify({ ...payload, nonce, ts: Date.now() });
  const sig = createHmac("sha256", secret()).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
}

export function parseOAuthState(state) {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const data = parsed.data;
    const expected = createHmac("sha256", secret()).update(data).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(parsed.sig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(data);
    if (Date.now() - payload.ts > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
