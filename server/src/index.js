import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const apiBaseUrl = `http://localhost:${env.port}`;
const databaseTarget = env.databaseUrl
  ? "DATABASE_URL"
  : `${env.dbUser}@${env.dbHost}:${env.dbPort}/${env.dbName}`;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log(`[startup] Database connection: connected (${databaseTarget})`);
  } catch (error) {
    console.error(`[startup] Database connection: failed (${databaseTarget})`);
    console.error(error);
    process.exit(1);
  }

  app.listen(env.port, () => {
    const corsLabel = Array.isArray(env.corsOrigin) ? env.corsOrigin.join(", ") : env.corsOrigin;
    console.log(`[startup] Port: ${env.port}`);
    console.log(`[startup] API status: running at ${apiBaseUrl}`);
    console.log(`[startup] Health: ok at ${apiBaseUrl}/health`);
    console.log(`[startup] CORS allowed origins: ${corsLabel}`);
    console.log(`[startup] APP_URL (invite links): ${env.appUrl}`);
  });
}

startServer();
