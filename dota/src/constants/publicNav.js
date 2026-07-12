/** Public site navbar — logo links home; no separate Home item. */
/** Set true when the /tournament hub should appear in nav again. */
export const TOURNAMENT_HUB_PUBLIC = false;

export const PUBLIC_NAV_LINKS = [
  { href: "/tournament", label: "Tournament", showWhen: "tournamentHub" },
  { href: "/teams", label: "Teams", showWhen: "teamsBracket" },
  { href: "/seasons", label: "Seasons" },
  { href: "/whats-new", label: "What's New", highlight: true },
  { href: "/announcements", label: "News" },
  { href: "/community", label: "Community" },
  { href: "/schedule", label: "Bracket & Schedule" },
  { href: "/rules", label: "Rules" },
  { href: "/sponsors", label: "Sponsors" },
];

/** Show Teams when tournament mode has an approved roster on the public payload. */
export function isTeamsNavVisible(event) {
  const tournament = event?.tournament;
  if (!tournament || tournament.visibility_mode === "demo") return false;
  return (event?.teams || []).length > 0;
}

export function resolvePublicNavLinks(event) {
  return PUBLIC_NAV_LINKS.filter((item) => {
    if (item.showWhen === "tournamentHub") return TOURNAMENT_HUB_PUBLIC;
    if (item.showWhen === "teamsBracket") return isTeamsNavVisible(event);
    return true;
  });
}
