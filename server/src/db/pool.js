import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const poolConfig = env.databaseUrl
  ? { connectionString: env.databaseUrl }
  : {
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword,
    };

export const pool = new Pool(poolConfig);
