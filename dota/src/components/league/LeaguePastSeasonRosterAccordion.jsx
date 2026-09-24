import { Link } from "react-router-dom";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { LeagueFranchiseRoster } from "./LeagueFranchiseRoster.jsx";
import { seasonFinishLabel } from "../../utils/leagueSeasonLabels.js";
import {
  formatSeasonStatusUpper,
  resolveSeasonCardBg,
  resolveSeasonDisplayStatus,
  seasonBadgeShort,
  seasonDisplayLabel,
} from "../../utils/seasonPayload.js";
import "../../styles/league-teams-page.css";
import "../../styles/seasons-page.css";

const STATUS_CLASS = {
  active: "season-card__status--active",
  concluded: "season-card__status--concluded",
  upcoming: "season-card__status--upcoming",
};

function formatRecord(record) {
  if (!record || !record.played) return "—";
  const wr = record.winRate != null ? ` · ${record.winRate}%` : "";
  return `${record.wins}–${record.losses}${wr}`;
}

export function LeaguePastSeasonRosterAccordion({
  season,
  seasonArchive,
  franchiseName,
  isExpanded,
  onToggle,
}) {
  const panelId = `league-past-roster-panel-${season.seasonId}`;
  const triggerId = `league-past-roster-trigger-${season.seasonId}`;
  const finishLabel = seasonFinishLabel(season);
  const players = season.roster?.players || [];

  const cardBg = resolveSeasonCardBg(seasonArchive?.heroMedia, seasonArchive?.tournamentCardBg);
  const displayStatus = seasonArchive
    ? resolveSeasonDisplayStatus(seasonArchive, seasonArchive.summary || {})
    : season.seasonStatus === "active"
      ? "active"
      : "concluded";
  const title = seasonArchive ? seasonDisplayLabel(seasonArchive) : `Season ${season.seasonNumber}`;
  const badge = seasonArchive
    ? seasonBadgeShort(seasonArchive)
    : season.seasonNumber != null
      ? `S${season.seasonNumber}`
      : "—";

  const taglineParts = [];
  if (season.displayName && season.displayName !== franchiseName) {
    taglineParts.push(season.displayName);
  } else if (seasonArchive?.name && seasonArchive.name !== title) {
    taglineParts.push(seasonArchive.name);
  }
  if (finishLabel && finishLabel !== "—") taglineParts.push(finishLabel);
  const tagline = taglineParts.length ? taglineParts.join(" · ") : "Archived lineup";

  const cardStyle = cardBg ? { "--season-card-bg": `url("${cardBg}")` } : undefined;

  const wrapperClass = [
    "league-past-roster-season",
    "match-history-season",
    "season-card",
    "season-card--liquid",
    "season-glass",
    cardBg ? "season-card--has-bg" : "",
    cardBg ? "match-history-season--has-bg" : "",
    `season-card--${displayStatus}`,
    isExpanded ? "match-history-season--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass} style={cardStyle} data-season-id={season.seasonId}>
      {cardBg ? <div className="season-card__bg" aria-hidden="true" /> : null}
      <div className="season-card__scrim" aria-hidden="true" />

      <button
        type="button"
        id={triggerId}
        className="match-history-season__trigger league-past-roster-season__trigger"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="season-card__identity">
          <span className="season-card__badge" aria-hidden="true">{badge}</span>
          <div className="season-card__headline">
            <div className="season-card__title-row">
              <span className="season-card__title">{title}</span>
              <span className={`season-card__status ${STATUS_CLASS[displayStatus] || ""}`}>
                {formatSeasonStatusUpper(displayStatus)}
              </span>
            </div>
            <p className="season-card__tagline">{tagline}</p>
          </div>
        </div>

        <div className="season-card__stats" aria-label={`${title} summary`}>
          <div className="season-card__stat">
            <span className="season-card__stat-label">Record</span>
            <span className="season-card__stat-value">{formatRecord(season.record)}</span>
          </div>
          <div className="season-card__stat">
            <span className="season-card__stat-label">Finish</span>
            <span className="season-card__stat-value">{finishLabel}</span>
          </div>
          {season.roster?.seed ? (
            <div className="season-card__stat match-history-season__stat--hide-sm">
              <span className="season-card__stat-label">Seed</span>
              <span className="season-card__stat-value">#{season.roster.seed}</span>
            </div>
          ) : null}
        </div>

        <span className="league-past-roster-season__dropdown-label">
          {isExpanded ? "Hide roster" : "View roster"}
        </span>
        <HiOutlineChevronDown className="match-history-season__chevron" aria-hidden="true" />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="match-history-season__panel league-past-roster-season__panel"
        hidden={!isExpanded}
      >
        {isExpanded ? (
          <>
            {season.seasonSlug ? (
              <div className="match-history-season__panel-bar">
                <Link to={`/seasons/${season.seasonSlug}`} className="match-history-season__season-link">
                  View season archive
                </Link>
              </div>
            ) : null}
            <div className="league-past-roster-season__body">
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
          </>
        ) : null}
      </div>
    </div>
  );
}
