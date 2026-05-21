const DEFAULT_START_FALLBACK = "2026-05-22T00:00:00+05:30";

/** Local calendar midnight for DATE or datetime values. */
export function parseTournamentStartInstant(value, fallback = DEFAULT_START_FALLBACK) {
  const raw = value ?? fallback;
  if (raw == null || raw === "") return null;
  const text = String(raw).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseEndDay(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
  }
  return startOfLocalDay(new Date(text));
}

/**
 * @returns {'upcoming' | 'live' | 'completed'}
 */
export function getTournamentDayPhase(startDate, endDate, now = new Date()) {
  const start = parseTournamentStartInstant(startDate);
  if (!start) return "upcoming";

  const today = startOfLocalDay(now);
  const startDay = startOfLocalDay(start);
  const endDay = parseEndDay(endDate);

  if (today < startDay) return "upcoming";
  if (endDay && today > endDay) return "completed";
  if (today >= startDay && (!endDay || today <= endDay)) return "live";
  return "completed";
}

export function formatTournamentDisplayDate(value, fallback) {
  const instant = parseTournamentStartInstant(value, fallback);
  if (!instant) return "TBA";
  return instant.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getTournamentStatusCopy(phase) {
  switch (phase) {
    case "live":
      return {
        eyebrow: "Tournament day",
        statusLabel: "Live now",
        statusHint: "Matches and updates run through Discord — check in with your team.",
      };
    case "completed":
      return {
        eyebrow: "Tournament window",
        statusLabel: "Concluded",
        statusHint: "This event has finished. Follow Discord for the next season.",
      };
    default:
      return {
        eyebrow: "Tournament starts",
        statusLabel: "Upcoming",
        statusHint: "Countdown to the first day configured in admin setup.",
      };
  }
}
