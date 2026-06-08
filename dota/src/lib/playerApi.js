const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "bpcl-player-token";

/** Origin that serves /api (for full-page OAuth redirects). */
export function playerApiOrigin() {
  const fromEnv = import.meta.env.VITE_API_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    const proxy = import.meta.env.VITE_API_PROXY_TARGET?.trim() || "http://localhost:3000";
    return proxy.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function googleAuthStartUrl() {
  return `${playerApiOrigin()}/api/player/auth/google/start`;
}

export function getPlayerToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setPlayerToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function playerRequest(path, options = {}) {
  const token = getPlayerToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.code = body.code;
    throw err;
  }
  return body;
}

export const playerApi = {
  register: (payload) =>
    playerRequest("/player/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => playerRequest("/player/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => playerRequest("/player/auth/logout", { method: "POST" }),
  me: () => playerRequest("/player/me"),
  verifyEmail: (token, email) => {
    const params = new URLSearchParams({ token });
    if (email) params.set("email", email);
    return playerRequest(`/player/auth/verify-email?${params.toString()}`);
  },
  resendVerification: (email) =>
    playerRequest("/player/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
  forgotPassword: (email) =>
    playerRequest("/player/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (payload) =>
    playerRequest("/player/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  patchMe: (payload) => playerRequest("/player/me", { method: "PATCH", body: JSON.stringify(payload) }),
  publicAccount: (slug) => playerRequest(`/player/public/accounts/${encodeURIComponent(slug)}`),
  oauthStartUrl: (provider) => {
    const token = getPlayerToken();
    const base =
      provider === "google"
        ? `${playerApiOrigin()}/api/player/auth/google/start`
        : `${playerApiOrigin()}/api/player/auth/${provider}/start`;
    if (provider === "google") return base;
    return token ? `${base}?access_token=${encodeURIComponent(token)}` : base;
  },
};
