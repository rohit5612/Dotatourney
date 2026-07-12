import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DocumentMetaManager } from "./components/DocumentMetaManager.jsx";
import { PageLoadingSpinner } from "./components/PageLoadingSpinner";
import { PublicLayout } from "./layouts/PublicLayout.jsx";
import { AdminConsole } from "./admin/AdminConsole.jsx";
import {
  PublicAnnouncementsRoute,
  PublicAboutRoute,
  PublicCancellationRoute,
  PublicCommunityRoute,
  PublicWhatsNewRoute,
  PublicPlayerProfileRoute,
  PublicCookiesRoute,
  PublicLandingRoute,
  PublicMatchRoute,
  PublicPrivacyRoute,
  PublicRefundRoute,
  PublicRegisterRedirect,
  PublicRegisterRoute,
  PublicRulesRoute,
  PublicSponsorsRoute,
  PublicScheduleRoute,
  PublicSeasonsRoute,
  PublicSeasonDetailRoute,
  PublicTermsRoute,
  PublicTeamsRoute,
} from "./pages/public/PublicRouteWrappers.jsx";

const PlayerLoginPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerLoginPage })),
);
const PlayerSignupPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerSignupPage })),
);
const PlayerVerifyEmailPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerVerifyEmailPage })),
);
const PlayerAuthCallbackPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerAuthCallbackPage })),
);
const PlayerClaimAccountPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerClaimAccountPage })),
);
const PlayerForgotPasswordPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerForgotPasswordPage })),
);
const PlayerResetPasswordPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerResetPasswordPage })),
);
const PlayerSetPasswordPage = lazy(() =>
  import("./pages/PlayerAuthPages.jsx").then((m) => ({ default: m.PlayerSetPasswordPage })),
);

const PlayerDashboardLayout = lazy(() =>
  import("./pages/player/PlayerDashboardLayout.jsx").then((m) => ({ default: m.PlayerDashboardLayout })),
);
const PlayerOverviewPage = lazy(() =>
  import("./pages/player/PlayerOverviewPage.jsx").then((m) => ({ default: m.PlayerOverviewPage })),
);
const PlayerProfileSettingsPage = lazy(() =>
  import("./pages/player/PlayerProfileSettingsPage.jsx").then((m) => ({ default: m.PlayerProfileSettingsPage })),
);
const PlayerHistoryPage = lazy(() =>
  import("./pages/player/PlayerHistoryPage.jsx").then((m) => ({ default: m.PlayerHistoryPage })),
);
const PlayerTournamentsPage = lazy(() =>
  import("./pages/player/PlayerTournamentsPage.jsx").then((m) => ({ default: m.PlayerTournamentsPage })),
);
const PlayerRegisterDetailsPage = lazy(() =>
  import("./pages/player/PlayerRegisterDetailsPage.jsx").then((m) => ({ default: m.PlayerRegisterDetailsPage })),
);
const PlayerSubstitutePoolPage = lazy(() =>
  import("./pages/player/PlayerSubstitutePoolPage.jsx").then((m) => ({ default: m.PlayerSubstitutePoolPage })),
);
const PlayerCheckoutPage = lazy(() =>
  import("./pages/player/PlayerCheckoutPage.jsx").then((m) => ({ default: m.PlayerCheckoutPage })),
);
const PlayerCheckoutReturnPage = lazy(() =>
  import("./pages/player/PlayerCheckoutReturnPage.jsx").then((m) => ({ default: m.PlayerCheckoutReturnPage })),
);
const PlayerNotificationsPage = lazy(() =>
  import("./pages/player/PlayerNotificationsPage.jsx").then((m) => ({ default: m.PlayerNotificationsPage })),
);
const PlayerWalletPage = lazy(() =>
  import("./pages/player/PlayerWalletPage.jsx").then((m) => ({ default: m.PlayerWalletPage })),
);

function PlayerAuthSuspense({ children }) {
  return <Suspense fallback={<PageLoadingSpinner label="Loading…" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <DocumentMetaManager />
      <Routes>
        <Route path="/admin/*" element={<AdminConsole />} />

        <Route
          path="/login"
          element={
            <PlayerAuthSuspense>
              <PlayerLoginPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/signup"
          element={
            <PlayerAuthSuspense>
              <PlayerSignupPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/verify-email"
          element={
            <PlayerAuthSuspense>
              <PlayerVerifyEmailPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <PlayerAuthSuspense>
              <PlayerAuthCallbackPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/claim-account"
          element={
            <PlayerAuthSuspense>
              <PlayerClaimAccountPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PlayerAuthSuspense>
              <PlayerForgotPasswordPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PlayerAuthSuspense>
              <PlayerResetPasswordPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/set-password"
          element={
            <PlayerAuthSuspense>
              <PlayerSetPasswordPage />
            </PlayerAuthSuspense>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PlayerAuthSuspense>
              <PlayerDashboardLayout />
            </PlayerAuthSuspense>
          }
        >
          <Route index element={<PlayerOverviewPage />} />
          <Route path="settings" element={<PlayerProfileSettingsPage />} />
          <Route path="history" element={<PlayerHistoryPage />} />
          <Route path="tournaments" element={<PlayerTournamentsPage />} />
          <Route path="notifications" element={<PlayerNotificationsPage />} />
          <Route path="wallet" element={<PlayerWalletPage />} />
          <Route path="register/:slug" element={<PlayerRegisterDetailsPage />} />
          <Route path="substitute/:slug" element={<PlayerSubstitutePoolPage />} />
          <Route path="checkout/return" element={<PlayerCheckoutReturnPage />} />
          <Route path="checkout/:slug" element={<PlayerCheckoutPage />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route index element={<PublicLandingRoute />} />
          <Route path="tournament" element={<Navigate to="/" replace />} />
          <Route path="schedule" element={<PublicScheduleRoute />} />
          <Route path="teams" element={<PublicTeamsRoute />} />
          <Route path="register" element={<PublicRegisterRedirect />} />
          <Route path="register-legacy" element={<PublicRegisterRoute />} />
          <Route path="rules" element={<PublicRulesRoute />} />
          <Route path="sponsors" element={<PublicSponsorsRoute />} />
          <Route path="privacy" element={<PublicPrivacyRoute />} />
          <Route path="cookies" element={<PublicCookiesRoute />} />
          <Route path="terms" element={<PublicTermsRoute />} />
          <Route path="refund-policy" element={<PublicRefundRoute />} />
          <Route path="cancellation-policy" element={<PublicCancellationRoute />} />
          <Route path="about" element={<PublicAboutRoute />} />
          <Route path="seasons" element={<PublicSeasonsRoute />} />
          <Route path="seasons/:slug" element={<PublicSeasonDetailRoute />} />
          <Route path="announcements" element={<PublicAnnouncementsRoute />} />
          <Route path="community" element={<PublicCommunityRoute />} />
          <Route path="whats-new" element={<PublicWhatsNewRoute />} />
          <Route path="player/:slug" element={<PublicPlayerProfileRoute />} />
          <Route path="match/:matchId" element={<PublicMatchRoute />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
