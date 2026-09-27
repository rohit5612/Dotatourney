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
      releasedAt: row.releasedAt ? String(row.releasedAt).trim() : undefined,
      notes: row.notes ? String(row.notes).trim() : undefined,
    }))
    .filter((row) => row.summary)
    .sort((a, b) => compareSemverDesc(a.version, b.version));
  return { entries };
}

/** Max changelog lines merged for public display (modal paginates at {@link PUBLIC_CHANGELOG_PAGE_SIZE}). */
export const PUBLIC_CHANGELOG_LINE_LIMIT = 50;
export const PUBLIC_CHANGELOG_PAGE_SIZE = 50;

export function isMajorReleaseVersion(version) {
  const parts = parseSemver(version);
  if (!parts) return false;
  return parts[1] === 0 && parts[2] === 0;
}

export function majorReleaseEntries(history) {
  return (history?.entries || []).filter((entry) => isMajorReleaseVersion(entry.version));
}

export function normalizeVersionChangeLog(payload) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const list = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = list
    .filter((row) => row && typeof row === "object" && String(row.version || "").trim())
    .map((row) => ({
      id: String(row.id || row.version).trim(),
      version: String(row.version).trim(),
      text: String(row.text || "").trim(),
    }))
    .filter((row) => row.text)
    .sort((a, b) => compareSemverDesc(a.version, b.version));
  return { lines };
}

export function buildPublicChangelogLines(versionHistory, versionChangeLog, limit = PUBLIC_CHANGELOG_LINE_LIMIT) {
  const byVersion = new Map();
  for (const line of versionChangeLog?.lines || []) {
    byVersion.set(line.version, { version: line.version, text: line.text });
  }
  for (const entry of versionHistory?.entries || []) {
    if (!byVersion.has(entry.version) && entry.summary) {
      byVersion.set(entry.version, { version: entry.version, text: entry.summary });
    }
  }
  const sorted = [...byVersion.values()].sort((a, b) => compareSemverDesc(a.version, b.version));
  if (limit == null) return sorted;
  return sorted.slice(0, limit);
}

export function createEmptyVersionChangeLogLine() {
  return {
    id: `vcl-${Date.now()}`,
    version: "3.0.1",
    text: "",
  };
}

export function findVersionHistoryEntry(history, version) {
  const target = String(version || "").trim();
  return (history?.entries || []).find((e) => e.version === target) || null;
}

export function createEmptyVersionHistoryEntry() {
  return {
    id: `vh-${Date.now()}`,
    version: "4.0.0",
    seasonLabel: "",
    summary: "",
    releasedAt: "",
    notes: "",
  };
}

export function formatReleaseDate(isoDate) {
  const raw = String(isoDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function truncateText(text, max = 72) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
