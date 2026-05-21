import { memo, useMemo } from "react";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { HiOutlineChartBar, HiOutlineTrophy } from "react-icons/hi2";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";
import { SITE_BRAND_FULL } from "../../constants/siteMeta.js";
import { useInView } from "../../hooks/useInView.js";
import { teamAccentStyle, useLogoAccent } from "../../hooks/useLogoAccent.js";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import { PlayerRoleIcons } from "../PlayerRoleIcons.jsx";
import {
  enrichTeam,
  orderTeamsForTeamsPage,
  playerDisplayName,
  playerInitials,
  squadCountLabel,
  teamInitials,
} from "../../utils/teamPage.js";

function CrownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 16l-1-9 5 3 2-6 2 6 5-3-1 9H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}

const TeamCard = memo(function TeamCard({ team, index }) {
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
            {team.stats.winRate != null ? `${team.stats.winRate}%` : "—"}
          </span>
        </div>
        <div className="teams-card__strip-stat">
          <HiOutlineTrophy aria-hidden />
          <span className="teams-card__strip-label">Standing</span>
          <span className="teams-card__strip-value">{team.stats.standing}</span>
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

export function PublicTeamsPage({ event, message, navigate }) {
  const tournament = event?.tournament;
  const tournamentMode = tournament?.visibility_mode !== "demo";
  const rawTeams = event?.teams || [];

  const setupTeams = event?.setupTeams || [];

  const enrichedTeams = useMemo(() => {
    const context = {
      standings: event?.standings,
      groupedStandings: event?.groupedStandings,
      matches: event?.matches,
      schedule: event?.schedule,
      format: tournament?.format,
      setupTeams,
    };
    return orderTeamsForTeamsPage(rawTeams, context).map((team) => enrichTeam(team, context));
  }, [
    rawTeams,
    setupTeams,
    event?.standings,
    event?.groupedStandings,
    event?.matches,
    event?.schedule,
    tournament?.format,
  ]);

  const heroEyebrow = `${SITE_BRAND_FULL} Season 1 Roster`;

  const heroSubtitle = squadCountLabel(rawTeams.length || tournament?.team_count);

  if (!tournamentMode || !rawTeams.length) {
    return (
      <div className="teams-page">
        {message ? <p className="teams-page__message">{message}</p> : null}
        <section className="teams-empty">
          <p className="teams-empty__eyebrow">Competing squads</p>
          <h2 className="teams-empty__title">Competing Teams</h2>
          <p className="teams-empty__copy">
            {tournamentMode
              ? "Teams will appear here once rosters are finalized."
              : "Check back after the tournament goes live — approved rosters will be listed here."}
          </p>
          {tournamentMode ? (
            <button type="button" className="teams-empty__btn" onClick={() => navigate("/register")}>
              Register now
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="teams-page">
      <div className="teams-page__vignette" aria-hidden />

      {message ? <p className="teams-page__message">{message}</p> : null}

      <header className="teams-hero">
        <p className="teams-hero__eyebrow">{heroEyebrow}</p>
        <h1 className="teams-hero__title">Competing Teams</h1>
        <p className="teams-hero__subtitle">{heroSubtitle}</p>
      </header>

      <div className="teams-grid">
        {enrichedTeams.map((team, index) => (
          <TeamCard key={team.id || team.name} team={team} index={index} />
        ))}
      </div>
    </div>
  );
}
