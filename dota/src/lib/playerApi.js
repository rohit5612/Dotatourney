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

/** Dedupe concurrent identical auth-link verifications (React StrictMode). */
const claimVerifyInflight = new Map();

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
  login: (payload) =>
    playerRequest("/player/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: payload.identifier || payload.email,
        password: payload.password,
      }),
    }),
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
  changePassword: (payload) =>
    playerRequest("/player/me/change-password", { method: "POST", body: JSON.stringify(payload) }),
  claimStart: (payload) =>
    playerRequest("/player/auth/claim/start", { method: "POST", body: JSON.stringify(payload) }),
  claimVerify: (payload) =>
    playerRequest("/player/auth/claim/verify", { method: "POST", body: JSON.stringify(payload) }),
  claimVerifyFromLink: (bpcId, email, token) => {
    const key = `${bpcId}|${email}|${token}`;
    if (claimVerifyInflight.has(key)) {
      return claimVerifyInflight.get(key);
    }
    const params = new URLSearchParams({
      bpcId,
      email,
      token,
    });
    const request = playerRequest(`/player/auth/claim/verify?${params.toString()}`).finally(() => {
      claimVerifyInflight.delete(key);
    });
    claimVerifyInflight.set(key, request);
    return request;
  },
  claimSetPassword: (payload) =>
    playerRequest("/player/auth/claim/set-password", { method: "POST", body: JSON.stringify(payload) }),
  publicAccount: (slug) => playerRequest(`/player/public/accounts/${encodeURIComponent(slug)}`),
  publicProfile: (slug) => playerRequest(`/public/players/${encodeURIComponent(slug)}`),
  publicCard: (slug) => playerRequest(`/public/players/${encodeURIComponent(slug)}/card`),
  checkoutPreview: (slug, payload) =>
    playerRequest(`/player/tournaments/${encodeURIComponent(slug)}/checkout/preview`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkoutConfirm: (slug, payload) =>
    playerRequest(`/player/tournaments/${encodeURIComponent(slug)}/checkout/confirm`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkoutStatus: (orderId) => playerRequest(`/player/checkout/${encodeURIComponent(orderId)}/status`),
  simulatePay: (orderId) =>
    playerRequest(`/player/checkout/${encodeURIComponent(orderId)}/simulate-pay`, { method: "POST" }),
  substituteSignup: (slug, payload) =>
    playerRequest(`/player/tournaments/${encodeURIComponent(slug)}/substitute`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  coins: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return playerRequest(`/player/me/coins${q ? `?${q}` : ""}`);
  },
  notifications: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    if (params.unreadOnly) qs.set("unreadOnly", "1");
    const q = qs.toString();
    return playerRequest(`/player/notifications${q ? `?${q}` : ""}`);
  },
  notificationUnreadCount: () => playerRequest("/player/notifications/unread-count"),
  markNotificationRead: (id) =>
    playerRequest(`/player/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => playerRequest("/player/notifications/read-all", { method: "POST" }),
  createSubstitutionRequest: (matchId, reason) =>
    playerRequest(`/player/matches/${encodeURIComponent(matchId)}/substitution-request`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  cancelSubstitutionRequest: (matchId) =>
    playerRequest(`/player/matches/${encodeURIComponent(matchId)}/substitution-request`, {
      method: "DELETE",
    }),
  team: () => playerRequest("/player/team"),
  matches: () => playerRequest("/player/matches"),
  history: () => playerRequest("/player/history"),
  upcomingTournaments: () => playerRequest("/player/tournaments/upcoming"),
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

/** Load Razorpay checkout script once. */
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}
