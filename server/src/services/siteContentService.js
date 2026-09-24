import { pool } from "../db/pool.js";
import { normalizeOrgRoster } from "./seasonContentSchema.js";
import {
  normalizeVersionHistory,
  normalizeWebsiteVersion,
} from "./websiteVersionSchema.js";

const ORG_ROSTER_KEY = "org_roster";
const WEBSITE_VERSION_KEY = "website_version";
const VERSION_HISTORY_KEY = "version_history";

export async function getOrgRoster() {
  const { rows } = await pool.query(`SELECT payload FROM public_site_content WHERE key = $1`, [ORG_ROSTER_KEY]);
  const payload = rows[0]?.payload;
  if (!payload || typeof payload !== "object") {
    return { section: {}, members: [] };
  }
  try {
    return normalizeOrgRoster(payload);
  } catch {
    return { section: {}, members: [] };
  }
}

export async function updateOrgRoster(payload) {
  const normalized = normalizeOrgRoster(payload);
  await pool.query(
    `INSERT INTO public_site_content (key, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [ORG_ROSTER_KEY, JSON.stringify(normalized)],
  );
  return normalized;
}

async function getSiteContentPayload(key, fallback) {
  const { rows } = await pool.query(`SELECT payload FROM public_site_content WHERE key = $1`, [key]);
  const payload = rows[0]?.payload;
  if (!payload || typeof payload !== "object") return fallback;
  return payload;
}

export async function getWebsiteVersion() {
  try {
    const payload = await getSiteContentPayload(WEBSITE_VERSION_KEY, null);
    if (!payload) return normalizeWebsiteVersion({ major: 3, minor: 0, patch: 0 });
    return normalizeWebsiteVersion(payload);
  } catch {
    return normalizeWebsiteVersion({ major: 3, minor: 0, patch: 0 });
  }
}

export async function updateWebsiteVersion(payload) {
  const normalized = normalizeWebsiteVersion(payload);
  await pool.query(
    `INSERT INTO public_site_content (key, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [WEBSITE_VERSION_KEY, JSON.stringify(normalized)],
  );
  return normalized;
}

export async function getVersionHistory() {
  try {
    const payload = await getSiteContentPayload(VERSION_HISTORY_KEY, { entries: [] });
    return normalizeVersionHistory(payload);
  } catch {
    return { entries: [] };
  }
}

export async function updateVersionHistory(payload) {
  const normalized = normalizeVersionHistory(payload);
  await pool.query(
    `INSERT INTO public_site_content (key, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [VERSION_HISTORY_KEY, JSON.stringify(normalized)],
  );
  return normalized;
}

export async function getPublicSiteContent() {
  const [orgRoster, websiteVersion, versionHistory] = await Promise.all([
    getOrgRoster(),
    getWebsiteVersion(),
    getVersionHistory(),
  ]);
  return { orgRoster, websiteVersion, versionHistory };
}
