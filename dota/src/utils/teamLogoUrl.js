/** Shared team logo URL helpers — prefer static public paths over inline base64. */

export function isStaticTeamLogoUrl(url) {
  const value = String(url || "").trim();
  return value.startsWith("/images/teams/");
}

export function isInlineTeamLogoUrl(url) {
  return String(url || "").trim().startsWith("data:");
}

/** Prefer static catalog paths; fall back to inline base64 during migration. */
export function resolvePublicTeamLogo(...candidates) {
  const values = candidates.map((value) => String(value || "").trim()).filter(Boolean);
  const staticLogo = values.find(isStaticTeamLogoUrl);
  if (staticLogo) return staticLogo;
  const inlineLogo = values.find(isInlineTeamLogoUrl);
  if (inlineLogo) return inlineLogo;
  return values[0] || "";
}
