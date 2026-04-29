import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

function sslOptionForDatabaseUrl() {
  if (!env.databaseUrl || env.databaseSsl === false) {
    return undefined;
  }
  if (env.databaseSsl === true) {
    return { rejectUnauthorized: env.databaseSslRejectUnauthorized };
  }
  try {
    const normalized = env.databaseUrl.replace(/^postgresql:\/\//, "postgres://");
    const u = new URL(normalized);
    const host = (u.hostname || "").toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (local) return undefined;
  } catch {
    // If URL parsing fails, prefer SSL for safety on unknown connection strings.
  }
  return { rejectUnauthorized: env.databaseSslRejectUnauthorized };
}

const ssl = sslOptionForDatabaseUrl();
const poolConfig = env.databaseUrl
  ? {
      connectionString: env.databaseUrl,
      ...(ssl ? { ssl } : {}),
    }
  : {
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword,
      ...(env.databaseSsl === true
        ? { ssl: { rejectUnauthorized: env.databaseSslRejectUnauthorized } }
        : {}),
    };

export const pool = new Pool(poolConfig);
