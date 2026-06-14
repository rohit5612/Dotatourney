import { memo } from "react";
import { HiOutlineChartBar, HiOutlineTrophy } from "react-icons/hi2";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { useInView } from "../../hooks/useInView.js";
import { teamAccentStyle, useLogoAccent } from "../../hooks/useLogoAccent.js";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import { PlayerRoleIcons } from "../PlayerRoleIcons.jsx";
import {
  playerDisplayName,
  playerInitials,
  teamInitials,
} from "../../utils/teamPage.js";
import { TeamHonorBadge } from "../honors/TournamentHonorsPanel.jsx";

function CrownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 16l-1-9 5 3 2-6 2 6 5-3-1 9H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}

export const TeamCard = memo(function TeamCard({ team, index = 0 }) {
  const { ref, inView } = useInView({ rootMargin: "280px 0px", threshold: 0.04 });
  const logo = team.logoUrl || team.logo_url || "";
  const logoUrl = normalizeTeamLogoUrl(logo);
  const hasCustomAccent = Boolean(team.accentColor || team.accent_color);
  const sampledAccent = useLogoAccent(logo, { enabled: inView && !hasCustomAccent });
  const initials = teamInitials(team);
  const accentStyle = teamAccentStyle(team, sampledAccent);
  const roster = team.players?.length ? team.players : [{ name: "Roster TBA", role: "Player" }];
  const staggerMs = inView && index < 9 ? Math.min(index, 8) * 55 : 0;

  return (
    <article
      ref={ref}
      className={`teams-card${logoUrl ? " teams-card--has-logo-bg" : ""}${hasCustomAccent ? " teams-card--custom-accent" : ""}${inView ? " teams-card--in-view" : ""}`}
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
            loading={index < 4 ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "low"}
          />
          <div className="teams-card__bg-vignette" />
        </div>
      ) : null}

      <section className="teams-card__spotlight" aria-label={`${team.name} team spotlight`}>
        <div className="teams-card__spotlight-scrim" aria-hidden />
        {inView ? <div className="teams-card__spotlight-shine" aria-hidden /> : null}

        {team.isLive ? (
          <span className="teams-card__live">
            <span className="teams-card__live-dot" aria-hidden />
            Live
          </span>
        ) : null}

        {team.bracketBadge ? (
          <TeamHonorBadge badge={team.bracketBadge} className="teams-card__honor-badge" />
        ) : null}

        <div className="teams-card__spotlight-main">
          {logo ? (
            <div className="teams-card__logo-wrap">
              <TeamLogoImg
                src={logo}
                alt=""
                className="teams-card__logo"
                width={200}
                height={200}
                loading={index < 4 ? "eager" : "lazy"}
                fetchPriority={index < 4 ? "high" : "low"}
              />
            </div>
          ) : (
            <span className="teams-card__logo-fallback">{initials}</span>
          )}
          <h3 className="teams-card__name">{team.name}</h3>
          {team.group ? <p className="teams-card__group">{team.group}</p> : null}
        </div>
      </section>

      <section className="teams-card__panel" aria-label={`${team.name} roster`}>
        <ul className="teams-card__roster">
          {roster.map((player) => {
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
          <HiOutlineChartBar aria-hidden />
          <span className="teams-card__strip-label">Win rate</span>
          <span className="teams-card__strip-value">
            {team.stats?.winRate != null ? `${team.stats.winRate}%` : "—"}
          </span>
        </div>
        <div className="teams-card__strip-stat">
          <HiOutlineTrophy aria-hidden />
          <span className="teams-card__strip-label">Standing</span>
          <span className="teams-card__strip-value">{team.stats?.standing ?? "—"}</span>
        </div>
        <div className="teams-card__strip-stat teams-card__strip-stat--form">
          <span className="teams-card__strip-label">Form</span>
          <div className="teams-card__form" aria-label="Recent form">
            {team.form?.length ? (
              team.form.map((result, i) => (
                <span
                  key={`${team.id || team.name}-form-${i}`}
                  className={`teams-form-pip teams-form-pip--${result.toLowerCase()}`}
                >
                  {result}
                </span>
              ))
            ) : (
              <span className="teams-card__strip-value teams-card__strip-value--muted">—</span>
            )}
          </div>
        </div>
      </footer>
    </article>
  );
});
