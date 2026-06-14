import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BpcCoin } from "../../components/coins/BpcCoin.jsx";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import { PlayerSpotlightTour } from "../../components/player/onboarding/PlayerSpotlightTour.jsx";
import { PlayerAreaLayout } from "../../components/layout/PlayerAreaLayout.jsx";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { buildSetupTasks, setupProgress, usePlayerOnboarding } from "../../hooks/usePlayerOnboarding.js";
import { usePlayerSession } from "./usePlayerSession";
import "../../styles/player-auth.css";
import "../../styles/player-dashboard.css";
import "../../styles/player-onboarding.css";
import "../../styles/seasons-page.css";

const NAV = [
  { to: "/dashboard", label: "Overview", end: true, icon: "overview", tourId: null },
  { to: "/dashboard/tournaments", label: "Tournaments", icon: "tournaments", tourId: "nav-tournaments" },
  { to: "/dashboard/notifications", label: "Notifications", icon: "notifications", tourId: null },
  { to: "/dashboard/history", label: "History", icon: "history", tourId: null },
  { to: "/dashboard/wallet", label: "Wallet", icon: "wallet", tourId: null },
  { to: "/dashboard/settings", label: "Profile settings", icon: "settings", tourId: "nav-settings" },
];

function SidebarPlayer({ account, coinBalance, logout, onShowSetupGuide }) {
  const initial = (account.displayName || account.bpcId || "?")[0].toUpperCase();
  const progress = setupProgress(buildSetupTasks(account));
  const setupIncomplete = progress.done < progress.total;

  return (
    <>
      <div className="player-dash__sidebar-player">
        <div className="player-dash__sidebar-avatar-wrap">
          {account.steamAvatarUrl ? (
            <img src={account.steamAvatarUrl} alt="" className="player-dash__sidebar-avatar" />
          ) : (
            <span className="player-dash__sidebar-avatar player-dash__sidebar-avatar--fallback" aria-hidden="true">
              {initial}
            </span>
          )}
          <span
            className={`player-dash__sidebar-status${account.eligibleForRegistration ? " is-ready" : ""}`}
            title={account.eligibleForRegistration ? "Eligible to register" : "Complete linkage"}
          />
        </div>
        <div className="player-dash__sidebar-player-copy">
          <p className="player-dash__sidebar-name">{account.displayName}</p>
          <span className="player-dash__badge">{account.bpcId}</span>
        </div>
      </div>

      <nav className="player-dash__nav" aria-label="Dashboard">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tourId || undefined}
            className={({ isActive }) => `player-dash__nav-link${isActive ? " is-active" : ""}`}
          >
            <DashboardNavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="player-dash__sidebar-meta" data-tour="wallet-balance">
        <div className="player-dash__wallet">
          <p className="player-dash__wallet-label">Balance</p>
          <div className="player-dash__wallet-row">
            <BpcCoin amount={coinBalance} size="sm" className="player-dash__wallet-coins" />
            <NavLink to="/dashboard/wallet" className="player-dash__wallet-link" title="Transaction log">
              Transactions
            </NavLink>
          </div>
        </div>
        {setupIncomplete ? (
          <button type="button" className="player-dash__sidebar-setup-link" onClick={onShowSetupGuide}>
            Show setup guide
          </button>
        ) : null}
        <div className="player-dash__sidebar-actions">
          <NavLink
            to="/dashboard/tournaments"
            className="player-dash__action player-dash__action--tournaments player-dash__action--stack"
          >
            <DashboardActionIcon name="tournaments" />
            <span>Tournaments</span>
          </NavLink>
          <NavLink
            to="/dashboard/settings"
            className="player-dash__action player-dash__action--edit player-dash__action--stack"
          >
            <DashboardActionIcon name="edit" />
            <span>Edit profile</span>
          </NavLink>
          <NavLink
            to={`/player/${account.slug}`}
            className="player-dash__action player-dash__action--public player-dash__action--stack"
          >
            <DashboardActionIcon name="public" />
            <span>Public profile</span>
          </NavLink>
          <div className="player-dash__sidebar-actions-divider" aria-hidden="true" />
          <button
            type="button"
            className="player-dash__action player-dash__action--signout player-dash__action--stack"
            onClick={logout}
          >
            <DashboardActionIcon name="signout" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function PlayerDashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { account, coinBalance, loading, error, logout, refreshMe } = usePlayerSession();
  const onboarding = usePlayerOnboarding({ enabled: Boolean(account) && !loading });

  const handleShowSetupGuide = () => {
    if (pathname !== "/dashboard" && pathname !== "/dashboard/") {
      navigate("/dashboard");
      window.setTimeout(() => onboarding.restartDashboardTour(), 400);
      return;
    }
    onboarding.restartDashboardTour();
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <PlayerAreaLayout>
      <div className="player-dash">
        <aside className="player-dash__sidebar">
          <div className="player-dash__sidebar-brand">
            <img src="/bpcl.png" alt="" className="player-dash__sidebar-logo" width={28} height={28} />
            <div>
              <p className="player-dash__sidebar-label">{SITE_BRAND_SHORT}</p>
              <p className="player-dash__sidebar-tag">Player dashboard</p>
            </div>
          </div>

          {account ? (
            <SidebarPlayer
              account={account}
              coinBalance={coinBalance}
              logout={logout}
              onShowSetupGuide={handleShowSetupGuide}
            />
          ) : null}
        </aside>

        <main className="player-dash__main">
          {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
          {loading ? (
            <div className="player-dash__loading">
              <span className="player-dash__loading-pulse" aria-hidden="true" />
              <p className="player-auth__sub">Loading your dashboard…</p>
            </div>
          ) : (
            <Outlet context={{ account, coinBalance, refreshMe }} />
          )}
        </main>
      </div>

      <PlayerSpotlightTour
        open={onboarding.tourOpen}
        step={onboarding.currentStep}
        stepIndex={onboarding.stepIndex}
        stepsLength={onboarding.steps.length}
        onNext={onboarding.nextStep}
        onBack={onboarding.prevStep}
        onSkip={onboarding.skipTour}
      />
    </PlayerAreaLayout>
  );
}
