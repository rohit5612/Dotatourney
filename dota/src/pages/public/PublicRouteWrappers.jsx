import { lazy, Suspense } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner";
import { HomeBootstrapGate } from "../../components/public/HomeBootstrapGate.jsx";
import { PublicEventGate } from "../../components/public/PublicEventGate.jsx";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { AnnouncementsPublicPage } from "./AnnouncementsPublicPage.jsx";
import { CommunityPage } from "./CommunityPage.jsx";
import { MatchPublicPage } from "./MatchPublicPage.jsx";
import { PublicPlayerProfilePage } from "./PublicPlayerProfilePage.jsx";
import { WhatsNewPage } from "./WhatsNewPage.jsx";
import { SeasonDetailPage } from "./SeasonDetailPage.jsx";
import { SeasonsHubPage } from "./SeasonsHubPage.jsx";
import {
  AboutUsPage,
  CancellationPolicyPage,
  ReturnRefundPolicyPage,
  TermsAndConditionsPage,
} from "./LegalPolicyPages.jsx";

const PublicTeamsPage = lazy(() =>
  import("../../components/teams/PublicTeamsPage.jsx").then((module) => ({ default: module.PublicTeamsPage })),
);

import {
  LandingPage,
  TournamentInfo,
  PublicSchedule,
  GeneralRulesPage,
  PrivacyPolicyPage,
  CookiePolicyPage,
  RegistrationPage,
  PageContentShell,
} from "../PublicPages.jsx";

export function PublicLandingRoute() {
  const { event, message } = usePublicTournament();
  const navigate = useNavigate();
  return (
    <HomeBootstrapGate label="Loading home…">
      <PageContentShell path="/">
        <LandingPage event={event} navigate={navigate} message={message} />
      </PageContentShell>
    </HomeBootstrapGate>
  );
}

export function PublicTournamentRoute() {
  const { event, message } = usePublicTournament();
  const navigate = useNavigate();
  return (
    <PublicEventGate label="Loading tournament…">
      <PageContentShell path="/tournament">
        <TournamentInfo event={event} message={message} navigate={navigate} />
      </PageContentShell>
    </PublicEventGate>
  );
}

export function PublicScheduleRoute() {
  const { displayEvent, message } = usePublicTournament();
  return (
    <PublicEventGate label="Loading bracket & schedule…">
      <PageContentShell path="/schedule">
        <PublicSchedule event={displayEvent} message={message} />
      </PageContentShell>
    </PublicEventGate>
  );
}

export function PublicTeamsRoute() {
  const { event, message } = usePublicTournament();
  const navigate = useNavigate();
  return (
    <PublicEventGate label="Loading teams…">
      <PageContentShell path="/teams">
        <Suspense fallback={<PageLoadingSpinner label="Loading teams…" compact />}>
          <PublicTeamsPage event={event} message={message} navigate={navigate} />
        </Suspense>
      </PageContentShell>
    </PublicEventGate>
  );
}

export function PublicRegisterRoute() {
  const { event, message, setMessage } = usePublicTournament();
  const registerClosedCentered = event?.tournament?.registrations_open !== true;
  return (
    <PublicEventGate label="Loading registration…">
      <PageContentShell path="/register" registerClosedCentered={registerClosedCentered}>
        <RegistrationPage event={event} message={message} setMessage={setMessage} />
      </PageContentShell>
    </PublicEventGate>
  );
}

export function PublicRulesRoute() {
  const { event } = usePublicTournament();
  const discordUrl = event?.tournament?.discord_url || "https://discord.gg/sV2PhYc6A3";
  return (
    <PageContentShell path="/rules">
      <GeneralRulesPage discordUrl={discordUrl} />
    </PageContentShell>
  );
}

export function PublicPrivacyRoute() {
  return (
    <PageContentShell path="/privacy">
      <PrivacyPolicyPage />
    </PageContentShell>
  );
}

export function PublicCookiesRoute() {
  return (
    <PageContentShell path="/cookies">
      <CookiePolicyPage />
    </PageContentShell>
  );
}

export function PublicTermsRoute() {
  return (
    <PageContentShell path="/terms">
      <TermsAndConditionsPage />
    </PageContentShell>
  );
}

export function PublicRefundRoute() {
  return (
    <PageContentShell path="/refund-policy">
      <ReturnRefundPolicyPage />
    </PageContentShell>
  );
}

export function PublicCancellationRoute() {
  return (
    <PageContentShell path="/cancellation-policy">
      <CancellationPolicyPage />
    </PageContentShell>
  );
}

export function PublicAboutRoute() {
  return (
    <PageContentShell path="/about">
      <AboutUsPage />
    </PageContentShell>
  );
}

export function PublicSeasonsRoute() {
  return (
    <PageContentShell path="/seasons">
      <SeasonsHubPage />
    </PageContentShell>
  );
}

export function PublicSeasonDetailRoute() {
  return (
    <PageContentShell path="/seasons">
      <SeasonDetailPage />
    </PageContentShell>
  );
}

export function PublicCommunityRoute() {
  return (
    <PageContentShell path="/community">
      <CommunityPage />
    </PageContentShell>
  );
}

export function PublicWhatsNewRoute() {
  return (
    <PageContentShell path="/whats-new">
      <WhatsNewPage />
    </PageContentShell>
  );
}

export function PublicPlayerProfileRoute() {
  return (
    <PageContentShell path="/player">
      <PublicPlayerProfilePage />
    </PageContentShell>
  );
}

export function PublicAnnouncementsRoute() {
  return (
    <PageContentShell path="/announcements">
      <AnnouncementsPublicPage />
    </PageContentShell>
  );
}

export function PublicMatchRoute() {
  return (
    <PageContentShell path="/match">
      <MatchPublicPage />
    </PageContentShell>
  );
}

export function PublicRegisterRedirect() {
  return <Navigate to="/login?next=/dashboard" replace />;
}
