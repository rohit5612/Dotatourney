import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { PlayerRoleIcons } from "../PlayerRoleIcons.jsx";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import { displayRole, findTeamByName, playerDisplayName, playerInitials } from "../../utils/teamPage.js";
import { resolveMvpPlayer } from "../../utils/tournamentHonors.js";
import "../../styles/team-logo-img.css";

export function MvpShowcaseCard({ mvp, teams, teamLookup, variant = "full" }) {
  if (!mvp?.teamName && !mvp?.playerName && !mvp?.playerId) return null;

  const team = findTeamByName(teamLookup, mvp.teamName) || (teams || []).find((entry) => entry.name === mvp.teamName);
  const player = resolveMvpPlayer(teams || (team ? [team] : []), mvp);
  const playerName = player ? playerDisplayName(player) : mvp.playerName || "MVP";
  const roleLabel = player ? displayRole(player.role || player.roles?.[0]) : null;
  const logo = team?.logoUrl || team?.logo_url || "";
  const logoUrl = normalizeTeamLogoUrl(logo);
  const sizeClass = variant === "compact" ? "mvp-showcase--compact" : "mvp-showcase--full";

  return (
    <article
      className={`mvp-showcase ${sizeClass}${logoUrl ? " mvp-showcase--has-logo-bg" : ""}`}
      aria-label={`MVP ${playerName}`}
    >
      {logoUrl ? (
        <div className="mvp-showcase__bg" aria-hidden>
          <TeamLogoImg src={logo} alt="" className="mvp-showcase__bg-logo" width={560} height={560} loading="lazy" />
          <div className="mvp-showcase__bg-vignette" />
        </div>
      ) : null}
      <div className="mvp-showcase__backdrop" aria-hidden />
      <div className="mvp-showcase__shine" aria-hidden />
      <div className="mvp-showcase__grid">
        <div className="mvp-showcase__player-col">
          <p className="mvp-showcase__eyebrow">Tournament MVP</p>
          <div className="mvp-showcase__avatar-ring">
            <span className="mvp-showcase__avatar">{playerInitials(playerName)}</span>
            {player ? <PlayerRoleIcons player={player} className="mvp-showcase__roles" size="md" /> : null}
          </div>
          <h3 className="mvp-showcase__player-name">{playerName}</h3>
          {roleLabel ? <p className="mvp-showcase__role">{roleLabel}</p> : null}
          {mvp.teamName ? <p className="mvp-showcase__team-name">{mvp.teamName}</p> : null}
        </div>
        <div className="mvp-showcase__team-col">
          {logo ? (
            <TeamLogoImg src={logo} alt="" className="mvp-showcase__team-logo" width={140} height={140} loading="lazy" />
          ) : (
            <span className="mvp-showcase__team-logo-fallback" aria-hidden>
              {String(mvp.teamName || "MVP")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          {mvp.prize ? (
            <div className="mvp-showcase__prize">
              <span className="mvp-showcase__prize-label">Prize</span>
              <span className="mvp-showcase__prize-value">{mvp.prize}</span>
            </div>
          ) : null}
          {mvp.notes ? <p className="mvp-showcase__notes">{mvp.notes}</p> : null}
        </div>
      </div>
    </article>
  );
}
