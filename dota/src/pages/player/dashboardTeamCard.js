import { TEAM_LOGO_CATALOG } from "../../constants/teamLogos.js";

const LOGO_BY_LABEL = Object.fromEntries(
  TEAM_LOGO_CATALOG.map((entry) => [entry.label.toLowerCase(), entry.url]),
);

export function teamLogoForName(name) {
  const lower = (name || "").trim().toLowerCase();
  return LOGO_BY_LABEL[lower] || "";
}

function mapDashboardPlayer(player, captain = "") {
  const name = player?.displayName || player?.display_name || player?.name || "Player";
  const captainLower = String(captain || "").trim().toLowerCase();
  const roles = player?.roles?.length ? player.roles : player?.role ? [player.role] : [];

  return {
    id: player?.id,
    name,
    displayName: player?.displayName || player?.display_name || name,
    role: player?.role,
    roles,
    slug: player?.slug || player?.playerSlug || null,
    isCaptain:
      Boolean(player?.isCaptain ?? player?.is_captain) ||
      (captainLower ? String(name).trim().toLowerCase() === captainLower : false),
  };
}

/** Map player /team API payload to public TeamCard shape. */
export function buildPlayerDashboardTeamCard(teamResponse) {
  const roster = teamResponse?.team;
  const meta = roster?.team;
  const name = meta?.name;
  if (!name) return null;

  const captain = meta?.captain || "";
  const players = (roster?.teammates || []).map((player) => mapDashboardPlayer(player, captain));

  if (roster?.player?.name || roster?.player?.displayName) {
    const self = mapDashboardPlayer(roster.player, captain);
    if (!players.some((player) => player.id && self.id && player.id === self.id)) {
      players.unshift(self);
    }
  }

  return {
    id: meta?.id || name,
    name,
    logoUrl: teamLogoForName(name) || meta?.logoUrl || "",
    accentColor: meta?.accentColor || "",
    players: players.length ? players : [{ name: "Roster TBA", role: "Player" }],
    stats: { winRate: null, standing: "Active roster" },
    form: [],
  };
}
