const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "bpcl-admin-token";

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
  getPublicTournament: () => request("/public/tournament"),
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
  deleteRoster: (id, rosterId) =>
    request(`/tournaments/${id}/rosters/${rosterId}`, {
      method: "DELETE",
    }),
  generateMatches: (id) =>
    request(`/tournaments/${id}/generate`, {
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
};
