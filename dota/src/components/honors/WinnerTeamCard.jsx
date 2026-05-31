import { memo } from "react";
import { HiOutlineTrophy } from "react-icons/hi2";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { PlayerRoleIcons } from "../PlayerRoleIcons.jsx";
import { useInView } from "../../hooks/useInView.js";
import { teamAccentStyle, useLogoAccent } from "../../hooks/useLogoAccent.js";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import {
  findTeamByName,
  playerDisplayName,
  playerInitials,
  sortPlayersByRole,
  teamInitials,
} from "../../utils/teamPage.js";
import { winnerCardVariant } from "../../utils/tournamentHonors.js";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";

function CrownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 16l-1-9 5 3 2-6 2 6 5-3-1 9H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}

function placementLabel(entry) {
  if (entry.placement === 1) return "Champion";
  if (entry.placement === 2) return "Runner-up";
  if (entry.placement === 3) return "3rd Place";
  return entry.role || `#${entry.placement}`;
}

function placementStanding(entry) {
  if (entry.placement === 1) return "1st";
  if (entry.placement === 2) return "2nd";
  if (entry.placement === 3) return "3rd";
  return `#${entry.placement}`;
}

function finishStage(entry) {
  if (entry.placement === 1 || entry.placement === 2) return "Grand Final";
  if (entry.placement === 3) return "Semifinals";
  return "Playoffs";
}

export const WinnerTeamCard = memo(function WinnerTeamCard({ entry, teamLookup, variant = "full", index = 0 }) {
  const { ref, inView } = useInView({ rootMargin: "220px 0px", threshold: 0.05 });
  const team = findTeamByName(teamLookup, entry.teamName);
  const logo = team?.logoUrl || team?.logo_url || "";
  const logoUrl = normalizeTeamLogoUrl(logo);
  const hasCustomAccent = Boolean(team?.accentColor || team?.accent_color);
  const sampledAccent = useLogoAccent(logo, { enabled: inView && !hasCustomAccent });
  const accentStyle = teamAccentStyle(team || { name: entry.teamName }, sampledAccent);
  const cardVariant = winnerCardVariant(entry.placement);
  const isChampion = entry.placement === 1;
  const roster = sortPlayersByRole(team?.players?.length ? team.players : []);
  const displayRoster = roster.length ? roster : [{ name: "Roster TBA", role: "Player" }];
  const staggerMs = inView ? Math.min(index, 6) * 80 : 0;

  return (
    <article
      ref={ref}
      className={[
        "teams-card",
        "teams-card--podium",
        `teams-card--podium-${cardVariant}`,
        logoUrl ? "teams-card--has-logo-bg" : "",
        hasCustomAccent ? "teams-card--custom-accent" : "",
        inView ? "teams-card--in-view" : "",
        isChampion ? "teams-card--podium-featured" : "",
        variant === "compact" ? "teams-card--podium-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...accentStyle,
        "--teams-stagger": `${staggerMs}ms`,
      }}
    >
      {logoUrl ? (
        <div className="teams-card__bg" aria-hidden>
          <TeamLogoImg
            src={logo}
            alt=""
            className="teams-card__bg-logo"
            width={480}
            height={480}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "low"}
          />
          <div className="teams-card__bg-vignette" />
        </div>
      ) : null}

      <div className="teams-card__podium-aura" aria-hidden />
      <div className="teams-card__podium-ring" aria-hidden />

      <section className="teams-card__spotlight" aria-label={`${entry.teamName} ${placementLabel(entry)}`}>
        <div className="teams-card__spotlight-scrim" aria-hidden />
        {inView ? <div className="teams-card__spotlight-shine teams-card__spotlight-shine--podium" aria-hidden /> : null}

        <span className="teams-card__podium-badge">{placementLabel(entry)}</span>

        <div className="teams-card__spotlight-main">
          {logo ? (
            <div className={`teams-card__logo-wrap${isChampion ? " teams-card__logo-wrap--crowned" : ""}`}>
              {isChampion ? <span className="teams-card__podium-crown" aria-hidden /> : null}
              <TeamLogoImg
                src={logo}
                alt=""
                className="teams-card__logo"
                width={220}
                height={220}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "low"}
              />
            </div>
          ) : (
            <span className="teams-card__logo-fallback">{teamInitials(team || { name: entry.teamName })}</span>
          )}
          <h3 className="teams-card__name">{entry.teamName}</h3>
          {isChampion ? <p className="teams-card__podium-tagline">Crowned in the grand final</p> : null}
        </div>
      </section>

      <section className="teams-card__panel" aria-label={`${entry.teamName} roster`}>
        <ul className="teams-card__roster">
          {displayRoster.map((player) => {
            const isCaptain = Boolean(player.isCaptain);
            const name = playerDisplayName(player);
            return (
              <li
                key={player.id || `${name}-${player.role}`}
                className={`teams-roster-row${isCaptain ? " teams-roster-row--captain" : ""}`}
              >
                <span className="teams-roster-row__avatar" aria-hidden>
                  {playerInitials(name)}
                </span>
                <PlayerRoleIcons player={player} className="teams-roster-row__roles" size="sm" />
                <span className="teams-roster-row__name">{name}</span>
                {isCaptain ? (
                  <span className="teams-roster-row__captain" title="Captain">
                    <CrownIcon />
                    <span>Captain</span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="teams-card__strip">
        <div className="teams-card__strip-stat">
          <HiOutlineTrophy aria-hidden />
          <span className="teams-card__strip-label">Placement</span>
          <span className="teams-card__strip-value">{placementStanding(entry)}</span>
        </div>
        <div className="teams-card__strip-stat">
          <span className="teams-card__strip-label">Honor</span>
          <span className="teams-card__strip-value">{placementLabel(entry)}</span>
        </div>
        <div className="teams-card__strip-stat teams-card__strip-stat--form">
          <span className="teams-card__strip-label">Stage</span>
          <span className="teams-card__strip-value">{finishStage(entry)}</span>
        </div>
      </footer>
    </article>
  );
});

export function WinnerTeamCardGrid({ podiumTeams, teamLookup, variant = "full", className = "" }) {
  if (!podiumTeams?.length) return null;

  const sorted = [...podiumTeams].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));

  return (
    <div className={`winner-team-grid winner-team-grid--${variant} ${className}`.trim()}>
      {sorted.map((entry, index) => (
        <WinnerTeamCard
          key={`${entry.teamName}-${entry.placement}-${index}`}
          entry={entry}
          teamLookup={teamLookup}
          variant={variant}
          index={index}
        />
      ))}
    </div>
  );
}
