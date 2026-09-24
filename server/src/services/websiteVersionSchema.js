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
  notes: z.string().max(8000).optional(),
});

export const versionHistorySchema = z.object({
  entries: z.array(versionHistoryEntrySchema).max(64),
});

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

export function normalizeVersionHistory(payload) {
  const parsed = versionHistorySchema.parse(payload);
  const versions = parsed.entries.map((e) => e.version);
  const unique = new Set(versions);
  if (unique.size !== versions.length) {
    throw new Error("Duplicate version numbers in changelog");
  }
  const entries = [...parsed.entries]
    .map((entry) => ({
      id: String(entry.id).trim(),
      version: String(entry.version).trim(),
      seasonLabel: entry.seasonLabel?.trim() || undefined,
      summary: String(entry.summary).trim(),
      notes: entry.notes?.trim() || undefined,
    }))
    .sort((a, b) => compareSemverDesc(a.version, b.version));
  return { entries };
}
