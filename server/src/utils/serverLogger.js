const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "otp",
  "paymentscreenshot",
  "signature",
  "secret",
  "passwordhash",
]);

function sanitizeValue(key, value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[nested]";
  const normalized = String(key || "").toLowerCase().replace(/[_-]/g, "");
  if (SENSITIVE_KEYS.has(normalized)) return "[redacted]";
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 120)}…[truncated]`;
  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(String(index), item, depth + 1));
  if (typeof value === "object") return sanitizeMeta(value, depth + 1);
  return value;
}

export function sanitizeMeta(meta, depth = 0) {
  if (!meta || typeof meta !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = sanitizeValue(key, value, depth);
  }
  return out;
}

function formatMeta(meta) {
  const safe = sanitizeMeta(meta);
  return Object.keys(safe).length ? ` ${JSON.stringify(safe)}` : "";
}

function timestamp() {
  return new Date().toISOString();
}

export function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

export function logInfo(category, message, meta = {}) {
  console.log(`[${timestamp()}] [${category}] ${message}${formatMeta(meta)}`);
}

export function logWarn(category, message, meta = {}) {
  console.warn(`[${timestamp()}] [${category}] ${message}${formatMeta(meta)}`);
}

export function logError(category, message, error = null, meta = {}) {
  const payload = { ...meta };
  if (error) {
    payload.error = error?.message || String(error);
    if (error?.code) payload.code = error.code;
    if (error?.status || error?.statusCode) payload.status = error.status ?? error.statusCode;
  }
  console.error(`[${timestamp()}] [${category}] ${message}${formatMeta(payload)}`);
  if (error?.stack && process.env.NODE_ENV !== "production") {
    console.error(error.stack);
  }
}

export function logAction(category, action, meta = {}) {
  logInfo(category, action, meta);
}
