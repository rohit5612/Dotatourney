const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeDeckThemeHexColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX_COLOR_RE.test(withHash)) return "";
  if (withHash.length === 4) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

export function parseTournamentDeckTheme(raw) {
  let source = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      source = JSON.parse(raw);
    } catch {
      source = {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    source = {};
  }
  return {
    badgeBackground: normalizeDeckThemeHexColor(source.badgeBackground),
    badgeText: normalizeDeckThemeHexColor(source.badgeText),
  };
}

export function hasDeckBadgeTheme(theme) {
  const parsed = parseTournamentDeckTheme(theme);
  return Boolean(parsed.badgeBackground || parsed.badgeText);
}

export function serializeTournamentDeckTheme(theme) {
  return parseTournamentDeckTheme(theme);
}
