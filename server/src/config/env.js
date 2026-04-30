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

export const env = {
  port: toNumber(process.env.PORT, 3000),
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
  emailSubjectPrefix: process.env.EMAIL_SUBJECT_PREFIX?.trim() || "",
  /** Local/dev only: create invite but do not send email (still returns link in JSON). */
  emailSkipSend: process.env.EMAIL_SKIP_SEND === "true",
  smtpConfigured: Boolean(emailUser && emailPass),
  /** Used to hash player registration OTPs. Set a strong secret in production. */
  registrationOtpSecret: process.env.REGISTRATION_OTP_SECRET?.trim() || "",
};

const hasDiscreteDbCreds = Boolean(env.dbHost && env.dbName && env.dbUser);
if (!env.databaseUrl && !hasDiscreteDbCreds) {
  throw new Error(
    "Provide DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD in environment variables",
  );
}
