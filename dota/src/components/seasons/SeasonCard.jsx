import { Link } from "react-router-dom";
import {
  formatSeasonStatusUpper,
  normalizeTrophyEngraving,
  resolveSeasonCardActionLabel,
  resolveSeasonCardBg,
  resolveSeasonCardStats,
  resolveSeasonCardTagline,
  resolveSeasonDisplayStatus,
  seasonBadgeShort,
  seasonDisplayLabel,
} from "../../utils/seasonPayload.js";

const STATUS_CLASS = {
  active: "season-card__status--active",
  concluded: "season-card__status--concluded",
  upcoming: "season-card__status--upcoming",
};

export function SeasonCard({ season }) {
  const label = seasonDisplayLabel(season);
  const badge = seasonBadgeShort(season);
  const cardBg = resolveSeasonCardBg(season.heroMedia, season.tournamentCardBg);
  const summary = season.summary || {};
  const champion = normalizeTrophyEngraving(season.trophyEngraving).teamName || summary.championName || null;
  const displayStatus = resolveSeasonDisplayStatus(season, summary);
  const tagline = resolveSeasonCardTagline(season, summary, champion, displayStatus);
  const stats = resolveSeasonCardStats(displayStatus, summary, champion);
  const actionLabel = resolveSeasonCardActionLabel(displayStatus);

  const className = [
    "season-card",
    "season-card--liquid",
    "season-glass",
    cardBg ? "season-card--has-bg" : "",
    `season-card--${displayStatus}`,
  ]
    .filter(Boolean)
    .join(" ");

  const style = cardBg ? { "--season-card-bg": `url("${cardBg}")` } : undefined;

  return (
    <Link to={`/seasons/${season.slug}`} className={className} style={style} aria-label={`View ${label} archive`}>
      {cardBg ? <div className="season-card__bg" aria-hidden="true" /> : null}
      <div className="season-card__scrim" aria-hidden="true" />

      <div className="season-card__identity">
        <span className="season-card__badge" aria-hidden="true">
          {badge}
        </span>
        <div className="season-card__headline">
          <div className="season-card__title-row">
            <h2 className="season-card__title">{label}</h2>
            <span className={`season-card__status ${STATUS_CLASS[displayStatus] || ""}`}>
              {formatSeasonStatusUpper(displayStatus)}
            </span>
          </div>
          <p className="season-card__tagline">{tagline}</p>
        </div>
      </div>

      <div className="season-card__stats" aria-label={`${label} summary`}>
        {stats.map((stat) => (
          <div key={stat.label} className="season-card__stat">
            <span className="season-card__stat-label">{stat.label}</span>
            <span
              className={`season-card__stat-value${stat.highlight ? " season-card__stat-value--prize" : ""}`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="season-card__action">
        <span className="season-card__button">{actionLabel}</span>
      </div>
    </Link>
  );
}

export function SeasonsPageHeader() {
  return (
    <header className="seasons-hub__header" aria-labelledby="seasons-page-title">
      <h1 id="seasons-page-title" className="seasons-hub__title">
        Seasons
      </h1>
      <p className="seasons-hub__lead">
        Browse all BPC League seasons — past, present, and upcoming.
      </p>
    </header>
  );
}

export function SeasonsEmptyState() {
  return (
    <div className="seasons-hub__empty season-glass">
      <p className="seasons-hub__empty-title">Season archive coming soon</p>
      <p className="seasons-hub__empty-copy">
        Once a tournament concludes, its full snapshot will appear here. Follow{" "}
        <Link to="/announcements">news</Link> or join Discord for the next season announcement.
      </p>
    </div>
  );
}
