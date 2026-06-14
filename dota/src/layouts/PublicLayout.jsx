import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { CookieConsentBanner } from "../components/public/CookieConsentBanner.jsx";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import { SiteNavbar } from "../components/navigation/SiteNavbar.jsx";
import { PageLoadingSpinner } from "../components/PageLoadingSpinner";
import { PublicTournamentProvider } from "../context/PublicTournamentContext.jsx";
import { usePublicTheme } from "../hooks/usePublicTheme.js";
import { startHomeAssetsPreload } from "../utils/preloadHomeAssets.js";
import "../styles/publicPagesStyles.js";

/** Warm route JS chunks after first paint so navigations feel instant. */
const PUBLIC_ROUTE_CHUNK_PRELOADS = [
  () => import("../components/teams/PublicTeamsPage.jsx"),
  () => import("../components/BracketDiagram.jsx"),
  () => import("../pages/public/SeasonsHubPage.jsx"),
  () => import("../pages/public/SeasonDetailPage.jsx"),
  () => import("../pages/public/CommunityPage.jsx"),
  () => import("../pages/public/AnnouncementsPublicPage.jsx"),
  () => import("../pages/public/PublicPlayerProfilePage.jsx"),
  () => import("../pages/public/MatchPublicPage.jsx"),
];

function PublicLayoutInner() {
  const location = useLocation();
  const path = location.pathname;
  usePublicTheme();

  useEffect(() => {
    startHomeAssetsPreload();
  }, []);

  useEffect(() => {
    const run = () => {
      void Promise.all(PUBLIC_ROUTE_CHUNK_PRELOADS.map((load) => load().catch(() => {})));
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 4_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(run, 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteNavbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoadingSpinner label="Loading page…" compact />}>
          <Outlet />
        </Suspense>
      </main>
      <AppFooter mode="public" className="relative z-10" />
      <CookieConsentBanner />
      <ScrollToTopButton />
    </div>
  );
}

export function PublicLayout() {
  return (
    <PublicTournamentProvider>
      <PublicLayoutInner />
    </PublicTournamentProvider>
  );
}
