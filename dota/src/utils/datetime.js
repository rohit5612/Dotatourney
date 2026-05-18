/** Calendar date for `<input type="date">` — stable for Postgres DATE / ISO strings. */
export function toDateInputValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Local date+time for `<input type="datetime-local">` from ISO / timestamptz. */
export function toDatetimeLocalValue(value) {
  if (value == null || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse `<input type="datetime-local">` value as local wall time → ISO UTC for storage.
 * Avoid `new Date("YYYY-MM-DDTHH:mm")` + `toISOString()` on read, which shifts every save.
 */
export function datetimeLocalToIso(local) {
  if (local == null || local === "") return null;
  const text = String(local).trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
