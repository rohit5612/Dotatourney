import { useMemo } from "react";
import { SeasonCard, SeasonsEmptyState, SeasonsPageHeader } from "../../components/seasons/SeasonCard.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { api } from "../../lib/api";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";

export function SeasonsHubPage() {
  const fetchSeasons = useMemo(() => () => api.getPublicSeasons(), []);
  const { data, loading, error } = usePublicCachedQuery("public:seasons", fetchSeasons);
  const seasons = data?.seasons || [];

  const sortedSeasons = useMemo(
    () => [...seasons].sort((a, b) => (b.number ?? 0) - (a.number ?? 0)),
    [seasons],
  );

  return (
    <div className="seasons-page">
      <div className="seasons-hub">
        <SeasonsPageHeader />

        {error ? <p className="season-detail__error season-glass">{error}</p> : null}
        {loading ? (
          <div className="seasons-hub__loading">
            <PageLoadingSpinner label="Loading seasons…" compact />
          </div>
        ) : null}

        {!loading && !error && seasons.length === 0 ? <SeasonsEmptyState /> : null}

        {!loading && sortedSeasons.length > 0 ? (
          <div className="seasons-hub__list">
            {sortedSeasons.map((season) => (
              <SeasonCard key={season.id} season={season} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
