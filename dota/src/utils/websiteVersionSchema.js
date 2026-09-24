import { DEFAULT_WEBSITE_VERSION } from "../constants/websiteVersion.js";

export function parseSemver(version) {
  const parts = String(version || "").trim().split(".");
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return nums;
}

export function compareSemverDesc(a, b) {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return bv[i] - av[i];
  }
  return 0;
}

export function formatWebsiteVersion(version) {
  const v = normalizeWebsiteVersion(version);
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function normalizeWebsiteVersion(payload) {
  if (!payload || typeof payload !== "object") {
    return { ...DEFAULT_WEBSITE_VERSION };
  }
  const major = Number.parseInt(payload.major, 10);
  const minor = Number.parseInt(payload.minor, 10);
  const patch = Number.parseInt(payload.patch, 10);
  return {
    major: Number.isFinite(major) && major >= 0 ? major : DEFAULT_WEBSITE_VERSION.major,
    minor: Number.isFinite(minor) && minor >= 0 ? minor : DEFAULT_WEBSITE_VERSION.minor,
    patch: Number.isFinite(patch) && patch >= 0 ? patch : DEFAULT_WEBSITE_VERSION.patch,
  };
}

export function normalizeVersionHistory(payload) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const list = Array.isArray(raw.entries) ? raw.entries : [];
  const entries = list
    .filter((row) => row && typeof row === "object" && String(row.version || "").trim())
    .map((row) => ({
      id: String(row.id || row.version).trim(),
      version: String(row.version).trim(),
      seasonLabel: row.seasonLabel ? String(row.seasonLabel).trim() : undefined,
      summary: String(row.summary || "").trim(),
      notes: row.notes ? String(row.notes).trim() : undefined,
    }))
    .filter((row) => row.summary)
    .sort((a, b) => compareSemverDesc(a.version, b.version));
  return { entries };
}

export function findVersionHistoryEntry(history, version) {
  const target = String(version || "").trim();
  return (history?.entries || []).find((e) => e.version === target) || null;
}

export function createEmptyVersionHistoryEntry() {
  return {
    id: `vh-${Date.now()}`,
    version: "0.0.0",
    seasonLabel: "",
    summary: "",
    notes: "",
  };
}
