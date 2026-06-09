import { lazy, Suspense } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { AnnouncementsPublicPage } from "./AnnouncementsPublicPage.jsx";
import { CommunityPage } from "./CommunityPage.jsx";
import { MatchPublicPage } from "./MatchPublicPage.jsx";
import { SeasonDetailPage } from "./SeasonDetailPage.jsx";
import { SeasonsHubPage } from "./SeasonsHubPage.jsx";

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
    <PageContentShell path="/">
      <LandingPage event={event} navigate={navigate} message={message} />
    </PageContentShell>
  );
}

export function PublicTournamentRoute() {
  const { event, message } = usePublicTournament();
  const navigate = useNavigate();
  return (
    <PageContentShell path="/tournament">
      <TournamentInfo event={event} message={message} navigate={navigate} />
    </PageContentShell>
  );
}

export function PublicScheduleRoute() {
  const { displayEvent, message } = usePublicTournament();
  return (
    <PageContentShell path="/schedule">
      <PublicSchedule event={displayEvent} message={message} />
    </PageContentShell>
  );
}

export function PublicTeamsRoute() {
  const { event, message } = usePublicTournament();
  const navigate = useNavigate();
  return (
    <PageContentShell path="/teams">
      <Suspense fallback={<PageLoadingSpinner label="Loading teams…" />}>
        <PublicTeamsPage event={event} message={message} navigate={navigate} />
      </Suspense>
    </PageContentShell>
  );
}

export function PublicRegisterRoute() {
  const { event, message, setMessage } = usePublicTournament();
  const registerClosedCentered = event?.tournament?.registrations_open !== true;
  return (
    <PageContentShell path="/register" registerClosedCentered={registerClosedCentered}>
      <RegistrationPage event={event} message={message} setMessage={setMessage} />
    </PageContentShell>
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
