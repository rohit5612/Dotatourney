import { toDatetimeLocalValue } from "../utils/datetime.js";

function coercePostedAt(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Coerce API / DB value to logical entries (legacy string[] supported).
 * @returns {{ body: string, postedAt: string | null }[]}
 */
export function parseAnnouncementEntries(value) {
  if (value == null) return [];
  let raw = value;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) raw = parsed;
        else raw = t;
      } catch {
        raw = t;
      }
    } else {
      raw = t;
    }
  }
  if (!Array.isArray(raw)) {
    if (typeof raw === "string") {
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((body) => ({ body, postedAt: null }));
    }
    if (typeof raw === "object") {
      raw = Object.values(raw);
    } else {
      return [];
    }
  }
  return raw.map((item) => {
    if (typeof item === "string") {
      return { body: item.trim(), postedAt: null };
    }
    if (item && typeof item === "object") {
      const body = String(item.body ?? item.text ?? "").trim();
      const postedRaw = item.postedAt ?? item.posted_at;
      let postedAt = null;
      if (typeof postedRaw === "number" && Number.isFinite(postedRaw)) {
        postedAt = coercePostedAt(new Date(postedRaw).toISOString());
      } else {
        postedAt = coercePostedAt(postedRaw);
      }
      return { body, postedAt };
    }
    return { body: "", postedAt: null };
  });
}

/** Admin form rows: datetime-local string for `postedAt`. */
export function announcementsToAdminFormState(value) {
  return parseAnnouncementEntries(value).map((e) => ({
    body: e.body,
    postedAt: e.postedAt ? toDatetimeLocalValue(e.postedAt) : "",
  }));
}

export function datetimeLocalToIso(localValue) {
  if (localValue == null || !String(localValue).trim()) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Payload for PUT/POST tournament (objects only, non-empty bodies). */
export function announcementsToApiPayload(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      body: String(row.body ?? "").trim(),
      postedAt: datetimeLocalToIso(row.postedAt),
    }))
    .filter((row) => row.body.length > 0);
}

/** Admin form: single banner slot (newest entry if legacy array has multiple). */
export function bannerAnnouncementsToAdminFormState(value) {
  const entries = parseAnnouncementEntries(value);
  if (!entries.length) return { body: "", postedAt: "" };
  const rank = (postedAt) => {
    if (!postedAt) return Number.NEGATIVE_INFINITY;
    const t = new Date(postedAt).getTime();
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };
  const latest = [...entries].sort((a, b) => rank(b.postedAt) - rank(a.postedAt))[0];
  return {
    body: latest.body,
    postedAt: latest.postedAt ? toDatetimeLocalValue(latest.postedAt) : "",
  };
}

export function bannerAnnouncementsToApiPayload(row) {
  if (!row || typeof row !== "object") return [];
  const body = String(row.body ?? "").trim();
  if (!body) return [];
  return [{ body, postedAt: datetimeLocalToIso(row.postedAt) }];
}

/** Public landing page: one banner — newest by posted time. */
export function pickBannerAnnouncement(value) {
  const entries = parseAnnouncementEntries(value).filter((entry) => entry.body.trim());
  if (!entries.length) return null;
  const rank = (postedAt) => {
    if (!postedAt) return Number.NEGATIVE_INFINITY;
    const t = new Date(postedAt).getTime();
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };
  return [...entries].sort((a, b) => rank(b.postedAt) - rank(a.postedAt))[0];
}

export function formatAnnouncementPostedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
