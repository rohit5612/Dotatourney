import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { CookieConsentBanner } from "../components/public/CookieConsentBanner.jsx";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import { SiteNavbar } from "../components/navigation/SiteNavbar.jsx";
import { PageLoadingSpinner } from "../components/PageLoadingSpinner";
import { PublicTournamentProvider, usePublicTournament } from "../context/PublicTournamentContext.jsx";
import { usePublicTheme } from "../hooks/usePublicTheme.js";

const PUBLIC_ROUTE_STYLES = {
  "/": () => Promise.all([import("../styles/landing-hero.css"), import("../styles/tournament-honors.css")]),
  "/tournament": () => Promise.all([import("../styles/tournament-page.css"), import("../styles/tournament-honors.css")]),
  "/teams": () => Promise.all([import("../styles/teams-page.css"), import("../styles/tournament-honors.css")]),
  "/schedule": () => import("../styles/schedule-page.css"),
  "/rules": () => import("../styles/general-rules-page.css"),
  "/register": () => import("../styles/general-rules-page.css"),
  "/seasons": () => import("../styles/tournament-page.css"),
  "/announcements": () => import("../styles/tournament-page.css"),
  "/community": () => import("../styles/tournament-page.css"),
};

function PublicLayoutInner() {
  const location = useLocation();
  const { ready } = usePublicTournament();
  const path = location.pathname;
  usePublicTheme();

  useEffect(() => {
    const basePath = path.startsWith("/seasons/") ? "/seasons" : path;
    const loadStyles = PUBLIC_ROUTE_STYLES[basePath];
    if (loadStyles) void loadStyles();
  }, [path]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  if (!ready) {
    return <PageLoadingSpinner label="Loading event…" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <AppFooter mode="public" />
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
