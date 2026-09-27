import { SITE_BRAND_FULL } from "../../constants/siteMeta.js";
import { parseSeasonLabelFromName } from "../../utils/tournamentNaming.js";
import { SeasonRosterGrid } from "./SeasonRosterGrid.jsx";

/** @deprecated Standalone /teams route redirects to The League. Kept for lazy-import compatibility. */
export function PublicTeamsPage({ event, message, navigate }) {
  const tournament = event?.tournament;
  const seasonLabel = parseSeasonLabelFromName(tournament?.name) || tournament?.name || "Season";

  return (
    <div className="teams-page teams-page--legacy">
      <div className="teams-page__vignette" aria-hidden />
      <header className="teams-hero">
        <p className="teams-hero__eyebrow">{SITE_BRAND_FULL} {seasonLabel}</p>
        <h1 className="teams-hero__title">Competing Teams</h1>
      </header>
      <SeasonRosterGrid event={event} message={message} navigate={navigate} embedded />
    </div>
  );
}
