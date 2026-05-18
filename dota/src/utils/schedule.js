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
