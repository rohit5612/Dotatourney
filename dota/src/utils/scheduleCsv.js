import { datetimeLocalToIso } from "./datetime.js";
import { isValidScheduleInstant } from "./schedule.js";

export const SCHEDULE_CSV_HEADERS = ["match_id", "Match", "Round", "Teams", "Bracket", "Date", "Time"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Local calendar date as dd/mm/yyyy from ISO / timestamptz. */
export function formatScheduleCsvDate(iso) {
  if (!iso || !isValidScheduleInstant(iso)) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Local wall time as HH:mm (24h). */
export function formatScheduleCsvTime(iso) {
  if (!iso || !isValidScheduleInstant(iso)) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function cleanCell(value) {
  return String(value ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/^="(.*)"$/s, "$1")
    .replace(/^'(.*)'$/s, "$1")
    .trim();
}

function parseDateParts(dateText) {
  const text = cleanCell(dateText);
  if (!text) return null;

  let m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
  }

  m = text.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (m) {
    return { day: Number(m[3]), month: Number(m[2]), year: Number(m[1]) };
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 30000 && serial <= 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + Math.round(serial) * 86400000);
      return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
    }
  }

  return null;
}

function parseTimeParts(timeText) {
  const text = cleanCell(timeText) || "00:00";

  const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let hours = Number(m[1]);
    const minutes = Number(m[2]);
    const ampm = (m[4] || "").toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (n >= 0 && n < 1) {
      const totalMinutes = Math.round(n * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return { hours, minutes };
    }
    if (n >= 1 && n < 1_000_000) {
      const fraction = n % 1;
      if (fraction > 0) {
        const totalMinutes = Math.round(fraction * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return { hours, minutes };
      }
    }
  }

  return null;
}

function splitDateAndTime(dateStr, timeStr) {
  let dateText = cleanCell(dateStr);
  let timeText = cleanCell(timeStr);

  if (dateText && !timeText) {
    const isoLike = dateText.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    if (isoLike) {
      dateText = isoLike[1];
      timeText = isoLike[2];
    } else {
      const spaced = dateText.match(/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)$/i);
      if (spaced) {
        dateText = spaced[1];
        timeText = spaced[2];
      } else if (/^\d+(\.\d+)?$/.test(dateText)) {
        const n = Number(dateText);
        if (n >= 30000) {
          const whole = Math.floor(n);
          const fraction = n - whole;
          dateText = String(whole);
          if (fraction > 0) timeText = String(fraction);
        } else if (n >= 1 && n < 30000 && n % 1 !== 0) {
          const whole = Math.floor(n);
          const fraction = n - whole;
          dateText = String(whole);
          timeText = String(fraction);
        }
      }
    }
  }

  return { dateText, timeText };
}

/**
 * Parse Date (dd/mm/yyyy) + Time (HH:mm) as local wall time → `datetime-local` value.
 * Also accepts common spreadsheet variants (dashes, dots, yyyy-mm-dd, seconds, AM/PM, Excel serial).
 */
