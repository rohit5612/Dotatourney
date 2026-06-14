import { pool } from "../db/pool.js";
import { normalizeOrgRoster } from "./seasonContentSchema.js";

const ORG_ROSTER_KEY = "org_roster";

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

export async function getPublicSiteContent() {
  const orgRoster = await getOrgRoster();
  return { orgRoster };
}
