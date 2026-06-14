import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { SeasonDetailContent } from "../../components/seasons/SeasonDetailContent.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { api } from "../../lib/api";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import { normalizeSeasonPayload, seasonDisplayLabel } from "../../utils/seasonPayload.js";

export function SeasonDetailPage() {
  const { slug } = useParams();
  const cacheKey = `public:season:${String(slug || "").trim().toLowerCase()}`;
  const fetchSeason = useMemo(() => () => api.getPublicSeason(slug), [slug]);
  const { data, loading, error } = usePublicCachedQuery(cacheKey, fetchSeason);

  const payload = useMemo(() => normalizeSeasonPayload(data), [data]);
  const label = payload ? seasonDisplayLabel(payload.season) : "Season";

  return (
    <div className="seasons-page seasons-page--detail">
      {error ? (
        <div className="season-detail season-detail--message">
          <p className="season-detail__error season-glass">{error}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="season-detail season-detail--message">
          <PageLoadingSpinner label={`Loading ${label}…`} compact />
        </div>
      ) : null}

      {!loading && !error && payload ? <SeasonDetailContent payload={payload} /> : null}
      {!loading && !error && !payload && !data ? (
        <div className="season-detail season-detail--message">
          <p className="season-detail__muted">Season not found.</p>
        </div>
      ) : null}
    </div>
  );
}