export function parseScheduleCsvDateTime(dateStr, timeStr) {
  const { dateText, timeText } = splitDateAndTime(dateStr, timeStr);
  const dateParts = parseDateParts(dateText);
  if (!dateParts) return null;
  const { day, month, year } = dateParts;
  const timeParts = parseTimeParts(timeText);
  if (!timeParts) return null;
  const { hours, minutes } = timeParts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const local = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hours)}:${pad2(minutes)}`;
  const iso = datetimeLocalToIso(local);
  return iso && isValidScheduleInstant(iso) ? local : null;
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function rowsToScheduleCsv(rows) {
  const lines = [SCHEDULE_CSV_HEADERS.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(SCHEDULE_CSV_HEADERS.map((key) => escapeCsvCell(row[key])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Minimal RFC-style CSV parser (quoted fields, commas). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
}

const HEADER_ALIASES = {
  match_id: "match_id",
  matchid: "match_id",
  id: "match_id",
  match: "Match",
  round: "Round",
  teams: "Teams",
  team: "Teams",
  bracket: "Bracket",
  date: "Date",
  time: "Time",
};

/**
 * @returns {{ rows: Record<string, string>[], errors: string[] }}
 */
export function parseScheduleCsv(text) {
  const errors = [];
  const table = parseCsv(String(text).replace(/^\uFEFF/, ""));
  if (!table.length) {
    return { rows: [], errors: ["CSV is empty."] };
  }
  const headerRow = table[0];
  const colIndex = {};
  headerRow.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)];
    if (key) colIndex[key] = index;
  });
  if (colIndex.match_id == null) {
    return { rows: [], errors: ['Missing "match_id" column (keep it from export for reliable import).'] };
  }

  const rows = [];
  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    if (!line.some((c) => String(c).trim())) continue;
    const get = (key) => {
      const idx = colIndex[key];
      return idx == null ? "" : String(line[idx] ?? "").trim();
    };
    const matchId = get("match_id");
    if (!matchId) {
      errors.push(`Row ${r + 1}: missing match_id.`);
      continue;
    }
    rows.push({
      match_id: matchId,
      Match: get("Match"),
      Round: get("Round"),
      Teams: get("Teams"),
      Bracket: get("Bracket"),
      Date: get("Date"),
      Time: get("Time"),
    });
  }
  return { rows, errors };
}

/**
 * Build export row objects for all bracket matches (scheduled + unscheduled).
 */
export function buildScheduleCsvExportRows({
  matches,
  schedule,
  stageLabels,
  formatRound,
  resolveTeam1,
  resolveTeam2,
}) {
  const slotByMatchId = new Map((schedule || []).map((s) => [s.matchId, s]));
  const sorted = [...(matches || [])].sort((a, b) => {
    const sk = String(a.stageKey || "").localeCompare(String(b.stageKey || ""));
    if (sk !== 0) return sk;
    const rd = (a.roundIndex ?? 0) - (b.roundIndex ?? 0);
    if (rd !== 0) return rd;
    return (a.matchIndex ?? 0) - (b.matchIndex ?? 0);
  });

  return sorted.map((match) => {
    const slot = slotByMatchId.get(match.id);
    const iso = slot && isValidScheduleInstant(slot.startAt) ? slot.startAt : null;
    const team1 = resolveTeam1(match);
    const team2 = resolveTeam2(match);
    const teams = `${team1} vs ${team2}`;
    return {
      match_id: match.id,
      Match: teams,
      Round: formatRound(match),
      Teams: teams,
      Bracket: stageLabels[match.stageKey] || match.stageKey || "",
      Date: iso ? formatScheduleCsvDate(iso) : "",
      Time: iso ? formatScheduleCsvTime(iso) : "",
    };
  });
}

export function downloadScheduleCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Apply parsed CSV rows onto schedule row objects (by match_id).
 * @param {object[]} existingRows - rows from schedule editor (with matchId, startAt as datetime-local)
 * @param {Record<string, string>[]} imported
 * @param {Set<string>} validMatchIds
 */
export function mergeScheduleCsvImport(existingRows, imported, validMatchIds) {
  const byMatchId = new Map(existingRows.map((r) => [r.matchId, { ...r }]));
  const skipped = [];
  const failed = [];
  let updated = 0;

  for (const row of imported) {
    if (!validMatchIds.has(row.match_id)) {
      skipped.push(`Unknown match_id: ${row.match_id}`);
      continue;
    }
    const date = cleanCell(row.Date);
    const time = cleanCell(row.Time);
    if (!date && !time) continue;
    if (!date) {
      skipped.push(`${row.match_id}: Date is required when setting a time.`);
      continue;
    }
    const local = parseScheduleCsvDateTime(date, time);
    if (!local) {
      const reason = `invalid Date or Time (use dd/mm/yyyy and HH:mm, or re-export from admin)`;
      skipped.push(`${row.match_id}: ${reason}`);
      failed.push({ match_id: row.match_id, date, time, reason });
      continue;
    }
    const current = byMatchId.get(row.match_id);
    if (current) {
      byMatchId.set(row.match_id, { ...current, startAt: local });
    } else {
      byMatchId.set(row.match_id, {
        id: row.match_id,
        matchId: row.match_id,
        startAt: local,
        stream: "Main",
        streamUrl: "",
        status: "upcoming",
        notes: "",
      });
    }
    updated++;
  }

  return { rows: [...byMatchId.values()], updated, skipped, failed };
}
