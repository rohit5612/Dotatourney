import dotenv from "dotenv";

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCorsOrigin(raw) {
  const fallback = "http://localhost:5173";
  if (!raw?.trim()) return fallback;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return parts;
}

const inviteHours = toNumber(process.env.ADMIN_INVITE_EXPIRY_HOURS, 4);
const emailUser = process.env.EMAIL_USER?.trim() || "";
const emailPass = process.env.EMAIL_PASS?.trim() || "";

/** false = never, true = always, null = auto (SSL when host is not localhost) */
const databaseSsl =
  process.env.DATABASE_SSL === "false" ? false : process.env.DATABASE_SSL === "true" ? true : null;

const defaultPort = toNumber(process.env.PORT, 3000);

export const env = {
  port: defaultPort,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: toNumber(process.env.DB_PORT, 5432),
  dbName: process.env.DB_NAME || "",
  dbUser: process.env.DB_USER || "",
  dbPassword: process.env.DB_PASSWORD || "",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl,
  /** When false (default), matches Render external Postgres docs; set true if you enforce CA verification. */
  databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  /** Public URL of the Vite app (Render). Used in invite emails and API responses. */
  appUrl: process.env.APP_URL || "http://localhost:5173",
  adminInviteExpiryHours: inviteHours > 0 ? inviteHours : 4,
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: toNumber(process.env.SMTP_PORT, 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  emailUser,
  emailPass,
  emailFrom: process.env.EMAIL_FROM?.trim() || "",
  /** Optional; e.g. support@yourdomain.com — improves deliverability vs noreply-only. */
  emailReplyTo: process.env.EMAIL_REPLY_TO?.trim() || "",
  emailSubjectPrefix: process.env.EMAIL_SUBJECT_PREFIX?.trim() || "",
  /** Local/dev only: create invite but do not send email (still returns link in JSON). */
  emailSkipSend: process.env.EMAIL_SKIP_SEND === "true",
  smtpConfigured: Boolean(emailUser && emailPass),
  /** Used to hash player registration OTPs. Set a strong secret in production. */
  registrationOtpSecret: process.env.REGISTRATION_OTP_SECRET?.trim() || "",
  /** Player sessions, email verify, password reset, OAuth state */
  playerTokenSecret:
    process.env.PLAYER_TOKEN_SECRET?.trim() ||
    process.env.REGISTRATION_OTP_SECRET?.trim() ||
    "dev-player-token-secret-change-me",
  /** Public API origin for OAuth callbacks (e.g. http://localhost:3000 or https://api.bpcleague.in) */
  apiPublicUrl: (process.env.API_PUBLIC_URL || "").trim().replace(/\/$/, "") || null,
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
  discordClientId: process.env.DISCORD_CLIENT_ID?.trim() || "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET?.trim() || "",
  steamApiKey: process.env.STEAM_API_KEY?.trim() || "",
  nodeEnv: process.env.NODE_ENV || "development",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID?.trim() || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "",
  /** Service account JSON (minified one-line). Or use GOOGLE_SERVICE_ACCOUNT_JSON_B64 / GOOGLE_APPLICATION_CREDENTIALS. */
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "",
  googleServiceAccountJsonB64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64?.trim() || "",
  /** Local Redis or Upstash Redis URL (redis:// / rediss://). */
  redisUrl: process.env.REDIS_URL?.trim() || "",
  /** Upstash REST credentials — used when set (production); overrides REDIS_URL. */
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL?.trim() || "",
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "",
  /** L1 in-process TTL for public JSON (ms). */
  publicCacheL1TtlMs: toNumber(process.env.PUBLIC_CACHE_L1_TTL_MS, 8_000),
  /** L2 Redis TTL for public JSON (ms). */
  publicCacheRedisTtlMs: toNumber(process.env.PUBLIC_CACHE_REDIS_TTL_MS, 45_000),
};

if (!env.apiPublicUrl) {
  env.apiPublicUrl = `http://localhost:${env.port}`;
}

const hasDiscreteDbCreds = Boolean(env.dbHost && env.dbName && env.dbUser);
if (!env.databaseUrl && !hasDiscreteDbCreds) {
  throw new Error(
    "Provide DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD in environment variables",
  );
}

const DEV_PLAYER_SECRET = "dev-player-token-secret-change-me";

if (env.nodeEnv === "production") {
  const warnings = [];
  if (!env.registrationOtpSecret) {
    warnings.push("REGISTRATION_OTP_SECRET is unset — set a long random value");
  }
  if (env.playerTokenSecret === DEV_PLAYER_SECRET) {
    warnings.push("PLAYER_TOKEN_SECRET is still the dev default — set a strong secret");
  }
  if (!env.smtpConfigured) {
    warnings.push("SMTP is not configured — player/admin emails will not send");
  }
  if (!env.upstashRedisRestUrl && !env.redisUrl) {
    warnings.push("Redis is not configured — public cache will be in-memory only per process");
  }
  for (const msg of warnings) {
    console.warn(`[env] production warning: ${msg}`);
  }
}
