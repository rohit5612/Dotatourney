import { useMemo } from "react";
import { Link } from "react-router-dom";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { PageLoadingSpinner } from "../../PageLoadingSpinner.jsx";
import { useShowMoreList } from "../../../hooks/useShowMoreList.js";
import { seasonGroupLabel, summarizeSeasonRows } from "../../../utils/matchHistorySeasonGroups.js";
import {
  formatSeasonStatusUpper,
  resolveSeasonCardBg,
  resolveSeasonDisplayStatus,
  seasonBadgeShort,
  seasonDisplayLabel,
} from "../../../utils/seasonPayload.js";
import { FeedMatchPost } from "./FeedMatchPost.jsx";

const STATUS_CLASS = {
  active: "season-card__status--active",
  concluded: "season-card__status--concluded",
  upcoming: "season-card__status--upcoming",
};

function formatShortDate(date) {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SEASON_MATCH_PAGE_SIZE = 4;

export function SeasonMatchAccordion({
  group,
  seasonArchive,
  isExpanded,
  isLoading,
  isLoaded,
  isLatest = false,
  onToggle,
}) {
  const summary = useMemo(() => summarizeSeasonRows(group.rows), [group.rows]);
  const panelId = `match-season-panel-${group.key}`;
  const triggerId = `match-season-trigger-${group.key}`;

  const cardBg = resolveSeasonCardBg(seasonArchive?.heroMedia, seasonArchive?.tournamentCardBg);
  const displayStatus = seasonArchive
    ? resolveSeasonDisplayStatus(seasonArchive, seasonArchive.summary || {})
    : "concluded";
  const title = seasonArchive ? seasonDisplayLabel(seasonArchive) : seasonGroupLabel(group);
  const badge = seasonArchive
    ? seasonBadgeShort(seasonArchive)
    : group.seasonNumber != null
      ? `S${group.seasonNumber}`
      : "—";
  const tagline =
    group.tournamentName && seasonArchive?.name && group.tournamentName !== seasonArchive.name
      ? group.tournamentName
      : seasonArchive?.summary?.championName
        ? `Champion · ${seasonArchive.summary.championName}`
        : group.tournamentName || "Circuit matches";

  const cardStyle = cardBg ? { "--season-card-bg": `url("${cardBg}")` } : undefined;

  const wrapperClass = [
    "match-history-season",
    "season-card",
    "season-card--liquid",
    "season-glass",
    cardBg ? "season-card--has-bg" : "",
    `season-card--${displayStatus}`,
    isExpanded ? "match-history-season--open" : "",
    isLoading ? "match-history-season--loading" : "",
    isLatest ? "match-history-season--latest" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const {
    visible: visibleRows,
    hasMore,
    canCollapse,
    remaining,
    showMore,
    showLess,
  } = useShowMoreList(isLoaded ? group.rows : [], {
    pageSize: SEASON_MATCH_PAGE_SIZE,
    stepLoad: true,
    resetKey: `${group.key}:${group.rows.length}:${isLoaded}`,
  });

  const recordLabel =
    summary.wins + summary.losses > 0 ? `${summary.wins}W · ${summary.losses}L` : "—";

  return (
    <div className={wrapperClass} style={cardStyle}>
      {cardBg ? <div className="season-card__bg" aria-hidden="true" /> : null}
      <div className="season-card__scrim" aria-hidden="true" />

      <button
        type="button"
        id={triggerId}
        className="match-history-season__trigger"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => onToggle(group.key)}
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

        <div className="season-card__stats" aria-label={`${title} match summary`}>
          <div className="season-card__stat">
            <span className="season-card__stat-label">Record</span>
            <span className="season-card__stat-value">{recordLabel}</span>
          </div>
          <div className="season-card__stat">
            <span className="season-card__stat-label">Matches</span>
            <span className="season-card__stat-value">{summary.total}</span>
          </div>
          {summary.lastAt ? (
            <div className="season-card__stat match-history-season__stat--hide-sm">
              <span className="season-card__stat-label">Latest</span>
              <span className="season-card__stat-value">{formatShortDate(summary.lastAt)}</span>
            </div>
          ) : null}
        </div>

        <HiOutlineChevronDown className="match-history-season__chevron" aria-hidden="true" />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="match-history-season__panel"
        hidden={!isExpanded}
      >
        {isExpanded ? (
          <>
            {group.seasonSlug ? (
              <div className="match-history-season__panel-bar">
                <Link to={`/seasons/${group.seasonSlug}`} className="match-history-season__season-link">
                  View season archive
                </Link>
              </div>
            ) : null}

            {isLoading ? (
              <div className="match-history-season__loading" aria-busy="true">
                <PageLoadingSpinner label="Loading matches…" compact />
              </div>
            ) : (
              <div className="match-history-season__feed">
                {visibleRows.map((row) => (
                  <FeedMatchPost
                    key={`${group.key}-${row.matchId}-${row.teamName}-${row.appearanceLabel}`}
                    row={row}
                    hideSeasonHeader
                    nested
                  />
                ))}
                {hasMore || canCollapse ? (
                  <div className="match-history-season__more">
                    {hasMore ? (
                      <button type="button" className="match-history-season__more-btn" onClick={showMore}>
                        Load more
                        {remaining > 0 ? ` (${remaining} left)` : ""}
                      </button>
                    ) : null}
                    {canCollapse ? (
                      <button type="button" className="match-history-season__more-btn" onClick={showLess}>
                        Show fewer
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
