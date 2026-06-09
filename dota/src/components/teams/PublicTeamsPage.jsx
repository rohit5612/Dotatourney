import { useMemo } from "react";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";
import { SITE_BRAND_FULL } from "../../constants/siteMeta.js";
import { TeamCard } from "./TeamCard.jsx";
import {
  enrichTeam,
  orderTeamsForTeamsPage,
  squadCountLabel,
} from "../../utils/teamPage.js";

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
      honors: event?.honors,
    };
    return orderTeamsForTeamsPage(rawTeams, context).map((team) => enrichTeam(team, context));
  }, [
    rawTeams,
    setupTeams,
    event?.standings,
    event?.groupedStandings,
    event?.matches,
    event?.schedule,
    event?.honors,
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
