import { getClientIp, logError, logInfo, logWarn } from "../utils/serverLogger.js";

function requestPath(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

function shouldLogRequest(req) {
  const path = requestPath(req);
  const method = req.method;

  if (path === "/health") return false;

  if (path.startsWith("/api/webhooks/")) return true;

  if (path.startsWith("/api/admin/login") || path.startsWith("/api/admin/logout") || path.startsWith("/api/admin/bootstrap")) {
    return true;
  }
  if (path.startsWith("/api/admin/invites")) return true;
  if (path.startsWith("/api/admin/") && method !== "GET") return true;

  if (path.startsWith("/api/player/auth/")) return true;
  if (path.includes("/checkout")) return true;
  if (path.includes("/upgrade/confirm")) return true;
  if (path.includes("/simulate-pay")) return true;
  if (path.includes("/substitute") && method === "POST") return true;

  if (path.includes("/register")) return true;

  if (path.startsWith("/api/tournaments/") && method !== "GET") return true;

  return false;
}

function buildRequestMeta(req, res, durationMs) {
  const meta = {
    method: req.method,
    path: requestPath(req),
    status: res.statusCode,
    durationMs,
    ip: getClientIp(req),
  };
  if (req.adminUser?.id) {
    meta.adminId = req.adminUser.id;
    meta.adminEmail = req.adminUser.email;
  }
  if (req.playerAccount?.id) {
    meta.playerId = req.playerAccount.id;
    meta.bpcId = req.playerAccount.bpc_id;
  }
  return meta;
}

export function actionLoggingMiddleware(req, res, next) {
  if (!shouldLogRequest(req)) return next();

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const meta = buildRequestMeta(req, res, durationMs);
    const label = `${meta.method} ${meta.path}`;

    if (meta.status >= 500) {
      logError("api", `${label} server error`, null, meta);
    } else if (meta.status >= 400) {
      logWarn("api", `${label} client error`, meta);
    } else {
      logInfo("api", label, meta);
    }
  });

  return next();
}
