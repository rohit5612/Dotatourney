import { Link } from "react-router-dom";
import { HiOutlineChartBar, HiOutlineTrophy } from "react-icons/hi2";
import { LeagueFranchiseRoster } from "./LeagueFranchiseRoster.jsx";
import { hexToRgbTriplet } from "../../hooks/useLogoAccent.js";
import { seasonFinishLabel } from "../../utils/leagueSeasonLabels.js";
import "../../styles/league-teams-page.css";

function formatRecord(record) {
  if (!record || !record.played) return "—";
  const wr = record.winRate != null ? ` · ${record.winRate}%` : "";
  return `${record.wins}–${record.losses}${wr}`;
}

export function LeagueSeasonPanel({ season, franchiseName, defaultOpen = false }) {
  const accentRgb = hexToRgbTriplet(season.accentColor);
  const panelStyle = accentRgb ? { "--league-accent-rgb": accentRgb } : undefined;
  const players = season.roster?.players || [];
  const finishLabel = seasonFinishLabel(season);

  return (
    <details className="league-season" open={defaultOpen} style={panelStyle}>
      <summary className="league-season__summary">
        <div className="league-season__summary-main">
          <span className="league-season__title">
            Season {season.seasonNumber}
            {season.displayName && season.displayName !== franchiseName ? ` · ${season.displayName}` : ""}
          </span>
          {season.seasonSlug ? (
            <Link to={`/seasons/${season.seasonSlug}`} className="league-season__season-link" onClick={(e) => e.stopPropagation()}>
              View season
            </Link>
          ) : null}
        </div>
        <div className="league-season__stats" aria-label="Season summary">
          <span className="league-season__stat">
            <HiOutlineChartBar aria-hidden />
            <span className="league-season__stat-label">Record</span>
            <span className="league-season__stat-value">{formatRecord(season.record)}</span>
          </span>
          <span className="league-season__stat">
            <HiOutlineTrophy aria-hidden />
            <span className="league-season__stat-label">Finish</span>
            <span className="league-season__stat-value">{finishLabel}</span>
          </span>
          {season.roster?.seed ? (
            <span className="league-season__stat league-season__stat--muted">
              <span className="league-season__stat-label">Seed</span>
              <span className="league-season__stat-value">#{season.roster.seed}</span>
            </span>
          ) : null}
        </div>
        <span className="league-season__badges">
          {finishLabel && finishLabel !== "—" ? (
            <span className="league-season__placement">{finishLabel}</span>
          ) : null}
          {season.rosterPending ? <span className="league-season__pending">Roster pending</span> : null}
          {season.seasonStatus === "active" ? <span className="league-season__live">Live</span> : null}
        </span>
      </summary>

      <div className="league-season__body">
        <LeagueFranchiseRoster
          players={players}
          rosterPending={season.rosterPending}
          seasonNumber={season.seasonNumber}
        />
        {season.honors?.mvp ? (
          <p className="league-season__honor">
            MVP: {season.honors.mvp.playerName || season.honors.mvp.player_name}
          </p>
        ) : null}
      </div>
    </details>
  );
}
