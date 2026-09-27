import { useMemo } from "react";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";
import "../../styles/tournament-honors.css";
import { parseSeasonLabelFromName } from "../../utils/tournamentNaming.js";
import { TeamCard } from "./TeamCard.jsx";
import {
  buildLeagueFranchiseSlugLookup,
  enrichTeam,
  orderTeamsForTeamsPage,
  resolveTeamFranchiseHref,
  squadCountLabel,
} from "../../utils/teamPage.js";
import { PROFILE_BACK_LEAGUE_ROSTERS } from "../../utils/profileBackNav.js";

/**
 * Approved tournament roster grid (win rate, form, player links).
 * Used on The League (embedded) and legacy full-page wrapper.
 */
export function SeasonRosterGrid({
  event,
  message,
  navigate,
  embedded = false,
  profileBack = PROFILE_BACK_LEAGUE_ROSTERS,
  leagueTeams = [],
}) {
  const tournament = event?.tournament;
  const tournamentMode = tournament?.visibility_mode !== "demo";
  const rawTeams = event?.teams || [];
  const setupTeams = event?.setupTeams || [];

  const franchiseLookup = useMemo(() => buildLeagueFranchiseSlugLookup(leagueTeams), [leagueTeams]);

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

  const seasonLabel = parseSeasonLabelFromName(tournament?.name) || tournament?.name || "Season";
  const heroSubtitle = squadCountLabel(rawTeams.length || tournament?.team_count);

  if (!rawTeams.length) {
    if (embedded) return null;
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

  const grid = (
    <div className={embedded ? "league-roster-view" : "teams-page"}>
      {!embedded ? <div className="teams-page__vignette" aria-hidden /> : null}
      {message ? <p className={embedded ? "league-page__message" : "teams-page__message"}>{message}</p> : null}

      {embedded ? (
        <header className="league-roster-view__head">
          <p className="league-roster-view__eyebrow">{seasonLabel} campaign</p>
          <h2 className="league-roster-view__title">Season rosters</h2>
          <p className="league-roster-view__subtitle">{heroSubtitle}</p>
          <p className="league-roster-view__hint">
            Click a team card to open its franchise page — live stats here, collectible cards and history on the franchise
            profile.
          </p>
        </header>
      ) : (
        <header className="teams-hero">
          <p className="teams-hero__eyebrow">{seasonLabel} Roster</p>
          <h1 className="teams-hero__title">Competing Teams</h1>
          <p className="teams-hero__subtitle">{heroSubtitle}</p>
        </header>
      )}

      <div className={embedded ? "league-roster-view__grid teams-grid" : "teams-grid"}>
        {enrichedTeams.map((team, index) => (
          <TeamCard
            key={team.id || team.name}
            team={team}
            index={index}
            profileBack={profileBack}
            franchiseHref={resolveTeamFranchiseHref(team, franchiseLookup)}
          />
        ))}
      </div>
    </div>
  );

  return grid;
}
