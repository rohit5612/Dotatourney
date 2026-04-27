import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import tournamentsRouter from "./routes/tournaments.js";

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  }),
);
app.use(express.json({ limit: "8mb" }));

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
