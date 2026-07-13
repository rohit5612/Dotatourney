import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BpclCardRenderer } from "../../components/cards/BpclCardRenderer.jsx";
import { CardRendererSkeleton } from "../../components/cards/CardRendererSkeleton.jsx";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import { api } from "../../lib/api";
import "../../styles/overlay-card.css";

const CARD_SIZES = new Set(["sm", "md", "lg"]);

function resolveCardSize(value) {
  const size = String(value || "").trim().toLowerCase();
  return CARD_SIZES.has(size) ? size : "md";
}

export function OverlayCardPage() {
  const { bpcId } = useParams();
  const [searchParams] = useSearchParams();
  const size = resolveCardSize(searchParams.get("size"));
  const normalizedBpcId = String(bpcId || "").trim();

  useEffect(() => {
    document.documentElement.classList.add("overlay-card-root");
    return () => {
      document.documentElement.classList.remove("overlay-card-root");
    };
  }, []);

  const cacheKey = `public:card:bpc:${normalizedBpcId.toUpperCase()}`;
  const fetchCard = useMemo(
    () => () => api.getPublicCardByBpcId(normalizedBpcId),
    [normalizedBpcId],
  );
  const { data, loading, error } = usePublicCachedQuery(cacheKey, fetchCard);

  const manifest = data?.card;

  return (
    <main className="overlay-card-page" aria-label={`Player card ${normalizedBpcId || ""}`.trim()}>
      {loading ? <CardRendererSkeleton size={size} /> : null}
      {!loading && error ? <p className="overlay-card-page__state">Unknown BPC ID</p> : null}
      {!loading && !error && manifest ? (
        <BpclCardRenderer manifest={manifest} size={size} showMeta={false} interactive={false} />
      ) : null}
    </main>
  );
}
