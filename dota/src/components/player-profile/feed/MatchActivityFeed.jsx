import { useCallback, useMemo, useState } from "react";
import { api } from "../../../lib/api.js";
import { usePublicCachedQuery } from "../../../hooks/usePublicCachedQuery.js";
import {
  enrichMatchRowsWithDota,
  groupMatchesBySeason,
} from "../../../utils/matchHistorySeasonGroups.js";
import { SeasonMatchAccordion } from "./SeasonMatchAccordion.jsx";

const LOAD_DELAY_MS = 320;

export function MatchActivityFeed({ allMatches, dotaMatchById, panelClass = "" }) {
  const seasonGroups = useMemo(() => groupMatchesBySeason(allMatches), [allMatches]);
  const latestSeasonKey = seasonGroups[0]?.key ?? null;

  const fetchSeasons = useMemo(() => () => api.getPublicSeasons(), []);
  const { data: seasonsPayload } = usePublicCachedQuery("public:seasons", fetchSeasons);
  const seasonArchiveBySlug = useMemo(() => {
    const map = new Map();
    for (const season of seasonsPayload?.seasons || []) {
      if (season?.slug) map.set(season.slug, season);
    }
    return map;
  }, [seasonsPayload?.seasons]);

  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [loadedKeys, setLoadedKeys] = useState(() => new Set());
  const [loadingKey, setLoadingKey] = useState(null);

  const onToggle = useCallback(
    (key) => {
      if (expandedKeys.has(key)) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      setExpandedKeys((prev) => new Set(prev).add(key));

      if (loadedKeys.has(key)) return;

      setLoadingKey(key);
      window.setTimeout(() => {
        setLoadedKeys((prev) => new Set(prev).add(key));
        setLoadingKey((current) => (current === key ? null : current));
      }, LOAD_DELAY_MS);
    },
    [expandedKeys, loadedKeys],
  );

  if (!allMatches?.length) return null;

  return (
    <section
      className={`match-history profile-feed__match-history-panel ${panelClass}`.trim()}
      aria-label="Match history"
    >
      <header className="match-history__head">
        <div>
          <p className="match-history__eyebrow">Circuit</p>
          <h2 className="match-history__title">Match history</h2>
          <p className="match-history__lead">
            Expand a season for results and OpenDota lines when synced.
          </p>
        </div>
        <div className="match-history__summary-pill" aria-label="Total matches">
          <span className="match-history__summary-value">{allMatches.length}</span>
          <span className="match-history__summary-label">Matches</span>
        </div>
      </header>

      <div className="seasons-page seasons-page--match-history">
        <div className="match-history__seasons">
          {seasonGroups.map((group) => {
            const rowsForDisplay = loadedKeys.has(group.key)
              ? enrichMatchRowsWithDota(group.rows, dotaMatchById)
              : group.rows;
            const seasonArchive = group.seasonSlug ? seasonArchiveBySlug.get(group.seasonSlug) : null;
            return (
              <SeasonMatchAccordion
                key={group.key}
                group={{ ...group, rows: rowsForDisplay }}
                seasonArchive={seasonArchive}
                isExpanded={expandedKeys.has(group.key)}
                isLoading={loadingKey === group.key}
                isLoaded={loadedKeys.has(group.key)}
                isLatest={group.key === latestSeasonKey}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
