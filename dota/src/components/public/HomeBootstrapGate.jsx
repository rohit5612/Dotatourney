import { useEffect, useState } from "react";
import { PageLoadingSpinner } from "../PageLoadingSpinner.jsx";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { waitForHomeAssetsPreload } from "../../utils/preloadHomeAssets.js";

/**
 * Full-viewport bootstrap for "/": tournament payload + hero/media assets.
 * Other public routes use compact loaders only (PublicEventGate / Suspense).
 */
export function HomeBootstrapGate({ children, label = "Loading home…" }) {
  const { ready } = usePublicTournament();
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void waitForHomeAssetsPreload().finally(() => {
      if (active) setAssetsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready || !assetsReady) {
    return <PageLoadingSpinner label={label} overlay />;
  }

  return children;
}
