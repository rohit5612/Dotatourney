import { cachedGet, clearCache } from "./requestCache.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "bpcl-admin-token";

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

export function getAuthToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage write errors.
  }
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setAuthToken("");
      unauthorizedHandler?.();
    }
    const hint = body.message || (response.status === 404 ? "Not found — check API is running and URL includes /api" : null);
    const err = new Error(hint || `API request failed (${response.status})`);
    err.status = response.status;
    if (body.registrationConflict) err.registrationConflict = body.registrationConflict;
    throw err;
  }
  return response.json();
}

export const api = {
  bootstrapState: () => request("/admin/bootstrap-state"),
  bootstrapAdmin: (payload) =>
    request("/admin/bootstrap", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  loginAdmin: (payload) =>
    request("/admin/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logoutAdmin: () =>
    request("/admin/logout", {
      method: "POST",
    }),
  getAdminMe: () => request("/admin/me"),
  getAdminUsers: () => request("/admin/users"),
  getAdminSeasons: () => request("/admin/seasons"),
  getAdminSeasonsContent: () => request("/admin/seasons/content"),
  updateAdminOrgRoster: (payload) =>
    request("/admin/site-content/org-roster", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateAdminSeasonCardBg: (id, cardBg) =>
    request(`/admin/seasons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ cardBg }),
    }),
  updateAdminSeasonContent: (id, payload) =>
    request(`/admin/seasons/${encodeURIComponent(id)}/content`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateAdminStatus: (id, status) =>
    request(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createAdminInvite: (email) =>
    request("/admin/invites", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  getAdminInvite: (token) => request(`/admin/invites/${token}`),
  registerAdminInvite: (token, payload) =>
    request(`/admin/invites/${token}/register`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPublicTournament: () =>
    cachedGet("public:tournament", () => request("/public/tournament"), { ttlMs: 20_000, persist: true }),
  getPublicTournamentFresh: () => request("/public/tournament"),
  clearPublicTournamentCache: () => clearCache("public:tournament"),
  getPublicSiteContent: () =>
    cachedGet("public:site-content", () => request("/public/site-content"), { ttlMs: 60_000, persist: true }),
  getPublicSeasons: () =>
    cachedGet("public:seasons", () => request("/public/seasons"), { ttlMs: 60_000, persist: true }),
  getPublicSeason: (slug) => {
    const key = `public:season:${String(slug || "").trim().toLowerCase()}`;
    return cachedGet(key, () => request(`/public/seasons/${encodeURIComponent(slug)}`), {
      ttlMs: 90_000,
      persist: true,
    });
  },
  getPublicCommunity: (params = {}) => {
    const q = new URLSearchParams();
    const search = params.search ?? params.q;
    if (search) q.set("search", String(search));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    const suffix = q.toString() ? `?${q}` : "";
    const cacheKey = `public:community:${q.toString() || "default"}`;
    return cachedGet(cacheKey, () => request(`/public/community${suffix}`), { ttlMs: 30_000, persist: true });
  },
  getPublicMatch: (matchId) => {
    const key = `public:match:${String(matchId || "").trim()}`;
    return cachedGet(key, () => request(`/public/match/${encodeURIComponent(matchId)}`), {
      ttlMs: 20_000,
      persist: false,
    });
  },
  getPublicAnnouncements: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));
    const suffix = q.toString() ? `?${q}` : "";
    const cacheKey = `public:announcements:${q.toString() || "default"}`;
    return cachedGet(cacheKey, () => request(`/public/announcements${suffix}`), { ttlMs: 45_000, persist: true });
  },
  getPublicPlayer: (slug) => {
    const key = `public:player:${String(slug || "").trim().toLowerCase()}`;
    return cachedGet(key, () => request(`/public/players/${encodeURIComponent(slug)}`), {
      ttlMs: 60_000,
      persist: true,
    });
  },
  getRegistrationSession: (identifier, email, publicCode) => {
    const q = new URLSearchParams({ email: String(email || "").trim() });
    if (publicCode) q.set("code", String(publicCode).trim());
    return request(`/public/tournaments/${encodeURIComponent(identifier)}/register/session?${q}`);
  },
  lookupRegistrationEmail: (identifier, email) =>
    request(`/public/tournaments/${encodeURIComponent(identifier)}/register/lookup-email`, {
      method: "POST",
      body: JSON.stringify({ email: String(email || "").trim().toLowerCase() }),
    }),
  requestRegistrationOtp: (identifier, payload) =>
    request(`/public/tournaments/${encodeURIComponent(identifier)}/register/request-otp`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyRegistrationOtp: (identifier, payload) =>
    request(`/public/tournaments/${encodeURIComponent(identifier)}/register/verify-otp`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  completeRegistration: (identifier, payload) =>
    request(`/public/tournaments/${encodeURIComponent(identifier)}/register/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createTournament: (payload) =>
    request("/tournaments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTournament: (id, payload) =>
    request(`/tournaments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getTournaments: () => request("/tournaments"),
  publishTournament: (id) =>
    request(`/tournaments/${id}/publish`, {
      method: "POST",
    }),
  approveTournament: (id) =>
    request(`/tournaments/${id}/approve`, {
      method: "POST",
    }),
  completeTournament: (id, payload = {}) =>
    request(`/tournaments/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  unpublishTournament: (id) =>
    request(`/tournaments/${id}/unpublish`, {
      method: "POST",
    }),
  deleteTournament: (id) =>
    request(`/tournaments/${id}`, {
      method: "DELETE",
    }),
  getTournament: (id) => request(`/tournaments/${id}`),
  saveTeams: (id, payload) =>
    request(`/tournaments/${id}/teams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRosters: (id) => request(`/tournaments/${id}/rosters`),
  getRoster: (id, rosterId) => request(`/tournaments/${id}/rosters/${rosterId}`),
  createRoster: (id, payload) =>
    request(`/tournaments/${id}/rosters`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateRoster: (id, rosterId, payload) =>
    request(`/tournaments/${id}/rosters/${rosterId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  approveRoster: (id, rosterId) =>
    request(`/tournaments/${id}/rosters/${rosterId}/approve`, {
      method: "POST",
    }),
  adjustRoster: (id, rosterId, operations) =>
    request(`/tournaments/${id}/rosters/${rosterId}/adjustments`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    }),
  saveGroupAssignments: (id, assignments) =>
    request(`/tournaments/${id}/group-assignments`, {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    }),
  deleteRoster: (id, rosterId) =>
    request(`/tournaments/${id}/rosters/${rosterId}`, {
      method: "DELETE",
    }),
  generateMatches: (id) =>
    request(`/tournaments/${id}/generate`, {
      method: "POST",
    }),
  applySeriesRules: (id, payload = {}) =>
    request(`/tournaments/${id}/series-rules/apply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  refreshBracketProgression: (id) =>
    request(`/tournaments/${id}/bracket/refresh-progression`, {
      method: "POST",
    }),
  recordResult: (id, matchId, winner) =>
    request(`/tournaments/${id}/matches/${matchId}/result`, {
      method: "POST",
      body: JSON.stringify(typeof winner === "string" ? { winner } : winner),
    }),
  updateMatch: (id, matchId, payload) =>
    request(`/tournaments/${id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  saveSchedule: (id, schedule) =>
    request(`/tournaments/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ schedule }),
    }),
  exportTournament: (id) => request(`/tournaments/${id}/export`),
  syncGoogleSheetsRegistrations: (id, payload) =>
    request(`/tournaments/${id}/google-sheets/sync-registrations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRegistrations: (id) => request(`/tournaments/${id}/registrations`),
  updateRegistration: (id, registrationId, payload) =>
    request(`/tournaments/${id}/registrations/${registrationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  archiveRegistration: (id, registrationId, reason) =>
    request(`/tournaments/${id}/registrations/${registrationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  importTournament: (id, data) =>
    request(`/tournaments/${id}/import`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  grantPlayerCoins: (accountId, payload) =>
    request(`/admin/player-accounts/${accountId}/coins`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listPlayerAccounts: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.verified) q.set("verified", params.verified);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/admin/player-accounts${suffix}`);
  },
  getPlayerAccount: (id) => request(`/admin/player-accounts/${id}`),
  listPortraitGifs: () => request("/admin/player-accounts/portrait-gifs"),
  uploadPortraitGifToCatalog: (payload) =>
    request("/admin/player-accounts/portrait-gifs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patchPlayerAccount: (id, payload) =>
    request(`/admin/player-accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  uploadPlayerPortraitGif: (id, payload) =>
    request(`/admin/player-accounts/${id}/portrait-gif`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadPlayerCard: (id, payload) =>
    request(`/admin/player-accounts/${id}/card`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removePlayerCard: (id) =>
    request(`/admin/player-accounts/${id}/card`, {
      method: "DELETE",
    }),
  getSubstitutes: (tournamentId, params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    if (params.status) q.set("status", params.status);
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/tournaments/${tournamentId}/substitutes${suffix}`);
  },
  updateSubstitutePoolEntry: (tournamentId, registrationId, payload) =>
    request(`/tournaments/${tournamentId}/substitutes/${registrationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  patchSubstitutionRequest: (tournamentId, requestId, payload) =>
    request(`/tournaments/${tournamentId}/substitution-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  assignSubstitutionRequest: (tournamentId, requestId, payload) =>
    request(`/tournaments/${tournamentId}/substitution-requests/${requestId}/assign`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getTeamHistory: (tournamentId, teamId) => request(`/tournaments/${tournamentId}/teams/${teamId}/history`),
  updateAdminPermissions: (userId, permissions) =>
    request(`/admin/users/${userId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    }),
  getAuditLog: (params = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/admin/audit-log${suffix}`);
  },
  getFormatPresets: () => request("/admin/format-presets"),
  getFormatPreset: (id) => request(`/admin/format-presets/${encodeURIComponent(id)}`),
  getEngineTemplates: () => request("/admin/engine-templates"),
  getEngineTemplate: (id) => request(`/admin/engine-templates/${encodeURIComponent(id)}`),
  createEngineTemplate: (payload) =>
    request("/admin/engine-templates", { method: "POST", body: JSON.stringify(payload) }),
  updateEngineTemplate: (id, payload) =>
    request(`/admin/engine-templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEngineTemplate: (id) =>
    request(`/admin/engine-templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getTournamentCommerce: (tournamentId) => request(`/admin/tournaments/${tournamentId}/commerce`),
  putTournamentCommerce: (tournamentId, payload) =>
    request(`/admin/tournaments/${tournamentId}/commerce`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getTournamentCardAssets: (tournamentId) => request(`/admin/tournaments/${tournamentId}/card-assets`),
  patchCardAsset: (assetId, payload) =>
    request(`/admin/card-assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
