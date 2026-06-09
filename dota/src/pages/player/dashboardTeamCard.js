import { TEAM_LOGO_CATALOG } from "../../constants/teamLogos.js";

const LOGO_BY_LABEL = Object.fromEntries(
  TEAM_LOGO_CATALOG.map((entry) => [entry.label.toLowerCase(), entry.url]),
);

export function teamLogoForName(name) {
  const lower = (name || "").trim().toLowerCase();
  return LOGO_BY_LABEL[lower] || "";
}

/** Map player /team API payload to public TeamCard shape. */
export function buildPlayerDashboardTeamCard(teamResponse) {
  const roster = teamResponse?.team;
  const meta = roster?.team;
  const name = meta?.name;
  if (!name) return null;

  const captain = (meta?.captain || "").trim().toLowerCase();
  const players = (roster?.teammates || []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    roles: p.roles,
    isCaptain: captain ? (p.name || "").trim().toLowerCase() === captain : false,
  }));

  if (roster?.player?.name) {
    const self = {
      id: roster.player.id,
      name: roster.player.name,
      role: roster.player.role,
      roles: roster.player.roles,
      isCaptain: captain ? roster.player.name.trim().toLowerCase() === captain : false,
    };
    if (!players.some((p) => p.id === self.id)) {
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
