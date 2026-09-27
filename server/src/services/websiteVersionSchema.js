import { z } from "zod";

export const websiteVersionSchema = z.object({
  major: z.number().int().min(0).max(999),
  minor: z.number().int().min(0).max(999),
  patch: z.number().int().min(0).max(9999),
});

export const versionHistoryEntrySchema = z.object({
  id: z.string().min(1).max(120),
  version: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+\.\d+\.\d+$/, "Version must be x.y.z"),
  seasonLabel: z.string().max(120).optional(),
  summary: z.string().min(1).max(2000),
  releasedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  notes: z.string().max(8000).optional(),
});

export const versionHistorySchema = z.object({
  entries: z.array(versionHistoryEntrySchema).max(32),
});

export const versionChangeLogLineSchema = z.object({
  id: z.string().min(1).max(120),
  version: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+\.\d+\.\d+$/, "Version must be x.y.z"),
  text: z.string().min(1).max(500),
});

export const versionChangeLogSchema = z.object({
  lines: z.array(versionChangeLogLineSchema).max(64),
});

export const PUBLIC_CHANGELOG_LINE_LIMIT = 50;

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

export function formatWebsiteVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

export function normalizeWebsiteVersion(payload) {
  const parsed = websiteVersionSchema.parse(payload);
  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
  };
}

export function isMajorReleaseVersion(version) {
  const parts = parseSemver(version);
  if (!parts) return false;
  return parts[1] === 0 && parts[2] === 0;
}

function mapVersionHistoryEntries(rawEntries) {
  return (rawEntries || [])
    .map((entry) => ({
      id: String(entry.id).trim(),
      version: String(entry.version).trim(),
      seasonLabel: entry.seasonLabel?.trim() || undefined,
      summary: String(entry.summary).trim(),
      releasedAt: entry.releasedAt?.trim() || undefined,
      notes: entry.notes?.trim() || undefined,
    }))
    .filter((entry) => entry.version && entry.summary);
}

/** Lenient read — skips non x.0.0 rows (belong in text changelog, not major releases). */
export function readVersionHistory(payload) {
  try {
    const parsed = versionHistorySchema.parse(payload);
    const entries = mapVersionHistoryEntries(parsed.entries)
      .filter((entry) => isMajorReleaseVersion(entry.version))
      .sort((a, b) => compareSemverDesc(a.version, b.version));
    return { entries };
  } catch {
    const raw = payload && typeof payload === "object" ? payload : {};
    const entries = mapVersionHistoryEntries(raw.entries)
      .filter((entry) => isMajorReleaseVersion(entry.version))
      .sort((a, b) => compareSemverDesc(a.version, b.version));
    return { entries };
  }
}

export function normalizeVersionHistory(payload) {
  const parsed = versionHistorySchema.parse(payload);
  const versions = parsed.entries.map((e) => e.version);
  const unique = new Set(versions);
  if (unique.size !== versions.length) {
    throw new Error("Duplicate version numbers in changelog");
  }
  const invalid = parsed.entries.filter((entry) => !isMajorReleaseVersion(String(entry.version).trim()));
  if (invalid.length) {
    const bad = invalid.map((e) => e.version).join(", ");
    throw new Error(`Major release entries must use x.0.0 (got ${bad}). Use Text changelog for y/z versions.`);
  }
  const entries = mapVersionHistoryEntries(parsed.entries).sort((a, b) => compareSemverDesc(a.version, b.version));
  return { entries };
}

export function normalizeVersionChangeLog(payload) {
  const parsed = versionChangeLogSchema.parse(payload);
  const versions = parsed.lines.map((line) => line.version);
  const unique = new Set(versions);
  if (unique.size !== versions.length) {
    throw new Error("Duplicate version numbers in changelog lines");
  }
  const lines = [...parsed.lines]
    .map((line) => ({
      id: String(line.id).trim(),
      version: String(line.version).trim(),
      text: String(line.text).trim(),
    }))
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
