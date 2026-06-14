import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { syncBpcIdSequenceFromMax } from "./services/playerAccountRepository.js";
import { initRedis } from "./services/redisClient.js";

const databaseTarget = env.databaseUrl
  ? "DATABASE_URL"
  : `${env.dbUser}@${env.dbHost}:${env.dbPort}/${env.dbName}`;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log(`[startup] Database connection: connected (${databaseTarget})`);
    const maxBpc = await syncBpcIdSequenceFromMax();
    console.log(`[startup] BPC ID sequence synced (max existing: BPC-${String(maxBpc).padStart(3, "0")})`);
  } catch (error) {
    console.error(`[startup] Database connection: failed (${databaseTarget})`);
    console.error(error);
    process.exit(1);
  }

  try {
    const redis = await initRedis();
    console.log(`[startup] Redis connection: ${redis.label}`);
  } catch (error) {
    console.error("[startup] Redis connection: failed — public cache will use in-memory only");
    console.error(error);
  }

  app.listen(env.port, () => {
    const corsLabel = Array.isArray(env.corsOrigin) ? env.corsOrigin.join(", ") : env.corsOrigin;
    const publicApi = env.apiPublicUrl || `http://localhost:${env.port}`;
    console.log(`[startup] NODE_ENV: ${env.nodeEnv}`);
    console.log(`[startup] Port: ${env.port}`);
    console.log(`[startup] API public URL: ${publicApi}`);
    console.log(`[startup] Health: ${publicApi}/health`);
    console.log(`[startup] CORS allowed origins: ${corsLabel}`);
    console.log(`[startup] APP_URL (invite links): ${env.appUrl}`);
  });
}

startServer();
