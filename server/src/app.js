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

function httpErrorStatus(err) {
  const raw = err?.status ?? err?.statusCode;
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (Number.isInteger(parsed) && parsed >= 100 && parsed < 600) return parsed;
  if (err?.name === "ZodError") return 400;
  return 500;
}

app.use((err, _req, res, _next) => {
  const status = httpErrorStatus(err);
  const body = {
    message: err?.message || "Unexpected server error",
    issues: err?.issues || null,
  };
  if (err?.registrationConflict) body.registrationConflict = err.registrationConflict;
  res.status(status).json(body);
});
