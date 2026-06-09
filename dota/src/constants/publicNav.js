/** Public site navbar — logo links home; no separate Home item. */
export const PUBLIC_NAV_LINKS = [
  { href: "/tournament", label: "Tournament" },
  { href: "/teams", label: "Teams", showWhen: "teamsBracket" },
  { href: "/seasons", label: "Seasons" },
  { href: "/announcements", label: "News" },
  { href: "/community", label: "Community" },
  { href: "/schedule", label: "Bracket & Schedule" },
  { href: "/rules", label: "Rules" },
];

export function isTeamsNavVisible(event) {
  const tournament = event?.tournament;
  if (!tournament || tournament.visibility_mode === "demo") return false;
  return Boolean(tournament.bracket_active);
}

export function resolvePublicNavLinks(event) {
  return PUBLIC_NAV_LINKS.filter((item) => {
    if (item.showWhen === "teamsBracket") return isTeamsNavVisible(event);
    return true;
  });
}
