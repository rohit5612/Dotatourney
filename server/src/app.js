import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import tournamentsRouter from "./routes/tournaments.js";

function buildAllowedOrigins() {
  const fromEnv = Array.isArray(env.corsOrigin) ? env.corsOrigin : [env.corsOrigin];
  const devDefaults = ["http://localhost:5173", "http://127.0.0.1:5173"];
  return [...new Set([...fromEnv, ...devDefaults].filter(Boolean))];
}

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
};

export const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/tournaments", tournamentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);

app.use((err, _req, res, _next) => {
  const status = err?.status || (err?.name === "ZodError" ? 400 : 500);
  res.status(status).json({
    message: err?.message || "Unexpected server error",
    issues: err?.issues || null,
  });
});
