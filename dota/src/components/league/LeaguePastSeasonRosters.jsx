import { useCallback, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import { LeaguePastSeasonRosterAccordion } from "./LeaguePastSeasonRosterAccordion.jsx";
import "../../styles/league-teams-page.css";
import "../../styles/seasons-page.css";

export function LeaguePastSeasonRosters({ pastSeasons, franchiseName }) {
  const fetchSeasons = useMemo(() => () => api.getPublicSeasons(), []);
  const { data: seasonsPayload } = usePublicCachedQuery("public:seasons", fetchSeasons);

  const seasonArchiveBySlug = useMemo(() => {
    const map = new Map();
    for (const season of seasonsPayload?.seasons || []) {
      if (season?.slug) map.set(season.slug, season);
    }
    return map;
  }, [seasonsPayload?.seasons]);

  const [expandedId, setExpandedId] = useState("");

  const onToggleSeason = useCallback((seasonId) => {
    setExpandedId((current) => (current === seasonId ? "" : seasonId));
  }, []);

  const onPickerChange = useCallback((event) => {
    const value = event.target.value;
    setExpandedId(value || "");
    if (!value) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-season-id="${value}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  if (!pastSeasons?.length) return null;

  return (
    <section className="league-detail-section league-past-rosters" aria-labelledby="league-past-rosters-title">
      <header className="league-detail-section__head">
        <h2 id="league-past-rosters-title" className="league-detail-section__title">Past season rosters</h2>
        <p className="league-detail-section__subtitle">
          Each season uses its archive art from setup. Open a season to see that lineup.
        </p>
      </header>

      <div className="league-past-rosters__picker">
        <label className="league-past-rosters__picker-label" htmlFor="league-past-roster-select">
          View roster
        </label>
        <div className="league-past-rosters__picker-row">
          <select
            id="league-past-roster-select"
            className="league-past-rosters__select"
            value={expandedId}
            onChange={onPickerChange}
          >
            <option value="">Choose a season…</option>
            {pastSeasons.map((season) => (
              <option key={season.seasonId} value={season.seasonId}>
                Season {season.seasonNumber}
                {season.displayName && season.displayName !== franchiseName ? ` · ${season.displayName}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="seasons-page seasons-page--match-history seasons-page--league-rosters">
        <div className="match-history__seasons league-past-rosters__list">
          {pastSeasons.map((season) => {
            const seasonArchive = season.seasonSlug ? seasonArchiveBySlug.get(season.seasonSlug) : null;
            return (
              <LeaguePastSeasonRosterAccordion
                key={season.seasonId}
                season={season}
                seasonArchive={seasonArchive}
                franchiseName={franchiseName}
                isExpanded={expandedId === season.seasonId}
                onToggle={() => onToggleSeason(season.seasonId)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
