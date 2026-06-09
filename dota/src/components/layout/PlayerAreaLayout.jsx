import { usePublicTheme } from "../../hooks/usePublicTheme.js";
import { SiteNavbar } from "../navigation/SiteNavbar";
import { AppFooter } from "../AppFooter";
import "../../styles/player-area-layout.css";

/**
 * Shell for login, registration, dashboard, and public player profile.
 * Accounts for the fixed public navbar via --site-navbar-offset (set in SiteNavbar).
 */
export function PlayerAreaLayout({ children, mainClassName = "", immersive = false }) {
  usePublicTheme();

  return (
    <div
      className={`player-area-layout flex flex-col text-foreground ${
        immersive ? "player-area-layout--immersive" : "min-h-screen bg-background"
      }`.trim()}
    >
      <SiteNavbar />
      <main className={`player-area-layout__main w-full min-w-0 ${mainClassName}`.trim()}>
        {children}
      </main>
      <AppFooter mode="public" />
    </div>
  );
}
