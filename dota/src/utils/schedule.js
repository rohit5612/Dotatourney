/** Ignore epoch / placeholder timestamps from legacy saves */
export const MIN_SCHEDULE_MS = Date.UTC(2020, 0, 1);

export function isValidScheduleInstant(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= MIN_SCHEDULE_MS;
}

function ordinalSuffix(day) {
  const n = day % 100;
  if (n >= 11 && n <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** e.g. "Saturday 23rd May 2026" */
export function formatScheduleDayHeading(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const day = d.getDate();
  const monthYear = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `${weekday} ${day}${ordinalSuffix(day)} ${monthYear}`;
}

export function scheduleDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group slots by calendar day (sorted by date, then time within day). */
function pickDisplayScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function getMatchDisplayScores(match) {
  if (!match) return { team1: null, team2: null, ready: false, winner: null };
  const meta = match.meta || {};
  let team1 = pickDisplayScore(meta.team1Score);
  let team2 = pickDisplayScore(meta.team2Score);
  if (team1 == null) team1 = pickDisplayScore(match.team1Score);
  if (team2 == null) team2 = pickDisplayScore(match.team2Score);

  const rawScore = typeof meta.score === "string" ? meta.score.trim() : "";
  if (rawScore && (team1 == null || team2 == null)) {
    const parts = rawScore.split("-").map((part) => part.trim());
    if (parts.length >= 2) {
      if (team1 == null) team1 = pickDisplayScore(parts[0]);
      if (team2 == null) team2 = pickDisplayScore(parts[1]);
    }
  }

  return {
    team1,
    team2,
    ready: team1 != null && team2 != null,
    winner: match.winner || null,
  };
}

/** Prefer finished when the bracket match has a result; otherwise use slot then match status. */
export function resolveScheduleStatus(slot, match) {
  if (match?.winner || match?.status === "finished" || slot?.status === "finished") return "finished";
  if (slot?.status === "live" || match?.status === "live") return "live";
  return slot?.status || match?.status || "upcoming";
}

/** Normalizes stream URLs for display and opens valid http(s) links. */
export function parseStreamWatchLink(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  try {
    const href = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const isYoutube =
      host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com" || host.endsWith(".youtube.com");
    return {
      href: parsed.toString(),
      title: isYoutube ? "Watch on YouTube" : "Watch live stream",
      isYoutube,
    };
  } catch {
    return { href: trimmed, title: "Watch live stream", isYoutube: false };
  }
}

/** Public Bracket & Schedule page — `#bracket` or `#schedule` */
export function parseScheduleViewHash(hash = typeof window !== "undefined" ? window.location.hash : "") {
  const id = String(hash).replace(/^#/, "").toLowerCase();
  return id === "schedule" ? "schedule" : "bracket";
}

export function scheduleViewHref(view) {
  return view === "schedule" ? "/schedule#schedule" : "/schedule#bracket";
}

export function groupScheduleSlotsByDate(slots) {
  const byDay = new Map();
  for (const slot of slots) {
    const key = scheduleDateKey(slot.startAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(slot);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, daySlots]) => {
      const sorted = [...daySlots].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      return {
        dateKey: scheduleDateKey(sorted[0].startAt),
        heading: formatScheduleDayHeading(sorted[0].startAt),
        slots: sorted,
      };
    });
}
