import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import tournamentsRouter from "./routes/tournaments.js";
import playerRouter from "./routes/player.js";
import { handleRazorpayWebhook } from "./services/paymentService.js";

function buildAllowedOrigins() {
  const fromEnv = Array.isArray(env.corsOrigin) ? env.corsOrigin : [env.corsOrigin];
  const devDefaults =
    env.nodeEnv === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"];
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

if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (env.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cors(corsOptions));

app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    try {
      const signature = req.get("x-razorpay-signature") || "";
      const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body || "");
      const result = await handleRazorpayWebhook(rawBody, signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/tournaments", tournamentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);
app.use("/api/player", playerRouter);

function httpErrorStatus(err) {
  const raw = err?.status ?? err?.statusCode;
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (Number.isInteger(parsed) && parsed >= 100 && parsed < 600) return parsed;
  if (err?.name === "ZodError") return 400;
  return 500;
}

app.use((err, _req, res, _next) => {
  const status = httpErrorStatus(err);
  const exposeMessage = env.nodeEnv !== "production" || status < 500;
  const body = {
    message: exposeMessage ? err?.message || "Unexpected server error" : "Unexpected server error",
    issues: exposeMessage && err?.issues ? err.issues : null,
  };
  if (err?.registrationConflict) body.registrationConflict = err.registrationConflict;
  if (err?.code) body.code = err.code;
  res.status(status).json(body);
});
