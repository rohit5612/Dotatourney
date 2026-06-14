export const TOURNAMENT_BRAND = "Bharat Pro Circuit League";

/** Single space between brand and season label — no dash. */
export const TOURNAMENT_NAME_SEPARATOR = " ";

const LEGACY_PREFIXES = [
  `${TOURNAMENT_BRAND} - `,
  `${TOURNAMENT_BRAND} — `,
  `${TOURNAMENT_BRAND}${TOURNAMENT_NAME_SEPARATOR}`,
  "BPC League — Bharat Pro Circuit League - ",
  "BPC League — Bharat Pro Circuit League — ",
  "BPC League — Bharat Pro Circuit League ",
];

export function parseSeasonLabelFromName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  for (const prefix of LEGACY_PREFIXES) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim();
  }
  if (raw === TOURNAMENT_BRAND || raw.startsWith("BPC League")) return "";
  return raw;
}

export function buildTournamentFullName(seasonLabel) {
  const label = String(seasonLabel || "").trim();
  if (!label) return TOURNAMENT_BRAND;
  return `${TOURNAMENT_BRAND}${TOURNAMENT_NAME_SEPARATOR}${label}`;
}

export function slugifySeasonLabel(seasonLabel) {
  const slug = String(seasonLabel || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "season";
}

export function seasonSlugFromLabel(seasonLabel) {
  const base = slugifySeasonLabel(seasonLabel);
  return base.startsWith("season-") ? base : `season-${base}`;
}
