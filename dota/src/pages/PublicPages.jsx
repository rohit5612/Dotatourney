import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  HiOutlineArrowDownTray,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineTrophy,
} from "react-icons/hi2";
import { FaExternalLinkAlt, FaYoutube } from "react-icons/fa";
import { AppFooter } from "../components/AppFooter";
import { PageLoadingSpinner } from "../components/PageLoadingSpinner";
import {
  augmentGroupedBracketMatches,
  blastStageRoundColumnCount,
  buildStageTabLabels,
  formatMatchRoundSummary,
  getBracketPhaseForTab,
  getPreferredSchedulePhaseTab,
  getSchedulePhase,
  getSchedulePhaseCompleteNotice,
  getSchedulePhaseTabOrder,
  inferBlastBracketVariant,
  isSchedulePhaseComplete,
  normalizedBlastBracketTabs,
  SCHEDULE_PHASE_GROUPS,
  SCHEDULE_PHASE_PLAYOFFS,
  SCHEDULE_PHASE_QUALIFIERS,
  stageRoundStructure,
  summarizeSeriesTypes,
  resolveSchedulePhaseNavTabs,
  summarizeSeriesTypesForSchedulePhase,
} from "../components/bracket/bracketLayout.js";
import { resolveBracketTabs } from "../utils/engineBracketTabs.js";
import { resolveBracketViewSections } from "../utils/engineStages.js";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import {
  PLAYER_RULES_DISCORD_SECTION_TITLE,
  PLAYER_RULES_REGISTRATION_NOTICE,
  PLAYER_RULES_SECTIONS,
} from "../constants/playerRules.js";
import { COOKIE_CONSENT_KEY, PUBLIC_CONTACT_EMAIL, TRADE_NAME } from "../constants/legal.js";
import { RULEBOOK_PDF_PATH, SITE_BRAND_FULL, SITE_BRAND_LINE, SITE_BRAND_SHORT, SITE_ORIGIN } from "../constants/siteMeta.js";
import { LegalLink, LegalPageLayout, LegalSection } from "../components/legal/LegalPageLayout.jsx";
import { roles } from "../constants/tournament";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock.js";
import { api } from "../lib/api";
import { peekCache } from "../lib/requestCache.js";
import { LandingBannerAnnouncement } from "../components/LandingBannerAnnouncement.jsx";
import { LandingEssenceSection } from "../components/landing/LandingEssenceSection.jsx";
import { LandingOrgRoster } from "../components/landing/LandingOrgRoster.jsx";
import { LandingSponsors } from "../components/LandingSponsors.jsx";
import { TournamentStatusSlot } from "../components/TournamentStatusSlot.jsx";
import { useSiteContent } from "../hooks/useSiteContent.js";
import "../styles/landing-v2.css";
import "../styles/registration-page.css";
import "../styles/team-logo-img.css";
import { TeamLogoImg } from "../components/TeamLogoImg.jsx";
import { StandingsTable } from "../components/StandingsTable.jsx";
import { BracketTokenHelp } from "../components/bracket/BracketTokenHelp.jsx";
import { SiteNavbar } from "../components/navigation/SiteNavbar.jsx";
const PublicTeamsPage = lazy(() =>
  import("../components/teams/PublicTeamsPage.jsx").then((module) => ({ default: module.PublicTeamsPage })),
);
const BracketDiagram = lazy(() =>
  import("../components/BracketDiagram.jsx").then((module) => ({ default: module.BracketDiagram })),
);

const PUBLIC_ROUTE_STYLES = {
  "/": () => Promise.all([import("../styles/landing-hero.css"), import("../styles/tournament-honors.css")]),
  "/tournament": () => Promise.all([import("../styles/tournament-page.css"), import("../styles/tournament-honors.css")]),
  "/teams": () => Promise.all([import("../styles/teams-page.css"), import("../styles/tournament-honors.css")]),
  "/schedule": () => import("../styles/schedule-page.css"),
  "/register": () => import("../styles/registration-page.css"),
  "/rules": () => import("../styles/general-rules-page.css"),
};
import { PrimaryViewTabs, SchedulePhaseTabs } from "../components/navigation/TournamentTabs.jsx";
import {
  getMatchDisplayScores,
  groupScheduleSlotsByDate,
  isValidScheduleInstant,
  parseScheduleViewHash,
  parseStreamWatchLink,
  resolveScheduleStatus,
  scheduleViewHref,
} from "../utils/schedule.js";
import { buildTeamNameLookup, findTeamByName, teamInitials } from "../utils/teamPage.js";
import { resolveBlastBracketMatches } from "../utils/blastSeeding.js";
import { TournamentWinnersBlock } from "../components/honors/TournamentWinnersBlock.jsx";
import { hasPublicHonorsContent } from "../utils/tournamentHonors.js";
import { buildBracketTokenHelp } from "../utils/bracketTokenHelp.js";
import { collectTeamLogoUrls, preloadTeamLogos } from "../utils/teamLogoCache.js";
import { hexToRgbTriplet } from "../hooks/useLogoAccent.js";
import { descriptionContentClassName, rulebookContentClassName, sanitizeDescriptionHtml, sanitizeRulebookHtml } from "../lib/sanitizeRulebookHtml.js";
import { formatAnnouncementPostedAt, parseAnnouncementEntries } from "../lib/announcementEntries.js";

const tournamentSlug = "bpcl";
const defaultTournamentStart = "2026-05-22T00:00:00+05:30";
const discordInviteUrl = "https://discord.gg/sV2PhYc6A3";
/** Discord brand CTA — uses --discord-brand token from index.css */
const REGISTRATION_DISCORD_BTN_CLASS = "btn btn-discord";
const LANDING_JOURNEY_ICONS = {
  hub: HiOutlineChatBubbleLeftRight,
  blast: HiOutlineBolt,
  trophy: HiOutlineTrophy,
};

/** Primary registration flow CTA — red, full-width on small screens, prominent. */
const REGISTRATION_CONTINUE_BTN_CLASS =
  "btn btn-destructive inline-flex min-h-12 items-center justify-center gap-2 px-8 text-base font-semibold shadow-lg hover:shadow-xl";
const publicPaths = [
  "/",
  "/tournament",
  "/schedule",
  "/teams",
  "/register",
  "/rules",
  "/privacy",
  "/cookies",
  "/terms",
  "/refund-policy",
  "/cancellation-policy",
  "/about",
];

/** @param {Record<string, unknown> | null | undefined} tournament */
function getLandingJourneySteps(tournament) {
  const formatName = getFormatName(tournament?.format);
  return [
    {
      kicker: "01",
      icon: "hub",
      iconClassName: "text-secondary",
      title: "Register & Discord",
      summary: "Sign up on the site; captains draft the teams and the whole week runs through Discord.",
      bullets: [
        "Lock in registration and payment so you keep your player spot.",
        "Be in Discord, mic on — drafts, pairings, and lobbies are called there.",
      ],
    },
    {
      kicker: "02",
      icon: "blast",
      iconClassName: "text-primary",
      title: "Captains Mode & BLAST rhythm",
      summary: `Matches are Captains Mode. The path is BLAST-inspired — play-ins and a last-chance stage so more people get games before the main ${formatName} bracket.`,
      bullets: [
        "Captains draft line-ups; everyone plays on verified mains.",
        "Early losses are not always final: play-ins / last-chance rounds give the field another swing.",
      ],
    },
    {
      kicker: "03",
      icon: "trophy",
      iconClassName: "text-accent",
      title: "Series wins",
      summary: "You move through the event by taking series off the other squad.",
      bullets: [
        "Bo1, Bo3, or longer — each round’s length is whatever the rulebook and schedule say.",
        "Stack wins toward grand finals; admins handle forfeits and disputes so rounds stay on rails.",
      ],
    },
  ];
}

/** Public tournament announcements list: page size before pagination. */
const ANNOUNCEMENTS_PAGE_SIZE = 5;

/** Drop replacement files in `public/images/` using these exact basenames. */
const images = {
  overviewCard: "/images/overview.jpg",
  rulebookBg: "/images/rulebook.jpg",
  tournamentHero: "/images/tournamenthero.jpg",
  bracketsBg: "/images/brackets.jpeg",
  registerBg: "/images/register.jpg",
  /** Standalone `/rules` (general player conduct) page background */
  generalRulesBg: "/images/rules.jpeg",
  /** `/tournament` — content below the hero band */
  tournamentPageBg: "/images/tournamentpage.png",
  /** `/teams` — full-page background */
  teamsBg: "/images/teams.png",
  /** `/announcements` — News page background */
  newsBg: "/images/news.jpg",
  /** `/seasons` — Seasons archive page background */
  seasonsBg: "/images/seasons.jpg",
  /** `/community` — Player directory background */
  communityBg: "/images/community.png",
  /** Landing page — “Registration to victory” journey cards band */
  journeySectionBg: "/images/cards.jpg",
};

function formatDate(value) {
  if (!value) return "TBA";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DESCRIPTION_FALLBACK =
  "Tournament details will appear here once admins publish the setup. Check Discord for live communications.";

function TournamentDescriptionProse({ description, className }) {
  const trimmed = description?.trim();
  if (!trimmed) {
    return <p className={className}>{DESCRIPTION_FALLBACK}</p>;
  }
  return (
    <div
      className={`${className} ${descriptionContentClassName} max-w-none`}
      dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(trimmed) }}
    />
  );
}

/** Downscale and JPEG-wrap payment proofs so JSON POST stays under typical reverse-proxy limits (nginx default 1m). */
async function compressImageFileForDataUrl(file, maxEdge = 1680, jpegQuality = 0.88) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", jpegQuality);
  } finally {
    bitmap.close();
  }
}

const formatNameMap = {
  dse: "Double Elimination",
  se: "Single Elimination",
  gsl: "GSL Groups",
  rr: "Round Robin",
  swiss: "Swiss System",
  hybrid: "Group + Playoffs",
  blast: "BLAST-style slam",
};

function getFormatName(format) {
  const key = String(format || "").toLowerCase();
  return formatNameMap[key] || "Double Elimination";
}

function parsePrizePool(value) {
  const text = String(value || "").trim();
  const match = text.match(/[\d,]+/);
  if (!match) return null;
  const amount = Number(match[0].replaceAll(",", ""));
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    prefix: text.slice(0, match.index),
    suffix: text.slice((match.index || 0) + match[0].length),
  };
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-IN");
}

function CookieConsentBanner({ navigate }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          <p id="cookie-consent-title" className="text-sm font-medium text-foreground">
            Cookies & local storage
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            We use essential cookies and browser storage so the site can function (for example, remembering this choice). See our{" "}
            <button type="button" className="text-secondary underline underline-offset-2 hover:text-foreground" onClick={() => navigate("/cookies")}>
              Cookie Policy
            </button>{" "}
            and{" "}
            <button type="button" className="text-secondary underline underline-offset-2 hover:text-foreground" onClick={() => navigate("/privacy")}>
              Privacy Policy
            </button>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate("/cookies")}>
            Learn more
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
            Accept
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function resolvePageShellPath(pathname) {
  if (pathname.startsWith("/seasons/")) return "/seasons";
  if (pathname.startsWith("/player/")) return "/player";
  if (pathname.startsWith("/match/")) return "/match";
  return pathname;
}

/** Page content shell — layout chrome (nav/footer) lives in PublicLayout. */
export function PageContentShell({ path: _pathProp, children, registerClosedCentered = false }) {
  const { pathname } = useLocation();
  const path = resolvePageShellPath(pathname);
  const isSeasonsPage = path === "/seasons";
  const isCommunityPage = path === "/community";
  const isPlayerProfilePage = path === "/player";
  const isFullBleedBg =
    path === "/schedule" ||
    path === "/teams" ||
    path === "/register" ||
    path === "/rules" ||
    path === "/announcements" ||
    isSeasonsPage ||
    isCommunityPage ||
    isPlayerProfilePage;
  const isLegalPage =
    path === "/privacy" ||
    path === "/cookies" ||
    path === "/terms" ||
    path === "/refund-policy" ||
    path === "/cancellation-policy" ||
    path === "/about";
  const contentClass =
    path === "/teams"
      ? "mx-auto max-w-7xl space-y-7 px-4 pb-12 pt-28 md:space-y-8"
        : path === "/schedule" || path === "/announcements" || path === "/rules"
        ? "relative z-10 !space-y-0 !px-0 pb-10 pt-0"
        : isLegalPage
          ? "relative z-10 !space-y-0 !px-0 pb-0 pt-0"
        : isSeasonsPage
          ? "relative z-10 !space-y-0 !px-0 pb-10 pt-0 min-h-[100dvh]"
          : isCommunityPage || isPlayerProfilePage
            ? "relative z-10 !space-y-0 !px-0 pb-10 pt-0 min-h-[100dvh]"
            : "mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-28";
  const fullBleedImage =
    path === "/schedule"
      ? images.bracketsBg
      : path === "/teams"
        ? images.teamsBg
        : path === "/register"
          ? images.registerBg
          : path === "/rules"
            ? images.generalRulesBg
            : path === "/announcements"
              ? images.newsBg
              : path === "/seasons"
                ? images.seasonsBg
                : path === "/community" || path === "/player"
                  ? images.communityBg
                  : null;
  const fullBleedGradientClass =
    path === "/schedule"
      ? "bg-gradient-to-b from-background/42 via-background/34 to-background/40"
      : path === "/teams"
        ? "bg-gradient-to-b from-background/52 via-background/36 to-background/44"
        : path === "/register"
          ? "bg-gradient-to-b from-background/86 via-background/78 to-background/84"
          : path === "/rules"
            ? "bg-gradient-to-b from-background/52 via-background/38 to-background/44"
            : path === "/announcements"
              ? "bg-gradient-to-b from-background/52 via-background/38 to-background/44"
              : path === "/seasons"
                ? "bg-gradient-to-b from-background/68 via-background/52 to-background/62"
                : path === "/community" || path === "/player"
                  ? "bg-gradient-to-b from-background/32 via-background/18 to-background/24"
                  : "bg-gradient-to-br from-background/87 via-background/78 to-background/80";

  const sectionClassName = registerClosedCentered
    ? "relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-24 sm:pt-28"
    : path === "/"
      ? "space-y-20"
      : path === "/teams"
        ? `${contentClass} relative z-10 !space-y-0`
        : `${contentClass} relative z-10`;

  return (
    <div
      className={`relative text-foreground ${isFullBleedBg ? "" : "bg-background"} ${isSeasonsPage || isCommunityPage || isPlayerProfilePage ? "min-h-[100dvh]" : ""} ${registerClosedCentered ? "flex min-h-[60vh] flex-col" : ""}`}
    >
      {isFullBleedBg && fullBleedImage ? (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          <img alt="" className="h-full w-full object-cover" src={fullBleedImage} />
          <div className={`absolute inset-0 ${fullBleedGradientClass}`} />
          {path === "/schedule" ? (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,rgba(94,234,212,0.14),transparent_58%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_100%_85%,rgba(233,168,74,0.11),transparent_52%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_0%_60%,rgba(129,140,248,0.08),transparent_50%)]" />
            </>
          ) : null}
        </div>
      ) : null}
      <section className={sectionClassName}>
        {registerClosedCentered ? (
          <div className="flex min-h-[calc(100dvh-14rem)] flex-1 flex-col items-center justify-center py-10 sm:min-h-[calc(100dvh-12rem)] sm:py-16 md:py-20">
            {children}
          </div>
        ) : (
          children
        )}
      </section>
    </div>
  );
}

export function PublicApp({ path, navigate }) {
  const [event, setEvent] = useState(() => peekCache("public:tournament") ?? null);
  const [message, setMessage] = useState("");
  const [publicBootstrapDone, setPublicBootstrapDone] = useState(() => peekCache("public:tournament") != null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getPublicTournamentFresh()
        .then((payload) => {
          if (active) setEvent(payload);
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        })
        .finally(() => {
          if (active) setPublicBootstrapDone(true);
        });

    load();
    const poll = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, []);

  const displayEvent = useMemo(() => {
    if (!event) return event;
    const format = event.tournament?.format;
    const matches = resolveBlastBracketMatches(event.matches || [], event.groupedStandings || [], format);
    return { ...event, matches };
  }, [event]);

  useEffect(() => {
    const loadStyles = PUBLIC_ROUTE_STYLES[path];
    if (loadStyles) void loadStyles();
  }, [path]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  useEffect(() => {
    const urls = collectTeamLogoUrls(event?.teams, event?.setupTeams);
    if (urls.length) void preloadTeamLogos(urls);
  }, [event?.teams, event?.setupTeams]);

  useEffect(() => {
    if (!publicPaths.includes(path)) {
      navigate("/");
    }
  }, [navigate, path]);

  if (!publicBootstrapDone) {
    return <PageLoadingSpinner label="Loading event…" />;
  }

  const registerClosedCentered = path === "/register" && event?.tournament?.registrations_open !== true;

  if (path === "/register") {
    return (
      <PageContentShell path={path} navigate={navigate} registerClosedCentered={registerClosedCentered}>
        <RegistrationPage event={event} message={message} setMessage={setMessage} />
      </PageContentShell>
    );
  }

  if (path === "/rules") {
    const rulesDiscordUrl = event?.tournament?.discord_url || discordInviteUrl;
    return (
      <PageContentShell path={path} navigate={navigate}>
        <GeneralRulesPage discordUrl={rulesDiscordUrl} />
      </PageContentShell>
    );
  }

  if (path === "/privacy") {
    return (
      <PageContentShell path={path} navigate={navigate}>
        <PrivacyPolicyPage />
      </PageContentShell>
    );
  }

  if (path === "/cookies") {
    return (
      <PageContentShell path={path} navigate={navigate}>
        <CookiePolicyPage />
      </PageContentShell>
    );
  }

  if (path === "/schedule") {
    return (
      <PageContentShell path={path} navigate={navigate}>
        <PublicSchedule event={displayEvent} message={message} />
      </PageContentShell>
    );
  }

  if (path === "/teams") {
    return (
      <PageContentShell path={path} navigate={navigate}>
        <Suspense fallback={<PageLoadingSpinner label="Loading teams…" />}>
          <PublicTeamsPage event={event} message={message} navigate={navigate} />
        </Suspense>
      </PageContentShell>
    );
  }

  if (path === "/tournament") {
    return (
      <PageContentShell path={path} navigate={navigate}>
        <TournamentInfo event={event} message={message} navigate={navigate} />
      </PageContentShell>
    );
  }

  return (
    <PageContentShell path={path} navigate={navigate}>
      <LandingPage event={event} navigate={navigate} message={message} />
    </PageContentShell>
  );
}

function LandingPageHeroVideo() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    function tryPlay() {
      void el.play().catch(() => {});
    }

    tryPlay();
    el.addEventListener("canplay", tryPlay);
    el.addEventListener("loadeddata", tryPlay);

    function onVisibility() {
      if (document.visibilityState === "visible") tryPlay();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      el.removeEventListener("canplay", tryPlay);
      el.removeEventListener("loadeddata", tryPlay);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="landing-v2-hero__video"
      src="/herobg.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      fetchPriority="high"
      aria-hidden="true"
    />
  );
}

export function LandingPage({ event, navigate, message }) {
  const tournament = event?.tournament;
  const discordUrl = tournament?.discord_url || discordInviteUrl;
  const { orgRoster } = useSiteContent();
  const rosterFull = registrationCapIsFull(event, tournament);
  const registrationOpen = tournament?.registrations_open === true && !rosterFull;

  function scrollToExplore() {
    document.getElementById("landing-explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="landing-v2">
      <LandingBannerAnnouncement tournament={tournament} />
      {message ? (
        <p className="mx-auto mt-4 max-w-6xl rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p>
      ) : null}

      <section className="landing-v2-hero">
        <LandingPageHeroVideo />
        <div className="landing-v2-hero__scrim" aria-hidden="true" />
        <div className="landing-v2-hero__content">
          <p className="landing-v2-hero__eyebrow">Dota 2 tournament circuit</p>
          <h1 className="landing-v2-hero__title">{SITE_BRAND_FULL}</h1>
          <p className="landing-v2-hero__lead">
            Assemble your roster, sharpen your strats, and compete in a structured esports format built for the Indian
            Dota community.
          </p>
          <div className="landing-v2-hero__highlight">
            <div className="landing-v2-hero__highlight-frame" aria-hidden="true">
              <span className="landing-v2-hero__highlight-corner landing-v2-hero__highlight-corner--tl" />
              <span className="landing-v2-hero__highlight-corner landing-v2-hero__highlight-corner--tr" />
              <span className="landing-v2-hero__highlight-corner landing-v2-hero__highlight-corner--bl" />
              <span className="landing-v2-hero__highlight-corner landing-v2-hero__highlight-corner--br" />
            </div>
            <div className="landing-v2-hero__highlight-beam" aria-hidden="true" />
            <div className="landing-v2-hero__prize landing-hero-prize">
              <p className="landing-v2-hero__prize-eyebrow">
                <span className="landing-v2-hero__prize-icon" aria-hidden="true">
                  ◆
                </span>
                Prize pool
              </p>
              <div className="landing-v2-hero__prize-ticker">
                <AnimatedPrizePool value={tournament?.prize_pool} landing />
              </div>
            </div>
            {tournament?.is_published ? (
              <LandingHeroRegistrationLine
                count={event?.approvedRegistrationCount}
                cap={tournament?.registration_cap}
              />
            ) : null}
          </div>
          <div className="landing-v2-hero__actions">
            {registrationOpen ? (
              <button type="button" className="landing-v2-hero__cta landing-v2-hero__cta--primary" onClick={() => navigate("/register")}>
                Register now
              </button>
            ) : rosterFull ? (
              <Link to="/login" className="landing-v2-hero__cta landing-v2-hero__cta--primary">
                Join substitute pool
              </Link>
            ) : (
              <button type="button" className="landing-v2-hero__cta landing-v2-hero__cta--primary" onClick={() => navigate("/register")} disabled>
                Registration closed
              </button>
            )}
            <a className="landing-v2-hero__cta landing-v2-hero__cta--ghost" href={discordUrl} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={scrollToExplore}
          className="landing-v2-hero__scroll"
          aria-label="Scroll to explore tournament details"
        >
          <span>Explore</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </section>

      {hasPublicHonorsContent(event?.honors) ? (
        <div className="landing-v2-honors landing-v2-section landing-v2-blue-edges">
          <div className="landing-v2-section__inner">
            <TournamentWinnersBlock
              honors={event?.honors}
              teams={event?.teams}
              teamLookup={buildTeamNameLookup(event?.teams, event?.setupTeams)}
              tournament={tournament}
              variant="landing"
            />
          </div>
        </div>
      ) : null}

      <RevealSection>
        <section id="landing-explore" className="landing-v2-section landing-v2-media landing-v2-blue-edges landing-v2-blue-edges--no-top scroll-mt-20">
          <div className="landing-v2-media__bg" aria-hidden="true">
            <img
              src="/images/cards.jpg"
              alt=""
              className="landing-v2-media__bg-image"
              loading="lazy"
              decoding="async"
            />
            <div className="landing-v2-media__bg-overlay" />
            <div className="landing-v2-media__bg-blend-top" />
          </div>
          <div className="landing-v2-section__inner landing-v2-media__inner">
            <TournamentStatusSlot
              placement="home"
              variant="bare"
              startDate={tournament?.start_date}
              endDate={tournament?.end_date}
              liveYoutubeUrl={tournament?.live_youtube_url}
              archiveEmbeds={event?.archiveEmbeds}
              fallbackStart={defaultTournamentStart}
              navigate={navigate}
            />
          </div>
        </section>
      </RevealSection>

      <LandingSponsors sponsorsConfig={event?.sponsorsConfig} />

      <LandingEssenceSection />
      <LandingOrgRoster orgRoster={orgRoster} />

      <RevealSection>
        <section className="landing-v2 landing-v2-section landing-v2-journey landing-v2-blue-edges" aria-labelledby="landing-journey-heading">
          <div className="landing-v2-section__inner">
            <p className="landing-v2-section__eyebrow">The path</p>
            <h2 id="landing-journey-heading" className="landing-v2-section__title">
              Registration to victory
            </h2>
            <p className="landing-v2-section__lead">Three steps from sign-up to closing out your series.</p>
            <div className="landing-v2-journey__list">
              {getLandingJourneySteps(tournament).map((item) => (
                <article key={item.kicker} className="landing-v2-glass landing-v2-journey__step">
                  <p className="landing-v2-journey__kicker">{item.kicker}</p>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="landing-v2 landing-v2-section landing-v2-discord landing-v2-blue-edges">
          <div className="landing-v2-section__inner">
            <div className="landing-v2-glass">
              <p className="landing-v2-section__eyebrow">Community</p>
              <h2 className="landing-v2-section__title">Join our Discord</h2>
              <p>Match-day communication, announcements, and support happen in our Discord server.</p>
              <a className="btn btn-primary px-6 py-3" href={discordUrl} target="_blank" rel="noreferrer">
                Join Discord
              </a>
            </div>
          </div>
        </section>
      </RevealSection>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-serif text-lg font-medium leading-snug tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function TournamentStatCard({ label, value, accent = false }) {
  return (
    <article className="tournament-stat-card">
      <p className="tournament-stat-card__label">{label}</p>
      <p className={`tournament-stat-card__value${accent ? " tournament-stat-card__value--accent" : ""}`}>{value}</p>
    </article>
  );
}

/** Live-ish approved player count from the public tournament payload (`approvedRegistrationCount`). */
function ApprovedRegistrationsHero({ count, compact = false }) {
  const n = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const playerLabel = n === 1 ? "player" : "players";
  if (compact) {
    return (
      <>
        <strong>{n}</strong> {playerLabel} registered
      </>
    );
  }
  return (
    <div
      className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-accent/35 bg-background/88 px-4 py-2 text-left text-sm shadow-lg backdrop-blur-md ring-1 ring-foreground/10"
      role="status"
      aria-live="polite"
      aria-label={`${n} registered ${playerLabel} and counting`}
    >
      <span className="hero-approved-dot shrink-0" aria-hidden />
      <span className="min-w-0 leading-snug text-muted-foreground">
        <span className="font-semibold tabular-nums text-accent">{n}</span> {playerLabel} registered and ready to play!
      </span>
    </div>
  );
}

function registrationCapIsFull(event, tournament) {
  if (event?.substitutePoolOpen) return true;
  const cap = tournament?.registration_cap;
  const count = event?.approvedRegistrationCount;
  const capValue =
    cap != null && cap !== "" && Number.isFinite(Number(cap)) && Number(cap) > 0 ? Math.floor(Number(cap)) : null;
  const registered =
    typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return capValue != null && registered >= capValue;
}

/** Approved players vs cap — compact strip under prize pool when published. */
function LandingHeroRegistrationLine({ count, cap }) {
  const registered =
    typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const capValue =
    cap != null && cap !== "" && Number.isFinite(Number(cap)) && Number(cap) > 0
      ? Math.floor(Number(cap))
      : null;
  const fillPct = capValue != null ? Math.min(100, (registered / capValue) * 100) : null;

  return (
    <div className="landing-v2-hero__registration" role="status" aria-live="polite">
      <div className="landing-v2-hero__registration-row">
        <span className="landing-v2-hero__registration-pip" aria-hidden="true" />
        <span className="landing-v2-hero__registration-label">Registrations</span>
        <span className="landing-v2-hero__registration-value">
          <strong className="landing-v2-hero__registration-num">{registered}</strong>
          {capValue != null ? (
            <>
              <span className="landing-v2-hero__registration-divider" aria-hidden>
                /
              </span>
              <strong className="landing-v2-hero__registration-num landing-v2-hero__registration-num--cap">
                {capValue}
              </strong>
            </>
          ) : null}
          <span className="landing-v2-hero__registration-suffix">players</span>
        </span>
      </div>
      {fillPct != null ? (
        <div
          className="landing-v2-hero__registration-meter"
          role="presentation"
          aria-hidden="true"
        >
          <span className="landing-v2-hero__registration-meter-fill" style={{ width: `${fillPct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function AnimatedPrizePool({ value, landing = false }) {
  const parsed = useMemo(() => parsePrizePool(value), [value]);
  const [displayValue, setDisplayValue] = useState(0);
  const valueClass = landing
    ? `landing-hero-prize__value${parsed ? " landing-hero-prize__value--accent" : ""}`
    : "mt-2 font-serif text-3xl font-semibold tabular-nums tracking-tight text-primary sm:text-4xl";

  useEffect(() => {
    if (!parsed) return undefined;
    let animationFrame;
    const startedAt = performance.now();
    const duration = 1200;

    function animate(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(parsed.amount * eased);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [parsed]);

  if (!parsed) {
    return <p className={valueClass}>{value || "TBA"}</p>;
  }

  return (
    <p className={valueClass}>
      {parsed.prefix}
      {formatNumber(displayValue)}
      {parsed.suffix}
    </p>
  );
}

function normalizeBreakdown(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return String(value || "")
    .split("\n")
    .map((line, index) => {
      const text = line.trim();
      return text ? { placement: index + 1, label: `${index + 1}`, amount: text } : null;
    })
    .filter(Boolean);
}

function placementLabel(item, index) {
  if (item.label && item.label !== `${index + 1}`) return item.label;
  const n = item.placement ?? index + 1;
  if (n === 1) return "1st Place";
  if (n === 2) return "2nd Place";
  if (n === 3) return "3rd Place";
  return `${n}th Place`;
}

function PrizePoolBreakdown({ total, items }) {
  const list = items.length ? items : [{ label: "Prize breakdown", amount: "Breakdown will be announced soon.", placement: 1 }];
  const podium = list.slice(0, 3);
  const remainder = list.slice(3);
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <section className="tournament-rewards-section landing-panel overflow-hidden p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Rewards</p>
          <h3 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Prize Pool Breakdown</h3>
        </div>
        {total ? (
          <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total pool</p>
            <p className="font-serif text-2xl font-semibold text-primary sm:text-3xl">{total}</p>
          </div>
        ) : null}
      </div>

      {podium.length ? (
        <div
          className={`prize-podium-grid mt-6 grid gap-4 ${
            podium.length >= 3 ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] md:items-end" : podium.length === 2 ? "md:grid-cols-2" : ""
          }`}
        >
          {podiumOrder.map((item, index) => {
            const rank = item.placement ?? (podium.length >= 3 ? (index === 0 ? 2 : index === 1 ? 1 : 3) : index + 1);
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const slotClass = isFirst ? "prize-podium-slot--first" : isSecond ? "prize-podium-slot--second" : "prize-podium-slot--third";
            return (
              <article
                key={`podium-${item.label}-${index}`}
                className={`prize-podium-slot ${slotClass} relative rounded-xl border bg-background/95 shadow-md backdrop-blur-sm ${
                  isFirst ? "border-primary/50 ring-2 ring-primary/25" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 font-bold ${
                      isFirst
                        ? "h-11 min-w-11 text-base bg-primary/20 text-primary"
                        : isSecond
                          ? "h-9 min-w-9 text-sm bg-secondary/20 text-secondary"
                          : "h-8 min-w-8 text-xs bg-muted text-muted-foreground"
                    }`}
                  >
                    #{rank}
                  </span>
                  <HiOutlineTrophy
                    className={`shrink-0 ${isFirst ? "h-8 w-8 text-primary" : isSecond ? "h-6 w-6 text-secondary/80" : "h-5 w-5 text-muted-foreground/70"}`}
                    aria-hidden="true"
                  />
                </div>
                <p
                  className={`font-semibold uppercase tracking-[0.14em] text-secondary ${
                    isFirst ? "mt-5 text-sm" : isSecond ? "mt-4 text-xs" : "mt-3 text-[11px]"
                  }`}
                >
                  {placementLabel(item, rank - 1)}
                </p>
                <p
                  className={`mt-2 font-serif font-semibold text-foreground ${
                    isFirst ? "text-3xl sm:text-4xl" : isSecond ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
                  }`}
                >
                  {item.amount || "TBA"}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      {remainder.length ? (
        <ol className="mt-6 divide-y divide-border/70 rounded-xl border border-border/80 bg-background/80">
          {remainder.map((item, index) => (
            <li key={`prize-rest-${item.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-xs font-semibold text-muted-foreground">
                  {item.placement ?? index + 4}
                </span>
                <span className="text-sm font-medium text-foreground">{placementLabel(item, (item.placement ?? index + 4) - 1)}</span>
              </div>
              <span className="font-serif text-lg font-semibold text-primary">{item.amount || "TBA"}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function TournamentInfo({ event, message, navigate }) {
  const tournament = event?.tournament;
  const teamLookup = useMemo(
    () => buildTeamNameLookup(event?.teams, event?.setupTeams),
    [event?.teams, event?.setupTeams],
  );
  const showHonors = hasPublicHonorsContent(event?.honors);
  const [announcementPage, setAnnouncementPage] = useState(0);

  const announcementEntries = useMemo(() => {
    const list = parseAnnouncementEntries(tournament?.announcements).filter((e) => e.body.trim());
    const rank = (postedAt) => {
      if (!postedAt) return Number.NEGATIVE_INFINITY;
      const t = new Date(postedAt).getTime();
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
    };
    const withMeta = list.map((entry, origIdx) => ({ entry, origIdx }));
    /** #1 = oldest by posted time; undated items use save order (first in list = older). */
    const chronology = [...withMeta].sort((a, b) => {
      const diff = rank(a.entry.postedAt) - rank(b.entry.postedAt);
      if (diff !== 0) return diff;
      return a.origIdx - b.origIdx;
    });
    const creationNumberByOrigIdx = new Map();
    chronology.forEach((item, i) => {
      creationNumberByOrigIdx.set(item.origIdx, i + 1);
    });
    /** Newest first for readers. */
    const display = [...withMeta].sort((a, b) => {
      const diff = rank(b.entry.postedAt) - rank(a.entry.postedAt);
      if (diff !== 0) return diff;
      return b.origIdx - a.origIdx;
    });
    return display.map((item) => ({
      ...item.entry,
      creationNumber: creationNumberByOrigIdx.get(item.origIdx),
      origIdx: item.origIdx,
    }));
  }, [tournament?.announcements]);

  const announcementsFingerprint = useMemo(() => JSON.stringify(tournament?.announcements ?? null), [tournament?.announcements]);

  useEffect(() => {
    setAnnouncementPage(0);
  }, [announcementsFingerprint]);

  const displayAnnouncementRows = announcementEntries.length
    ? announcementEntries
    : [{ body: "Announcements will appear here.", postedAt: null, creationNumber: 1, origIdx: -1 }];

  const announcementPageCount = Math.max(1, Math.ceil(displayAnnouncementRows.length / ANNOUNCEMENTS_PAGE_SIZE));

  useEffect(() => {
    setAnnouncementPage((p) => Math.min(Math.max(0, p), announcementPageCount - 1));
  }, [announcementPageCount]);

  const safeAnnouncementPage = Math.min(announcementPage, announcementPageCount - 1);
  const pagedAnnouncements = displayAnnouncementRows.slice(
    safeAnnouncementPage * ANNOUNCEMENTS_PAGE_SIZE,
    safeAnnouncementPage * ANNOUNCEMENTS_PAGE_SIZE + ANNOUNCEMENTS_PAGE_SIZE,
  );
  const prizeBreakdown = normalizeBreakdown(tournament?.prize_pool_breakdown);
  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-md border border-border bg-card/90 p-2 text-sm text-secondary shadow-sm backdrop-blur-sm">{message}</p>
      ) : null}

      <section className="relative left-1/2 flex min-h-[60vh] w-screen -translate-x-1/2 items-center overflow-hidden border-y border-border bg-card px-4 py-10 shadow-2xl sm:px-6">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          src={images.tournamentHero}
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-linear-to-br from-background via-background/75 to-background/30" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Tournament hub</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-foreground md:text-6xl">{tournament?.name || SITE_BRAND_LINE}</h2>
            <TournamentDescriptionProse
              description={tournament?.description}
              className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed"
            />
          </div>
          <div className="tournament-hero-countdown">
            <TournamentStatusSlot
              placement="tournament"
              variant="bare"
              startDate={tournament?.start_date}
              endDate={tournament?.end_date}
              liveYoutubeUrl={tournament?.live_youtube_url}
              archiveEmbeds={event?.archiveEmbeds}
              fallbackStart={defaultTournamentStart}
              navigate={navigate}
            />
          </div>
        </div>
      </section>

      {showHonors ? (
        <div className="relative left-1/2 w-screen -translate-x-1/2 border-b border-border/70 bg-background/95 shadow-lg">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <TournamentWinnersBlock
              honors={event?.honors}
              teams={event?.teams}
              teamLookup={teamLookup}
              tournament={tournament}
              showCustomCards
            />
          </div>
        </div>
      ) : null}

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="pointer-events-none absolute inset-0 z-0 min-h-full" aria-hidden="true">
          <img alt="" className="h-full w-full min-h-full object-cover" src={images.tournamentPageBg} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/88 via-background/76 to-background/86" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 pb-4">
          <section className="tournament-stats" aria-label="Tournament details">
            <div className="tournament-stats__grid">
              <TournamentStatCard
                label="Format"
                value={`${getFormatName(tournament?.format)} · ${tournament?.team_count || "TBA"} teams`}
              />
              <TournamentStatCard label="Registration fee" value={tournament?.entry_fee || "TBA"} />
              <TournamentStatCard label="Prize pool" value={tournament?.prize_pool || "TBA"} accent />
              <TournamentStatCard label="Registration cutoff" value={formatDate(tournament?.registration_deadline)} />
            </div>
          </section>

          <section className="announcement-panel relative overflow-hidden rounded-2xl border-2 border-primary/45 bg-card/90 p-5 shadow-2xl shadow-primary/10 ring-1 ring-primary/15 backdrop-blur-md sm:p-8">
            <div
              className="announcement-panel-accent pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent"
              aria-hidden="true"
            />
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Official updates</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">Announcements</h3>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-foreground/90 sm:text-base">
                Read these first — schedule changes, rules, and tournament news are posted here.
              </p>
            </div>
            <div key={`announcement-page-${safeAnnouncementPage}`} className="space-y-4">
              {pagedAnnouncements.map((entry, i) => (
                <article
                  key={`announcement-${entry.origIdx}-${entry.creationNumber}-${i}`}
                  className="announcement-card rounded-xl border border-border bg-background/95 p-5 shadow-md backdrop-blur-sm sm:p-6"
                >
                  <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.12em] text-primary sm:text-xs sm:tracking-[0.16em]">
                    BPC LEAGUE ANNOUNCEMENT #{entry.creationNumber}{" "}
                    <span className="font-semibold tracking-wide text-foreground">{formatAnnouncementPostedAt(entry.postedAt)}</span>
                  </p>
                  <p className="mt-3 text-base font-medium leading-relaxed text-foreground sm:text-lg sm:leading-relaxed">{entry.body}</p>
                </article>
              ))}
            </div>
            {announcementPageCount > 1 ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={safeAnnouncementPage <= 0}
                  onClick={() => setAnnouncementPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <p className="text-sm text-muted-foreground">
                  Page <span className="font-medium text-foreground">{safeAnnouncementPage + 1}</span> of{" "}
                  <span className="font-medium text-foreground">{announcementPageCount}</span>
                  <span className="mx-1 text-muted-foreground/80">·</span>
                  {displayAnnouncementRows.length} update{displayAnnouncementRows.length === 1 ? "" : "s"}
                </p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={safeAnnouncementPage >= announcementPageCount - 1}
                  onClick={() => setAnnouncementPage((p) => Math.min(announcementPageCount - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>

          <PrizePoolBreakdown total={tournament?.prize_pool} items={prizeBreakdown} />
        </div>
      </div>

      <TournamentRulebookSection tournament={tournament} />
    </div>
  );
}

function TournamentRulebookSection({ tournament }) {
  const formatName = getFormatName(tournament?.format);
  return (
    <section
      id="tournament-rulebook"
      className="tournament-format-section"
      aria-labelledby="tournament-format-heading"
    >
      <div className="tournament-format-section__bg" aria-hidden="true">
        <img src={images.rulebookBg} alt="" />
        <div className="tournament-format-section__bg-shade" />
      </div>
      <div className="tournament-format-section__inner">
        <div className="landing-panel tournament-format-panel">
          <p className="tournament-format-panel__badge">
            <span>{SITE_BRAND_SHORT} format guide</span>
          </p>
          <h2 id="tournament-format-heading" className="tournament-format-panel__title">
            Understand the BLAST-style format
          </h2>
          <p className="tournament-format-panel__subtitle">
            How {formatName} runs in {SITE_BRAND_SHORT} — structure, rules, and what to expect before match day.
          </p>
          <div className="tournament-format-panel__body">
            {tournament?.rulebook?.trim() ? (
              <div
                className={`${rulebookContentClassName} tournament-format-panel__body--prose text-sm leading-7 text-muted-foreground sm:text-base md:text-lg md:leading-8`}
                dangerouslySetInnerHTML={{ __html: sanitizeRulebookHtml(tournament.rulebook) }}
              />
            ) : (
              <p className="text-sm leading-7 text-muted-foreground sm:text-base md:text-lg md:leading-8">
                Format details and rules will be published here before the tournament starts.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RevealSection({ children }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`w-full max-w-none ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} transition-all duration-700`}
    >
      {children}
    </div>
  );
}

function scheduleTeamLogoStyle(team) {
  const hex = team?.accentColor || team?.accent_color;
  const triplet = hexToRgbTriplet(hex);
  if (!triplet) return undefined;
  return {
    "--schedule-team-accent": triplet,
    borderColor: `color-mix(in srgb, rgb(${triplet}) 42%, rgb(255 255 255 / 0.12))`,
    boxShadow: `0 4px 14px rgb(0 0 0 / 0.35), 0 0 20px color-mix(in srgb, rgb(${triplet}) 22%, transparent)`,
  };
}

const ScheduleMatchTeam = memo(function ScheduleMatchTeam({
  name,
  team,
  tokenHelp,
  isWinner = false,
  isLoser = false,
  logoPriority = "low",
}) {
  const logo = team?.logoUrl || team?.logo_url || "";
  const displayName = name || "TBD";
  const initials = team ? teamInitials(team) : displayName.slice(0, 2).toUpperCase();
  const [logoBroken, setLogoBroken] = useState(false);
  const teamClass = [
    "schedule-match__team",
    isWinner ? "schedule-match__team--winner" : "",
    isLoser ? "schedule-match__team--loser" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setLogoBroken(false);
  }, [logo]);

  const eager = logoPriority === "high";

  return (
    <div className={teamClass}>
      <div className="schedule-match__logo" style={scheduleTeamLogoStyle(team)}>
        {logo && !logoBroken ? (
          <TeamLogoImg
            src={logo}
            alt=""
            className="schedule-match__logo-img"
            width={58}
            height={58}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={logoPriority}
            onError={() => setLogoBroken(true)}
          />
        ) : (
          <span className="schedule-match__logo-fallback" aria-hidden>
            {initials}
          </span>
        )}
      </div>
      <div className="schedule-match__team-head">
        <span className="schedule-match__team-name">{displayName}</span>
        {tokenHelp ? <BracketTokenHelp help={tokenHelp} label={displayName} /> : null}
      </div>
    </div>
  );
});

function ScheduleStreamCta({ streamUrl, streamLabel, live = false }) {
  const link = parseStreamWatchLink(streamUrl);
  if (!link) return null;
  const channel =
    streamLabel && String(streamLabel).trim() && String(streamLabel).trim().toLowerCase() !== "main"
      ? String(streamLabel).trim()
      : null;

  return (
    <a
      className={`schedule-match__yt-cta${live ? " schedule-match__yt-cta--live" : ""}${link.isYoutube ? "" : " schedule-match__yt-cta--generic"}`}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="schedule-match__yt-icon" aria-hidden>
        <FaYoutube />
      </span>
      <span className="schedule-match__yt-copy">
        <span className="schedule-match__yt-title">{link.title}</span>
        {channel ? <span className="schedule-match__yt-channel">{channel}</span> : null}
      </span>
      <FaExternalLinkAlt className="schedule-match__yt-arrow" aria-hidden />
    </a>
  );
}

const PublicScheduleMatchCard = memo(function PublicScheduleMatchCard({
  slot,
  match,
  stageLabel,
  roundStructureAll,
  teamByName,
  allMatches,
  blastBracketDepths,
  blastVariant,
}) {
  const effectiveStatus = resolveScheduleStatus(slot, match);
  const isLive = effectiveStatus === "live";
  const isFinished = effectiveStatus === "finished";
  const logoPriority = isLive ? "high" : effectiveStatus === "upcoming" ? "auto" : "low";
  const streamUrl = typeof slot.streamUrl === "string" ? slot.streamUrl.trim() : "";
  const start = new Date(slot.startAt);
  const timeLabel = Number.isNaN(start.getTime())
    ? ""
    : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const team1 = match?.team1;
  const team2 = match?.team2;
  const team1Record = findTeamByName(teamByName, team1);
  const team2Record = findTeamByName(teamByName, team2);
  const tokenHelp1 = buildBracketTokenHelp(team1, allMatches, { blastBracketDepths, blastVariant });
  const tokenHelp2 = buildBracketTokenHelp(team2, allMatches, { blastBracketDepths, blastVariant });
  const seriesLabel = match?.meta?.seriesType ? String(match.meta.seriesType).toUpperCase() : "";
  const scores = getMatchDisplayScores(match);
  const hasResult = isFinished && (scores.ready || Boolean(scores.winner));
  const showStatus = !isLive && !isFinished && effectiveStatus !== "upcoming";
  const centerLabel =
    hasResult && scores.ready ? (
      <span className="schedule-match__score-pill" aria-label={`Final score ${scores.team1} to ${scores.team2}`}>
        <span className={scores.winner === team1 ? "schedule-match__score-pill--lead" : ""}>{scores.team1}</span>
        <span className="schedule-match__score-sep" aria-hidden>
          –
        </span>
        <span className={scores.winner === team2 ? "schedule-match__score-pill--lead" : ""}>{scores.team2}</span>
      </span>
    ) : (
      <span className="schedule-match__vs" aria-hidden>
        vs
      </span>
    );

  return (
    <article
      className={`schedule-match${isLive ? " schedule-match--live" : ""}${isFinished ? " schedule-match--finished" : ""}`}
      data-status={effectiveStatus}
    >
      <div className="schedule-match__main">
        {isLive ? (
          <span className="schedule-match__live-badge">
            <span className="schedule-match__live-dot" aria-hidden />
            Live now
          </span>
        ) : null}
        {hasResult && !scores.ready && scores.winner ? (
          <p className="schedule-match__result-banner">
            <span className="schedule-match__result-label">Result</span>
            <span className="schedule-match__result-winner">{scores.winner} wins</span>
          </p>
        ) : null}
        {match ? (
          <div className="schedule-match__teams">
            <ScheduleMatchTeam
              name={team1}
              team={team1Record}
              tokenHelp={tokenHelp1}
              logoPriority={logoPriority}
              isWinner={hasResult && scores.winner === team1}
              isLoser={hasResult && Boolean(scores.winner) && scores.winner !== team1}
            />
            {centerLabel}
            <ScheduleMatchTeam
              name={team2}
              team={team2Record}
              tokenHelp={tokenHelp2}
              logoPriority={logoPriority}
              isWinner={hasResult && scores.winner === team2}
              isLoser={hasResult && Boolean(scores.winner) && scores.winner !== team2}
            />
          </div>
        ) : (
          <p className="schedule-match__team-name">{slot.matchId}</p>
        )}
        <p className="schedule-match__meta">
          {timeLabel ? (
            <>
              <span className="schedule-match__time">{timeLabel}</span>
              {!isFinished && slot.stream ? " · " : null}
            </>
          ) : null}
          {!isFinished && slot.stream ? <span>{slot.stream}</span> : null}
          {!timeLabel && !isFinished && !slot.stream ? "Time TBA" : null}
          {isFinished && scores.ready ? (
            <>
              {timeLabel ? " · " : null}
              <span className="schedule-match__final">Final</span>
            </>
          ) : null}
        </p>
        {showStatus ? <p className="schedule-match__status">{effectiveStatus}</p> : null}
        {streamUrl && !isFinished ? <ScheduleStreamCta streamUrl={streamUrl} streamLabel={slot.stream} live={isLive} /> : null}
      </div>
      <aside className="schedule-match__bracket">
        <p className="schedule-match__bracket-label">Bracket</p>
        <p className="schedule-match__bracket-stage">{stageLabel}</p>
        {seriesLabel ? <p className="schedule-match__bracket-series">{seriesLabel}</p> : null}
        <p className="schedule-match__bracket-round">
          {match ? formatMatchRoundSummary(match, roundStructureAll) : "—"}
        </p>
      </aside>
    </article>
  );
});

function PublicScheduleStatusSection({ title, subtitle, children, show = true, variant = "" }) {
  if (!show) return null;
  const variantClass = variant ? ` schedule-section--${variant}` : "";
  return (
    <section className={`schedule-section schedule-glass${variantClass}`}>
      <header className="schedule-section__head">
        <div>
          <h3 className="schedule-section__title">{title}</h3>
          {subtitle ? <p className="schedule-section__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="schedule-section__body">{children}</div>
    </section>
  );
}

const SCHEDULE_LIST_INITIAL = 5;

function filterScheduleSlotsByTeam(slots, matches, teamName) {
  const selected = String(teamName || "").trim();
  if (!selected) return slots;
  const needle = selected.toLowerCase();
  return (slots || []).filter((slot) => {
    const match = matches?.find((entry) => entry.id === slot.matchId);
    const team1 = String(match?.team1 || "").toLowerCase();
    const team2 = String(match?.team2 || "").toLowerCase();
    return team1 === needle || team2 === needle;
  });
}

function PublicScheduleMatchListSection({
  title,
  subtitle,
  show = true,
  slots = [],
  matches,
  teamOptions = [],
  grouped = false,
  renderScheduleSlot,
  initialVisible = SCHEDULE_LIST_INITIAL,
}) {
  const [teamFilter, setTeamFilter] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [teamFilter]);

  const filtered = useMemo(
    () => filterScheduleSlotsByTeam(slots, matches, teamFilter),
    [slots, matches, teamFilter],
  );

  const visibleSlots = expanded ? filtered : filtered.slice(0, initialVisible);
  const hiddenCount = Math.max(0, filtered.length - initialVisible);

  if (!show) return null;

  return (
    <section className="schedule-section schedule-glass">
      <header className="schedule-section__head">
        <div>
          <h3 className="schedule-section__title">{title}</h3>
          {subtitle ? <p className="schedule-section__subtitle">{subtitle}</p> : null}
        </div>
        {teamOptions.length > 0 ? (
          <label className="schedule-section__filter">
            <span className="schedule-section__filter-label">Filter by team</span>
            <select
              className="schedule-section__filter-select"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
            >
              <option value="">All teams</option>
              {teamOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>
      <div className="schedule-section__body">
        {filtered.length === 0 ? (
          <p className="schedule-section__empty">
            {teamFilter.trim() ? "No matches found for that team." : "No matches in this section yet."}
          </p>
        ) : grouped ? (
          <div className="schedule-page__sections">
            {groupScheduleSlotsByDate(visibleSlots).map((day) => (
              <div key={day.dateKey} className="schedule-day-group">
                <h4 className="schedule-day-heading">{day.heading}</h4>
                {day.slots.map(renderScheduleSlot)}
              </div>
            ))}
          </div>
        ) : (
          visibleSlots.map(renderScheduleSlot)
        )}

        {hiddenCount > 0 && !expanded ? (
          <button type="button" className="schedule-section__view-more" onClick={() => setExpanded(true)}>
            View more ({hiddenCount})
          </button>
        ) : null}
        {expanded && filtered.length > initialVisible ? (
          <button type="button" className="schedule-section__view-more" onClick={() => setExpanded(false)}>
            Show less
          </button>
        ) : null}
      </div>
    </section>
  );
}

function PublicSchedulePhaseCompleteNotice({ message }) {
  if (!message) return null;
  return (
    <div className="schedule-phase-complete-notice schedule-glass" role="status">
      <p className="schedule-phase-complete-notice__text">{message}</p>
    </div>
  );
}

export function PublicSchedule({ event, message }) {
  const { hash } = useLocation();
  const [viewMode, setViewMode] = useState(() => parseScheduleViewHash());
  const [phaseTab, setPhaseTab] = useState(SCHEDULE_PHASE_GROUPS);
  const completionSnapshotRef = useRef("");
  const tournamentIdRef = useRef("");

  useEffect(() => {
    setViewMode(parseScheduleViewHash(hash));
  }, [hash]);

  useEffect(() => {
    const onHash = () => setViewMode(parseScheduleViewHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setScheduleViewMode = useCallback((mode) => {
    setViewMode(mode);
    const href = scheduleViewHref(mode);
    if (`${window.location.pathname}${window.location.hash}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, []);
  const teamByName = useMemo(
    () => buildTeamNameLookup(event?.teams, event?.setupTeams),
    [event?.teams, event?.setupTeams],
  );

  const engineConfig = event?.tournament?.engine_config ?? null;
  const tournamentFormat = event?.tournament?.format || "";

  const roundStructureAll = useMemo(() => stageRoundStructure(event?.matches || []), [event?.matches]);
  const { groupedMatches, stageTabs, stageLabels } = useMemo(() => {
    const groups = {};
    (event?.matches || []).forEach((match) => {
      if (!groups[match.stageKey]) groups[match.stageKey] = [];
      groups[match.stageKey].push(match);
    });
    const augmented = augmentGroupedBracketMatches(groups);
    const resolved = resolveBracketTabs(tournamentFormat, event?.tabs, engineConfig);
    const raw = resolved?.length ? resolved : Object.keys(augmented).map((id) => ({ id, label: id }));
    const tabs = normalizedBlastBracketTabs(tournamentFormat, raw);
    const labels = buildStageTabLabels(tournamentFormat, tabs);
    return { groupedMatches: augmented, stageTabs: tabs, stageLabels: labels };
  }, [event, engineConfig, tournamentFormat]);

  const bracketViewSections = useMemo(
    () => resolveBracketViewSections(engineConfig, tournamentFormat, stageTabs),
    [engineConfig, tournamentFormat, stageTabs],
  );

  const blastVariant = useMemo(() => inferBlastBracketVariant(event?.matches || []), [event?.matches]);
  const blastBracketDepths = useMemo(
    () => ({
      lc: blastStageRoundColumnCount(event?.matches || [], "blast-lastchance"),
      pi: blastStageRoundColumnCount(event?.matches || [], "blast-playin"),
    }),
    [event?.matches],
  );

  const phaseTabOrder = useMemo(() => getSchedulePhaseTabOrder(event?.matches || []), [event?.matches]);

  const preferredPhaseTab = useMemo(
    () => getPreferredSchedulePhaseTab(event?.matches || []),
    [event?.matches],
  );

  const phaseCompletionKey = useMemo(() => {
    const matches = event?.matches || [];
    return [
      isSchedulePhaseComplete(matches, SCHEDULE_PHASE_GROUPS),
      isSchedulePhaseComplete(matches, SCHEDULE_PHASE_QUALIFIERS),
      isSchedulePhaseComplete(matches, SCHEDULE_PHASE_PLAYOFFS),
    ]
      .map((value) => (value ? "1" : "0"))
      .join("");
  }, [event?.matches]);

  useEffect(() => {
    const tournamentId = event?.tournament?.id || "";
    if (!tournamentId) return;
    if (tournamentIdRef.current !== tournamentId) {
      tournamentIdRef.current = tournamentId;
      completionSnapshotRef.current = phaseCompletionKey;
      setPhaseTab(preferredPhaseTab);
      return;
    }
    if (completionSnapshotRef.current && completionSnapshotRef.current !== phaseCompletionKey) {
      setPhaseTab(preferredPhaseTab);
    }
    completionSnapshotRef.current = phaseCompletionKey;
  }, [event?.tournament?.id, phaseCompletionKey, preferredPhaseTab]);

  const phaseNavTabs = useMemo(() => {
    const allMatches = event?.matches || [];
    const defs = resolveSchedulePhaseNavTabs(engineConfig, tournamentFormat, allMatches);
    const byId = Object.fromEntries(defs.map((tab) => [tab.id, tab]));
    return phaseTabOrder.map((phaseId) => byId[phaseId]).filter(Boolean);
  }, [event?.matches, phaseTabOrder, engineConfig, tournamentFormat]);

  const phaseCompleteNotice = useMemo(() => {
    const matches = event?.matches || [];
    if (!isSchedulePhaseComplete(matches, phaseTab)) return "";
    return getSchedulePhaseCompleteNotice(phaseTab);
  }, [event?.matches, phaseTab]);

  const phaseSlots = useMemo(() => {
    return [...(event?.schedule || [])]
      .filter((slot) => isValidScheduleInstant(slot.startAt))
      .filter((slot) => {
        const match = event?.matches?.find((m) => m.id === slot.matchId);
        if (!match) return false;
        return getSchedulePhase(match.stageKey, engineConfig, tournamentFormat) === phaseTab;
      });
  }, [event?.schedule, event?.matches, phaseTab, engineConfig, tournamentFormat]);

  const scheduleByStatus = useMemo(() => {
    const byTime = (a, b) => new Date(a.startAt) - new Date(b.startAt);
    const statusOf = (slot) => resolveScheduleStatus(slot, event?.matches?.find((m) => m.id === slot.matchId));
    const live = phaseSlots.filter((s) => statusOf(s) === "live").sort(byTime);
    const upcoming = phaseSlots.filter((s) => statusOf(s) === "upcoming").sort(byTime);
    const finished = phaseSlots.filter((s) => statusOf(s) === "finished").sort(byTime);
    return {
      live,
      upcomingByDate: groupScheduleSlotsByDate(upcoming),
      finished,
    };
  }, [phaseSlots, event?.matches]);

  const upcomingSlotsFlat = useMemo(
    () => scheduleByStatus.upcomingByDate.flatMap((day) => day.slots),
    [scheduleByStatus.upcomingByDate],
  );

  const scheduleTeamOptions = useMemo(
    () =>
      (event?.teams || [])
        .map((team) => String(team.name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [event?.teams],
  );

  const hasScheduleContent =
    scheduleByStatus.live.length > 0 ||
    scheduleByStatus.upcomingByDate.length > 0 ||
    scheduleByStatus.finished.length > 0;

  const scheduleHeroStats = useMemo(() => {
    const matches = event?.matches || [];
    const slots = (event?.schedule || []).filter((slot) => isValidScheduleInstant(slot.startAt));
    const statusOf = (slot) => resolveScheduleStatus(slot, matches.find((m) => m.id === slot.matchId));
    const liveCount = slots.filter((slot) => statusOf(slot) === "live").length;
    const upcomingCount = slots.filter((slot) => statusOf(slot) === "upcoming").length;
    const completedMatches = matches.filter((match) => match.winner || match.status === "finished").length;
    const activePhaseLabel = phaseNavTabs.find((tab) => tab.id === preferredPhaseTab)?.shortLabel || "Groups";

    return {
      tournamentName: event?.tournament?.name || SITE_BRAND_SHORT,
      formatLabel: getFormatName(tournamentFormat),
      teamCount: (event?.teams || []).length,
      totalMatches: matches.length,
      completedMatches,
      liveCount,
      upcomingCount,
      activePhaseLabel,
      isDemo: event?.tournament?.visibility_mode === "demo",
      bracketActive: Boolean(event?.tournament?.bracket_active),
    };
  }, [event, phaseNavTabs, preferredPhaseTab, tournamentFormat]);

  useEffect(() => {
    const urls = collectTeamLogoUrls(event?.teams, event?.setupTeams);
    if (urls.length) void preloadTeamLogos(urls);
  }, [event?.teams, event?.setupTeams]);

  const renderScheduleSlot = useCallback(
    (slot) => {
      const match = event?.matches?.find((entry) => entry.id === slot.matchId);
      const stageLabel = stageLabels[match?.stageKey] || match?.stageKey || "Bracket";
      return (
        <PublicScheduleMatchCard
          key={slot.id}
          slot={slot}
          match={match}
          stageLabel={stageLabel}
          roundStructureAll={roundStructureAll}
          teamByName={teamByName}
          allMatches={event?.matches || []}
          blastBracketDepths={blastBracketDepths}
          blastVariant={blastVariant}
        />
      );
    },
    [event?.matches, stageLabels, roundStructureAll, teamByName, blastBracketDepths, blastVariant],
  );

  return (
    <div className="schedule-page-layout">
      <section className="schedule-page__hero-band" aria-labelledby="schedule-page-title">
        <div className="schedule-page__hero-band-overlay" aria-hidden="true" />
        <div className="schedule-page__hero-inner">
          <p className="schedule-page__eyebrow">{scheduleHeroStats.tournamentName}</p>
          <h1 id="schedule-page-title" className="schedule-page__hero-title">
            Bracket &amp; Schedule
          </h1>
          <p className="schedule-page__hero-lead">
            {scheduleHeroStats.isDemo
              ? "Demo preview — bracket trees and match times update when the tournament goes live."
              : "Stage brackets, group standings, and match times for every phase of the circuit."}
          </p>
          <div className="schedule-page__hero-meta">
            <div className="schedule-page__hero-chips" aria-label="Tournament overview">
              <span className="schedule-page__chip">{scheduleHeroStats.formatLabel}</span>
              {scheduleHeroStats.teamCount > 0 ? (
                <span className="schedule-page__chip">
                  {scheduleHeroStats.teamCount} team{scheduleHeroStats.teamCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {scheduleHeroStats.totalMatches > 0 ? (
                <span className="schedule-page__chip">
                  {scheduleHeroStats.completedMatches}/{scheduleHeroStats.totalMatches} matches played
                </span>
              ) : (
                <span className="schedule-page__chip">Bracket building</span>
              )}
              {scheduleHeroStats.liveCount > 0 ? (
                <span className="schedule-page__chip schedule-page__chip--live">
                  {scheduleHeroStats.liveCount} live now
                </span>
              ) : null}
              {scheduleHeroStats.upcomingCount > 0 ? (
                <span className="schedule-page__chip">{scheduleHeroStats.upcomingCount} upcoming</span>
              ) : null}
              <span className="schedule-page__chip">Focus: {scheduleHeroStats.activePhaseLabel}</span>
              {scheduleHeroStats.isDemo ? (
                <span className="schedule-page__chip schedule-page__chip--demo">Demo mode</span>
              ) : scheduleHeroStats.bracketActive ? (
                <span className="schedule-page__chip schedule-page__chip--active">Bracket live</span>
              ) : (
                <span className="schedule-page__chip">Bracket pending</span>
              )}
            </div>
            <div className="schedule-page__hero-actions" aria-label="Related pages">
              <Link to="/tournament" className="schedule-page__hero-link">
                Tournament hub
              </Link>
              <Link to="/announcements" className="schedule-page__hero-link schedule-page__hero-link--secondary">
                News
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="schedule-page">
      {message ? <p className="schedule-page__message schedule-glass">{message}</p> : null}
      <PrimaryViewTabs
        ariaLabel="Bracket or schedule view"
        value={viewMode}
        onChange={setScheduleViewMode}
        tabs={[
          { id: "bracket", label: "Bracket" },
          { id: "schedule", label: "Schedule" },
        ]}
      />

      {viewMode === "bracket" ? (
        <>
          {(event?.groupedStandings || []).length ? (
            <section className="schedule-page__block schedule-page__standings-block">
              <div className="schedule-page__standings-head">
                <h3 className="schedule-page__block-title">Group standings</h3>
                <p className="schedule-page__block-copy">Live group-stage records.</p>
              </div>
              <div className="schedule-page__standings-grid">
                {event.groupedStandings.map((group) => (
                  <StandingsTable key={group.id} title={group.label} rows={group.rows} variant="public" teamLookup={teamByName} />
                ))}
              </div>
            </section>
          ) : null}
          <div className="schedule-page__sections">
          {bracketViewSections.map((section) => {
            const sectionTabs = section.tabIds
              .map((tabId) => stageTabs.find((tab) => tab.id === tabId) || { id: tabId, label: section.label })
              .filter((tab) => (groupedMatches[tab.id] || []).length > 0);
            if (!sectionTabs.length) return null;
            return sectionTabs.map((tab) => {
              const matches = groupedMatches[tab.id] || [];
              const phase = getBracketPhaseForTab(tab.id);
              const seriesSummary =
                phase === SCHEDULE_PHASE_QUALIFIERS || phase === SCHEDULE_PHASE_PLAYOFFS
                  ? summarizeSeriesTypes(matches)
                  : null;
              return (
                <section key={tab.id} className="schedule-page__block schedule-glass space-y-3">
                  <div>
                    <h3 className="schedule-page__block-title">
                      {tab.label}
                      {seriesSummary ? (
                        <span className="schedule-page__series-badge" title={`Series: ${seriesSummary}`}>
                          {seriesSummary}
                        </span>
                      ) : null}
                    </h3>
                    <p className="schedule-page__block-copy">Bracket progression for this stage.</p>
                  </div>
                  <Suspense fallback={<PageLoadingSpinner label="Loading bracket…" />}>
                    <BracketDiagram
                      appearance="glass"
                      matches={matches}
                      blastSeedMatches={event?.matches ?? []}
                      playoffFeedMatches={
                        tab.id === "blast-qualifiers"
                          ? (groupedMatches["blast-playoffs"] || []).filter((m) => (m.roundIndex ?? 0) === 0)
                          : undefined
                      }
                    />
                  </Suspense>
                </section>
              );
            });
          })}
          </div>
        </>
      ) : (
        <>
          <SchedulePhaseTabs value={phaseTab} onChange={setPhaseTab} tabs={phaseNavTabs} />
          <div className="schedule-page__sections">
            <PublicScheduleStatusSection
              title="Live"
              subtitle="Matches on air right now."
              show={scheduleByStatus.live.length > 0}
              variant="live"
            >
              {scheduleByStatus.live.map(renderScheduleSlot)}
            </PublicScheduleStatusSection>

            <PublicScheduleMatchListSection
              key={`upcoming-${phaseTab}`}
              title="Upcoming"
              subtitle="Grouped by match day."
              show={scheduleByStatus.upcomingByDate.length > 0}
              slots={upcomingSlotsFlat}
              matches={event?.matches}
              teamOptions={scheduleTeamOptions}
              grouped
              renderScheduleSlot={renderScheduleSlot}
            />

            <PublicSchedulePhaseCompleteNotice
              message={phaseCompleteNotice && scheduleByStatus.finished.length > 0 ? phaseCompleteNotice : ""}
            />

            <PublicScheduleMatchListSection
              key={`finished-${phaseTab}`}
              title="Finished"
              subtitle="Completed matches in start-time order."
              show={scheduleByStatus.finished.length > 0}
              slots={scheduleByStatus.finished}
              matches={event?.matches}
              teamOptions={scheduleTeamOptions}
              renderScheduleSlot={renderScheduleSlot}
            />

            {!hasScheduleContent ? (
              <p className="schedule-page__empty schedule-glass">No scheduled matches for this phase yet.</p>
            ) : null}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle={`How ${SITE_BRAND_SHORT} collects, uses, and protects your information.`}
      meta={`Last updated ${new Date().getFullYear()}. This website is operated by ${TRADE_NAME}.`}
      footerNote={`Privacy inquiries: ${PUBLIC_CONTACT_EMAIL}.`}
    >
      <LegalSection title="1. Who we are" accent>
        <p>
          {SITE_BRAND_FULL} ({SITE_BRAND_SHORT}) is operated by <strong>{TRADE_NAME}</strong>. This
          policy explains how we handle personal information when you browse {SITE_ORIGIN}, create a
          player account, register for tournaments, or contact organisers.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul>
          <li>
            <strong>Account &amp; registration:</strong> Name, email address, phone number (if
            provided), Steam and Discord identifiers, in-game details, team preferences, and
            documents you upload (such as payment screenshots).
          </li>
          <li>
            <strong>Payment data:</strong> Transaction references and payment status from our
            payment gateway. We do not store full card numbers or UPI PINs on our servers.
          </li>
          <li>
            <strong>Communications:</strong> Emails we send (OTPs, verification, registration
            updates) and messages you send to support channels.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, browser type, device information, timestamps,
            and security logs generated by our hosting infrastructure.
          </li>
          <li>
            <strong>Admin access:</strong> Credentials and activity logs for organisers using the
            staff portal, handled separately for access control and audit purposes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul>
          <li>Verify identity, eligibility, and registration payments.</li>
          <li>Run brackets, schedules, rosters, and match-day operations.</li>
          <li>Send transactional emails and in-app notifications about your registration status.</li>
          <li>Respond to support requests, disputes, refunds, and cancellation requests.</li>
          <li>Maintain platform security, prevent fraud, and enforce tournament rules.</li>
          <li>Improve the website and keep a reasonable archive of season records.</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </LegalSection>

      <LegalSection title="4. Legal basis and consent">
        <p>
          We process data to perform our contract with you (registration services), pursue legitimate
          interests in running safe tournaments, and comply with legal obligations. Where required,
          we ask for your consent—for example when you accept cookies or submit optional profile
          information.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing with third parties">
        <p>We may share limited data with:</p>
        <ul>
          <li>
            <strong>Payment processors</strong> (such as Razorpay or PayU) to complete INR
            transactions.
          </li>
          <li>
            <strong>Email delivery providers</strong> configured by organisers for transactional
            messages.
          </li>
          <li>
            <strong>Hosting and infrastructure providers</strong> that operate servers and security
            services.
          </li>
          <li>
            <strong>Community platforms</strong> such as Discord when you choose to link accounts or
            join event channels.
          </li>
        </ul>
        <p>Each third party processes data under its own privacy terms where applicable.</p>
      </LegalSection>

      <LegalSection title="6. Storage, retention, and security">
        <p>
          Data is stored on secure servers for as long as needed to operate the tournament, handle
          disputes, and maintain reasonable season archives. We use access controls, encrypted
          connections (HTTPS), and administrative safeguards. No method of transmission over the
          internet is 100% secure, but we work to protect information appropriately.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights and choices">
        <p>You may request to:</p>
        <ul>
          <li>Access or correct registration data associated with your account.</li>
          <li>Ask questions about how your information is used.</li>
          <li>Request deletion where retention is no longer required and no dispute is pending.</li>
        </ul>
        <p>
          Contact us at{" "}
          <a className="legal-page__link" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
            {PUBLIC_CONTACT_EMAIL}
          </a>{" "}
          or via published Discord channels. Essential cookies and browser storage are described in
          our <LegalLink to="/cookies">Cookie Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          The platform is intended for participants who meet tournament eligibility requirements.
          If you believe a minor has submitted data without appropriate consent, contact us so we can
          review and remove it where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="9. Policy updates">
        <p>
          We may update this policy when our services or legal requirements change. The &quot;last
          updated&quot; date at the top will be revised accordingly. Continued use after updates
          means you accept the revised policy.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

export function CookiePolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Cookie Policy"
      subtitle={`How ${SITE_BRAND_SHORT} uses cookies and similar technologies.`}
      meta={`Last updated ${new Date().getFullYear()}. Operated by ${TRADE_NAME}.`}
      footerNote={`Questions? Email ${PUBLIC_CONTACT_EMAIL} or visit ${SITE_ORIGIN}/privacy.`}
    >
      <LegalSection title="1. What are cookies?" accent>
        <p>
          Cookies are small text files stored in your browser. We also use similar technologies such
          as <strong>local storage</strong> and <strong>session storage</strong> for essential site
          functionality.
        </p>
      </LegalSection>

      <LegalSection title="2. What we use">
        <div className="legal-page__table-wrap">
          <table className="legal-page__table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Purpose</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Consent preference</td>
                <td>Remembers that you accepted the cookie notice so it is not shown again.</td>
                <td>Persistent (until cleared)</td>
              </tr>
              <tr>
                <td>Authentication tokens</td>
                <td>Keeps you signed in to your player dashboard or admin session.</td>
                <td>Session or token lifetime</td>
              </tr>
              <tr>
                <td>Essential storage</td>
                <td>Supports navigation state and basic UI preferences required for the site to work.</td>
                <td>Varies</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. Consent banner">
        <p>
          When you click <strong>Accept</strong> on the cookie notice, we store a small value in
          your browser ({COOKIE_CONSENT_KEY}) so we do not show the banner again on future visits.
          You can clear site data in your browser settings to reset this choice.
        </p>
      </LegalSection>

      <LegalSection title="4. Analytics and advertising">
        <p>
          This site does not include third-party advertising or analytics cookies by default. If we
          add analytics in the future, this policy will be updated and consent will be requested
          where required.
        </p>
      </LegalSection>

      <LegalSection title="5. Managing cookies">
        <p>You can control cookies through your browser settings:</p>
        <ul>
          <li>Block or delete cookies and site data at any time.</li>
          <li>Note that blocking essential storage may prevent login or registration flows from working.</li>
          <li>Use private browsing if you do not want persistent tokens on a shared device.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. More information">
        <p>
          Personal data collected through registration is covered in our{" "}
          <LegalLink to="/privacy">Privacy Policy</LegalLink>. For payment and refund details, see{" "}
          <LegalLink to="/terms">Terms &amp; Conditions</LegalLink> and{" "}
          <LegalLink to="/refund-policy">Return &amp; Refund Policy</LegalLink>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

export function GeneralRulesPage({ discordUrl }) {
  const invite = (discordUrl || discordInviteUrl).trim();
  const sectionCount = PLAYER_RULES_SECTIONS.length;

  return (
    <div className="rules-page-layout">
      <section className="rules-page__hero-band" aria-labelledby="rules-page-title">
        <div className="rules-page__hero-band-overlay" aria-hidden="true" />
        <div className="rules-page__hero-inner">
          <p className="rules-page__eyebrow">{SITE_BRAND_SHORT}</p>
          <h1 id="rules-page-title" className="rules-page__hero-title">
            General Rules &amp; Player Conduct
          </h1>
          <p className="rules-page__hero-lead">
            Player behavior, eligibility, communication, and fair-play expectations for every {SITE_BRAND_FULL} event.
            These are the same rules you accept when registering.
          </p>
          <div className="rules-page__hero-meta">
            <span className="rules-page__stat">
              {sectionCount} rule section{sectionCount === 1 ? "" : "s"}
            </span>
            <a className="rules-page__stat" href={RULEBOOK_PDF_PATH} download="BPC-League-Rulebook.pdf">
              Download PDF rulebook →
            </a>
          </div>
        </div>
      </section>

      <div className="rules-page">
        <article className="rules-page__document rules-glass rules-glass--strong" aria-label="Player rulebook">
          <header className="rules-page__doc-cover">
            <p className="rules-page__doc-edition">{SITE_BRAND_FULL}</p>
            <h2 className="rules-page__doc-title">Official Player Rulebook</h2>
            <p className="rules-page__doc-subtitle">{PLAYER_RULES_REGISTRATION_NOTICE}</p>
            <a className="rules-page__doc-download" href={RULEBOOK_PDF_PATH} download="BPC-League-Rulebook.pdf">
              <HiOutlineDocumentText className="rules-page__doc-download-icon" aria-hidden />
              Download PDF rulebook
              <HiOutlineArrowDownTray className="rules-page__doc-download-arrow" aria-hidden />
            </a>
          </header>

          <nav className="rules-page__toc" aria-label="Table of contents">
            <h3 className="rules-page__toc-heading">Contents</h3>
            <ol className="rules-page__toc-list">
              {PLAYER_RULES_SECTIONS.map(([title], index) => (
                <li key={title}>
                  <a className="rules-page__toc-link" href={`#rule-section-${index + 1}`}>
                    <span className="rules-page__toc-num">{index + 1}.</span>
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="rules-page__articles">
            {PLAYER_RULES_SECTIONS.map(([title, body], index) => (
              <section
                key={title}
                id={`rule-section-${index + 1}`}
                className="rules-page__article"
                aria-labelledby={`rule-heading-${index + 1}`}
              >
                <header className="rules-page__article-header">
                  <span className="rules-page__article-num" aria-hidden>
                    §{index + 1}
                  </span>
                  <h2 id={`rule-heading-${index + 1}`} className="rules-page__article-title">
                    {title}
                  </h2>
                </header>
                <p className="rules-page__article-body">{body}</p>
                {title === PLAYER_RULES_DISCORD_SECTION_TITLE && invite ? (
                  <p className="rules-page__article-note">
                    <a className="rules-page__article-link" href={invite} target="_blank" rel="noreferrer">
                      <HiOutlineChatBubbleLeftRight className="rules-page__article-link-icon" aria-hidden />
                      Join the Discord server
                    </a>
                    {" — "}
                    required for pairings, announcements, and admin messages during the event.
                  </p>
                ) : null}
              </section>
            ))}
          </div>

          <footer className="rules-page__doc-footer">
            Questions about eligibility or conduct?{" "}
            {invite ? (
              <>
                <a href={invite} target="_blank" rel="noreferrer">
                  Join our Discord
                </a>
                {" · "}
              </>
            ) : null}
            <a href="/register">Register</a>
            {" · "}
            <a href="/tournament">Tournament hub</a>
          </footer>
        </article>
      </div>
    </div>
  );
}

function isValidDiscordHandle(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^\d{17,20}$/.test(s)) return true;
  if (/^[\w.]{2,32}#\d{4}$/i.test(s)) return true;
  if (/^[a-z0-9._]{2,32}$/i.test(s)) return true;
  return false;
}

function isValidSteamProfileLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const u = new URL(normalized);
    if (u.hostname.toLowerCase() !== "steamcommunity.com") return false;
    const pathPrefix = u.pathname.toLowerCase();
    return pathPrefix.startsWith("/profiles/") || pathPrefix.startsWith("/id/");
  } catch {
    return false;
  }
}

function RegistrationButtonSpinner() {
  return (
    <span
      className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
      aria-hidden
    />
  );
}

function RegistrationTermsModal({ open, busy, onClose, onAccept, rulebook, discordUrl }) {
  useBodyScrollLock(open);
  if (!open) return null;
  const invite = (discordUrl || discordInviteUrl).trim();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="registration-terms-title">
      <div className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-2xl">
        <div className="shrink-0 border-b border-border p-4">
          <h3 id="registration-terms-title" className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Rules — {SITE_BRAND_FULL}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Read and accept before we send a verification code to your email. This list matches the{" "}
            <a className="font-medium text-secondary underline underline-offset-2 hover:text-foreground" href="/rules" target="_blank" rel="noreferrer">
              Rules
            </a>{" "}
            page and updates whenever organizers change it.
          </p>
          <p className="mt-2 rounded-md border border-border bg-background/80 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            {PLAYER_RULES_REGISTRATION_NOTICE}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          {PLAYER_RULES_SECTIONS.map(([title, body]) => (
            <div key={title} className="rounded-md border border-border bg-background p-3">
              <h4 className="font-medium text-foreground">{title}</h4>
              <p className="mt-1 text-muted-foreground">{body}</p>
              {title === PLAYER_RULES_DISCORD_SECTION_TITLE && invite ? (
                <p className="mt-2 text-foreground">
                  <a
                    className="font-medium text-secondary underline underline-offset-2 hover:text-foreground"
                    href={invite}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join the Discord server
                  </a>
                  <span className="text-muted-foreground">
                    {" "}
                    now so you are in the right place for pairings, announcements, and admin messages.
                  </span>
                </p>
              ) : null}
            </div>
          ))}
          {rulebook?.trim() ? (
            <div className="rounded-md border border-border bg-background p-3">
              <h4 className="font-medium text-foreground">Tournament rulebook</h4>
              <div
                className={`${rulebookContentClassName} mt-2 max-h-48 overflow-y-auto text-sm text-muted-foreground`}
                dangerouslySetInnerHTML={{ __html: sanitizeRulebookHtml(rulebook) }}
              />
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary inline-flex items-center justify-center gap-2" onClick={onAccept} disabled={busy}>
            {busy ? <RegistrationButtonSpinner /> : null}
            {busy ? "Sending code…" : "I agree — send verification code"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RegistrationConflictModal({ open, stage, busy, onClose, onGoToPayment, userEmail }) {
  useBodyScrollLock(open);
  if (!open || !stage) return null;
  const isPayment = stage === "awaiting_payment";
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-conflict-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-4">
          <h3 id="registration-conflict-title" className="font-serif text-xl font-semibold text-foreground">
            {isPayment ? "Email already verified" : "Already registered"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {userEmail ? (
              <>
                For <span className="font-medium text-foreground">{userEmail}</span>:{" "}
              </>
            ) : null}
            {isPayment
              ? "You already verified this email but have not finished registration. Use the Complete payment tab with your email and registration ID from your verification email (or the continue link we sent)."
              : "A registration for this email is already submitted or under admin review. You cannot start another one. Check your inbox for updates."}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          {isPayment ? (
            <button type="button" className="btn btn-primary inline-flex items-center justify-center gap-2 sm:order-2" onClick={onGoToPayment} disabled={busy}>
              {busy ? <RegistrationButtonSpinner /> : null}
              Open Complete payment tab
            </button>
          ) : null}
          <button type="button" className={`btn btn-outline sm:order-1 ${isPayment ? "" : "w-full sm:w-auto"}`} onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaymentQrModal({ open, onClose, src }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !src) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-qr-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <h3 id="payment-qr-modal-title" className="font-serif text-lg font-semibold text-foreground">
            Payment QR — full size
          </h3>
          <button type="button" className="btn btn-sm btn-outline shrink-0" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
        <div className="mt-4 flex justify-center overflow-auto p-2">
          <img
            src={src}
            alt="Payment QR code"
            className="max-h-[min(75vh,720px)] w-full max-w-lg object-contain"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Tap outside or press Esc to close.</p>
      </div>
    </div>,
    document.body,
  );
}

function registrationFlowStepIndex(step, regTab) {
  if (step === "done") return 3;
  if (step === "payment") return 2;
  if (step === "otp") return 1;
  if (regTab === "payment" && step === "form") return 2;
  return 0;
}

const REG_FLOW_STEPS = [
  { key: "details", label: "Your details" },
  { key: "verify", label: "Email verify" },
  { key: "pay", label: "Payment" },
];

function RegistrationFlowSteps({ activeIndex }) {
  return (
    <div className="reg-page__steps" aria-label="Registration progress">
      {REG_FLOW_STEPS.map((item, index) => {
        const isDone = activeIndex > index;
        const isActive = activeIndex === index;
        return (
          <div
            key={item.key}
            className={`reg-page__step${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}`}
          >
            <span className="reg-page__step-track" aria-hidden="true">
              <span className="reg-page__step-fill" />
            </span>
            <span className="reg-page__step-label">
              <span className="reg-page__step-num" aria-hidden="true">
                {isDone ? "✓" : index + 1}
              </span>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RegistrationPage({ event, message, setMessage }) {
  const tournament = event?.tournament;
  const tournamentSlug = tournament?.slug || "bpcl";
  const discordUrl = tournament?.discord_url || discordInviteUrl;
  const registrationDeadline = tournament?.registration_deadline;
  const rosterFull = registrationCapIsFull(event, tournament);
  const registrationAccepting = tournament?.registrations_open === true && !rosterFull;
  const substitutePoolOpen = Boolean(event?.substitutePoolOpen || rosterFull);
  /** When false: admin has closed signup (deadline remains display-only while open). */
  const registrationGated = !registrationAccepting;
  const qrImage = tournament?.payment_qr_image || "";
  const paymentUpiId = (tournament?.payment_upi_id || "").trim();
  const registrationFeeDisplay = (tournament?.entry_fee || "").trim();
  const rulebook = tournament?.rulebook || "";

  const [regTab, setRegTab] = useState("new");
  const [step, setStep] = useState("form");
  const [resumeLoading, setResumeLoading] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictStage, setConflictStage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    location: "",
    phoneNumber: "",
    roles: [],
    mmr: "",
    steamName: "",
    steamProfile: "",
    discordHandle: "",
  });
  const [paymentLookupEmail, setPaymentLookupEmail] = useState("");
  const [paymentLookupCode, setPaymentLookupCode] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);

  function openConflict(stage) {
    setShowTerms(false);
    setConflictStage(stage);
    setShowConflictModal(true);
  }

  useEffect(() => {
    if (!registrationAccepting) {
      setResumeLoading(false);
      return undefined;
    }
    const qs = new URLSearchParams(window.location.search);
    const email = qs.get("email")?.trim();
    const code = qs.get("code")?.trim();
    if (!email) {
      setResumeLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { session } = await api.getRegistrationSession(tournamentSlug, email, code || undefined);
        if (cancelled || !session) return;
        setPaymentLookupEmail(session.email || email);
        setPaymentLookupCode(session.publicCode || code || "");
        setForm((prev) => ({
          ...prev,
          email: session.email || email,
          name: session.name || "",
          location: session.location || "",
          phoneNumber: session.phoneNumber || "",
          discordHandle: session.discordHandle || "",
          mmr: session.mmr != null ? String(session.mmr) : "",
          steamName: session.steamName || "",
          steamProfile: session.steamProfile || "",
          roles: Array.isArray(session.roles) && session.roles.length ? session.roles : [],
        }));
        const st = session.registrationFlowStage;
        if (st === "awaiting_otp") {
          setRegTab("new");
          setStep("otp");
        } else if (st === "awaiting_payment") {
          setRegTab("payment");
          setPublicCode(session.publicCode || code || "");
          setStep("payment");
        } else if (st === "submitted") {
          setRegTab("payment");
          setStep("done");
        }
        setMessage("");
      } catch {
        if (!cancelled) {
          setMessage("Could not resume this registration. Use the link from your email (email + registration code), or open the Complete payment tab below.");
        }
      } finally {
        if (!cancelled) setResumeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [registrationAccepting]);

  function toggleRole(role) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter((item) => item !== role) : [...prev.roles, role],
    }));
  }

  async function readPaymentFile(file) {
    if (!file) {
      setPaymentScreenshot("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image (screenshot or photo).");
      setPaymentScreenshot("");
      return;
    }
    setMessage("");
    try {
      setPaymentScreenshot(await compressImageFileForDataUrl(file));
    } catch {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPaymentScreenshot(dataUrl);
    }
  }

  function validateFormForOtp() {
    if (!form.email.trim()) return "Email is required.";
    if (!form.name.trim()) return "Name is required.";
    if (!form.phoneNumber.trim()) return "Phone number is required.";
    if (!form.discordHandle.trim()) return "Discord ID is required.";
    if (!isValidDiscordHandle(form.discordHandle)) {
      return "Discord ID must be a legacy tag (e.g. Player#4092), a handle (e.g. my_handle), or a 17–20 digit user ID.";
    }
    if (!form.steamName.trim()) return "Steam name is required.";
    if (!form.steamProfile.trim()) return "Steam profile is required.";
    if (!isValidSteamProfileLink(form.steamProfile)) {
      return "Steam profile must be a steamcommunity.com link, e.g. https://steamcommunity.com/profiles/76561198912345678 or https://steamcommunity.com/id/yourname";
    }
    if (form.mmr === "" || Number.isNaN(Number(form.mmr))) return "MMR is required.";
    const m = Number(form.mmr);
    if (!Number.isInteger(m) || m < 0 || m > 20000) return "MMR must be a whole number between 0 and 20000.";
    if (!form.roles.length) return "Select at least one role.";
    return "";
  }

  function onFormSubmit(e) {
    e.preventDefault();
    setMessage("");
    if (registrationGated) {
      setMessage("Registration is closed for this tournament.");
      return;
    }
    const err = validateFormForOtp();
    if (err) {
      setMessage(err);
      return;
    }
    void (async () => {
      setBusy(true);
      setMessage("");
      try {
        const { stage } = await api.lookupRegistrationEmail(tournamentSlug, form.email.trim());
        if (stage === "submitted" || stage === "awaiting_payment") {
          openConflict(stage);
          return;
        }
      } catch {
        // Continue to rules if lookup fails (e.g. network).
      } finally {
        setBusy(false);
      }
      setDevOtpHint("");
      setShowTerms(true);
    })();
  }

  async function onLoadPaymentSession(e) {
    e.preventDefault();
    setMessage("");
    const em = paymentLookupEmail.trim();
    const code = paymentLookupCode.trim();
    if (!em) {
      setMessage("Email is required.");
      return;
    }
    if (!code) {
      setMessage("Registration ID is required (for example BPC-001). Find it in your verification email.");
      return;
    }
    if (registrationGated) {
      setMessage("Registration is closed for this tournament.");
      return;
    }
    setBusy(true);
    try {
      const { session } = await api.getRegistrationSession(tournamentSlug, em, code);
      const st = session.registrationFlowStage;
      if (st !== "awaiting_payment" && st !== "submitted") {
        setMessage(
          st === "awaiting_otp"
            ? "This email still needs verification. Use the New registration tab first so we can email you a code."
            : "This registration cannot be continued from the payment step.",
        );
        return;
      }
      setForm((prev) => ({
        ...prev,
        email: session.email || em,
        name: session.name || "",
        location: session.location || "",
        phoneNumber: session.phoneNumber || "",
        discordHandle: session.discordHandle || "",
        mmr: session.mmr != null ? String(session.mmr) : "",
        steamName: session.steamName || "",
        steamProfile: session.steamProfile || "",
        roles: Array.isArray(session.roles) && session.roles.length ? session.roles : [],
      }));
      setPublicCode(session.publicCode || code);
      if (st === "submitted") {
        setStep("done");
      } else {
        setStep("payment");
      }
      const url = `/register?resume=1&email=${encodeURIComponent(em)}&code=${encodeURIComponent(session.publicCode || code)}`;
      window.history.replaceState({}, "", url);
      setMessage("");
    } catch {
      setMessage("No matching registration. Double-check your email and registration ID, or open the link from your verification email.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptTermsAndRequestOtp() {
    setBusy(true);
    setMessage("");
    try {
      const res = await api.requestRegistrationOtp(tournamentSlug, {
        email: form.email.trim(),
        name: form.name.trim(),
        location: form.location.trim(),
        roles: form.roles,
        mmr: Number(form.mmr),
        steamName: form.steamName.trim(),
        steamProfile: form.steamProfile.trim(),
        discordHandle: form.discordHandle.trim(),
        phoneNumber: form.phoneNumber.trim(),
        termsAcceptedAt: new Date().toISOString(),
      });
      if (res.devOtp) setDevOtpHint(String(res.devOtp));
      setShowTerms(false);
      setStep("otp");
    } catch (err) {
      if (err.registrationConflict?.stage) {
        openConflict(err.registrationConflict.stage);
      } else {
        setMessage(err.message || "Could not send verification email.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api.verifyRegistrationOtp(tournamentSlug, {
        email: form.email.trim(),
        otp: otp.trim(),
      });
      setPublicCode(res.publicCode);
      const url = `/register?resume=1&email=${encodeURIComponent(form.email.trim())}&code=${encodeURIComponent(res.publicCode)}`;
      window.history.replaceState({}, "", url);
      setPaymentLookupEmail(form.email.trim());
      setPaymentLookupCode(res.publicCode);
      setStep("payment");
      setOtp("");
    } catch (err) {
      setMessage(err.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function onCompletePayment(e) {
    e.preventDefault();
    if (!paymentScreenshot) {
      setMessage("Upload a payment screenshot.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.completeRegistration(tournamentSlug, {
        email: form.email.trim(),
        publicCode: publicCode.trim(),
        paymentScreenshot,
        notes: paymentNotes.trim(),
      });
      setStep("done");
    } catch (err) {
      setMessage(err.message || "Could not submit payment.");
    } finally {
      setBusy(false);
    }
  }

  if (!registrationAccepting) {
    return (
      <div className="reg-page reg-page--closed">
        <div className="reg-page__shell">
          <div className="reg-page__inner">
            <p className="reg-page__eyebrow">{substitutePoolOpen ? "Roster full" : "Registration closed"}</p>
            <h1 className="reg-page__title">{tournament?.name || SITE_BRAND_LINE}</h1>
            <p className="reg-page__lead">
              {substitutePoolOpen
                ? "Player slots for this season are full. You can still join the substitute pool from your player dashboard."
                : "Registrations have been closed for this season."}
            </p>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {substitutePoolOpen
                ? "Substitutes are considered for open roster spots — no entry fee required. Sign in, link Steam and Discord if you have not already, then open Tournaments in your dashboard."
                : "Thank you for your interest — season updates and future registrations will be posted in our Discord community."}
            </p>
            {message ? <p className="reg-page__alert" role="alert">{message}</p> : null}
            <div className="mt-10 flex flex-col items-stretch gap-4 sm:items-center">
              {substitutePoolOpen ? (
                <>
                  <Link to="/login" className={`${REGISTRATION_DISCORD_BTN_CLASS} reg-page__cta w-full sm:w-auto`}>
                    Sign in to join substitute pool
                  </Link>
                  <Link to="/dashboard/tournaments" className="text-sm font-medium text-secondary underline underline-offset-4">
                    Go to player dashboard → Tournaments
                  </Link>
                </>
              ) : (
                <a className={`${REGISTRATION_DISCORD_BTN_CLASS} reg-page__cta w-full sm:w-auto`} href={discordUrl} target="_blank" rel="noreferrer">
                  Join the Discord server
                </a>
              )}
              <a className="break-all text-center text-sm text-muted-foreground underline underline-offset-4" href={discordUrl} target="_blank" rel="noreferrer">
                {discordUrl}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepLabel =
    regTab === "payment" && step === "form"
      ? "Complete payment"
      : step === "form"
        ? "1. Your details"
        : step === "otp"
          ? "2. Email verification"
          : step === "payment"
            ? "3. Payment"
            : "Submitted";

  const showNewForm = regTab === "new" && step === "form";
  const showPaymentGate = regTab === "payment" && step === "form";
  const showOtp = regTab === "new" && step === "otp";
  const showPayment = step === "payment";
  const showDone = step === "done";
  const showPaymentTabOtpHint = regTab === "payment" && step === "otp";

  const flowStepIndex = registrationFlowStepIndex(step, regTab);

  return (
    <div className="reg-page">
      <div className="reg-page__shell">
        <div className="reg-page__inner">
      <RegistrationTermsModal
        open={showTerms}
        busy={busy}
        onClose={() => setShowTerms(false)}
        onAccept={acceptTermsAndRequestOtp}
        rulebook={rulebook}
        discordUrl={discordUrl}
      />
      <RegistrationConflictModal
        open={showConflictModal}
        stage={conflictStage}
        busy={busy}
        userEmail={form.email.trim()}
        onClose={() => {
          setShowConflictModal(false);
          setConflictStage(null);
        }}
        onGoToPayment={() => {
          setShowConflictModal(false);
          setConflictStage(null);
          setPaymentLookupEmail(form.email.trim());
          setPaymentLookupCode("");
          setRegTab("payment");
        }}
      />
      <PaymentQrModal open={showQrModal} onClose={() => setShowQrModal(false)} src={qrImage} />

      <header className="reg-page__hero">
        <p className="reg-page__eyebrow">Player registration</p>
        <h1 className="reg-page__title">{tournament?.name || SITE_BRAND_LINE}</h1>
        <p className="reg-page__lead">
          Three quick steps: submit your details, verify email, then upload payment proof. Already verified? Jump to Complete payment.
        </p>
        <div className="reg-page__meta">
          <span className="reg-page__chip">{stepLabel}</span>
          {registrationDeadline ? (
            <span className="reg-page__chip">
              Closes {new Date(registrationDeadline).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          ) : null}
        </div>
        <RegistrationFlowSteps activeIndex={flowStepIndex} />
      </header>

      {!resumeLoading ? (
        <div className="reg-page__tabs" role="tablist" aria-label="Registration type">
          <button
            type="button"
            role="tab"
            aria-selected={regTab === "new"}
            className={`reg-page__tab${regTab === "new" ? " is-active" : ""}`}
            onClick={() => setRegTab("new")}
          >
            New registration
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={regTab === "payment"}
            className={`reg-page__tab${regTab === "payment" ? " is-active" : ""}`}
            onClick={() => setRegTab("payment")}
          >
            Complete payment
          </button>
        </div>
      ) : null}

      <div className="reg-page__body">
      {resumeLoading ? <p className="text-sm text-muted-foreground">Checking for a saved registration…</p> : null}
      {message ? <p className="reg-page__alert" role="alert">{message}</p> : null}

      {showPaymentTabOtpHint ? (
        <p className="reg-page__panel text-sm text-muted-foreground">
          Finish entering your <strong className="text-foreground">verification code</strong> on the <strong className="text-foreground">New registration</strong> tab first.
        </p>
      ) : null}

      {step === "done" && !resumeLoading ? (
        <div className="reg-page__panel reg-page__success">
          <p className="reg-page__success-title">Thank you — your registration is under review.</p>
          <p className="text-sm text-muted-foreground">
            We emailed you a confirmation. Admins will verify your payment and approve or reject your registration; you will get another email when the decision is made.
          </p>
        </div>
      ) : null}

      {showNewForm && !resumeLoading ? (
        <form className="reg-page__panel" onSubmit={onFormSubmit}>
          <h2 className="reg-page__panel-title">Player details</h2>
          <p className="reg-page__panel-sub">Tell us who you are on Steam and Discord — admins use this for roster verification.</p>
          <div className="reg-page__form-grid">
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm((prev) => ({ ...prev, email: v }))} required />
            <Input label="Name" value={form.name} onChange={(v) => setForm((prev) => ({ ...prev, name: v }))} required />
            <Input label="City / region (optional)" value={form.location} onChange={(v) => setForm((prev) => ({ ...prev, location: v }))} />
            <Input label="Phone number" type="tel" value={form.phoneNumber} onChange={(v) => setForm((prev) => ({ ...prev, phoneNumber: v }))} required />
            <Input label="Discord ID" value={form.discordHandle} onChange={(v) => setForm((prev) => ({ ...prev, discordHandle: v }))} required />
            <p className="reg-page__span-2 text-xs text-muted-foreground -mt-1">
              Format examples: legacy tag <span className="font-mono text-foreground">Name#1234</span>, handle <span className="font-mono text-foreground">my_handle</span>, or numeric ID{" "}
              <span className="font-mono text-foreground">766262940060823456</span>.
            </p>
            <Input label="MMR" type="number" value={form.mmr} onChange={(v) => setForm((prev) => ({ ...prev, mmr: v }))} required max={20000} />
            <Input label="Steam name" value={form.steamName} onChange={(v) => setForm((prev) => ({ ...prev, steamName: v }))} required />
            <Input
              label="Steam profile URL"
              value={form.steamProfile}
              onChange={(v) => setForm((prev) => ({ ...prev, steamProfile: v }))}
              required
              placeholder="https://steamcommunity.com/profiles/76561198912345678"
            />
            <p className="reg-page__span-2 text-xs text-muted-foreground -mt-1">
              Must be a <span className="font-mono text-foreground">steamcommunity.com</span> profile link — paste with or without <span className="font-mono text-foreground">https://</span>.
            </p>
          </div>
          <div className="reg-page__form-grid reg-page__form-grid--roles mt-4">
            <div>
              <p className="text-sm font-medium">Roles</p>
              <p className="text-xs text-muted-foreground">Select one or more positions you can play.</p>
              <div className="reg-page__roles mt-2">
              {roles.map((role) => {
                const selected = form.roles.includes(role);
                const breatheHint = form.roles.length === 0;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`btn btn-sm reg-page__role ${selected ? "btn-primary is-selected" : "btn-outline"} ${breatheHint ? "registration-role-breathe" : ""}`}
                  >
                    {role}
                  </button>
                );
              })}
              </div>
            </div>
            <div className="reg-page__actions">
              <button type="submit" className={`${REGISTRATION_CONTINUE_BTN_CLASS} reg-page__cta`} disabled={registrationGated || busy}>
                {busy ? <RegistrationButtonSpinner /> : null}
                {registrationGated ? "Registration closed" : busy ? "Continuing…" : "Continue to verification"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {showPaymentGate && !resumeLoading ? (
        <form className="reg-page__panel reg-page__panel--accent" onSubmit={onLoadPaymentSession}>
          <h2 className="reg-page__panel-title">Resume payment</h2>
          <p className="reg-page__panel-sub">
            Enter the same email you registered with and your <strong className="text-foreground">registration ID</strong> (for example BPC-012) from your verification email.
          </p>
          <div className="reg-page__form-grid">
            <Input label="Email" type="email" value={paymentLookupEmail} onChange={setPaymentLookupEmail} required />
            <Input label="Registration ID" value={paymentLookupCode} onChange={setPaymentLookupCode} required />
          </div>
          <div className="reg-page__actions">
            <button type="submit" className={`${REGISTRATION_CONTINUE_BTN_CLASS} reg-page__cta`} disabled={busy || registrationGated}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {registrationGated ? "Registration closed" : busy ? "Continuing…" : "Continue to payment"}
            </button>
          </div>
        </form>
      ) : null}

      {showOtp && !resumeLoading ? (
        <form className="reg-page__panel reg-page__panel--accent" onSubmit={onVerifyOtp}>
          <h2 className="reg-page__panel-title">Check your email</h2>
          <p className="reg-page__panel-sub">
            We sent a 6-digit code to <span className="font-medium text-foreground">{form.email}</span>. Check spam, junk, or Promotions if it does not arrive within a few minutes.
          </p>
          {devOtpHint ? (
            <p className="mb-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-sm text-muted-foreground">
              Dev mode: use OTP <span className="font-mono text-foreground">{devOtpHint}</span> (email send skipped).
            </p>
          ) : null}
          <Input label="Verification code" value={otp} onChange={setOtp} required />
          <div className="reg-page__actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setStep("form");
                setOtp("");
                setMessage("");
              }}
            >
              Edit details
            </button>
            <button type="submit" className={`${REGISTRATION_CONTINUE_BTN_CLASS} reg-page__cta`} disabled={busy}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {busy ? "Continuing…" : "Verify & continue"}
            </button>
          </div>
        </form>
      ) : null}

      {showPayment && !resumeLoading ? (
        <form className="reg-page__panel" onSubmit={onCompletePayment}>
          <h2 className="reg-page__panel-title">Upload payment proof</h2>
          <p className="reg-page__panel-sub">Pay the registration fee, then upload a screenshot so admins can approve your spot.</p>

          <div className="reg-page__id-card">
            <p className="reg-page__id-label">Your registration ID</p>
            <p className="reg-page__id-value">{publicCode}</p>
            <p className="text-sm text-muted-foreground">Add this ID in your UPI payment note.</p>
          </div>

          <div className="reg-page__fee mt-4">
            <p className="reg-page__id-label">Registration fee</p>
            <p className="reg-page__fee-amount">{registrationFeeDisplay || "See tournament announcement or Discord"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use ID <span className="font-mono font-medium text-foreground">{publicCode || "BPC-001"}</span> in the payment note so admins can match your transfer.
            </p>
          </div>

          {qrImage ? (
            <div>
              <p className="text-sm font-medium">Scan to pay (QR)</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  className="group shrink-0 rounded-lg border-2 border-border bg-background p-2 shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setShowQrModal(true)}
                  aria-label="Open payment QR in full size"
                >
                  <img
                    src={qrImage}
                    alt=""
                    className="pointer-events-none block h-64 w-64 max-w-[85vw] object-contain sm:h-72 sm:w-72"
                  />
                  <span className="mt-2 block text-center text-xs text-muted-foreground group-hover:text-foreground">Tap to enlarge</span>
                </button>
                <div className="flex flex-col gap-2 pt-1">
                  <button type="button" className="btn btn-outline" onClick={() => setShowQrModal(true)}>
                    Open full-size QR
                  </button>
                  <p className="max-w-xs text-xs text-muted-foreground">Use a larger view if the code is hard to scan from your phone.</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Payment QR will appear here once the tournament publishes one. You can still pay with UPI ID below if available.</p>
          )}

          {paymentUpiId ? (
            <div className="rounded-md border border-border bg-background p-4 text-sm">
              <p className="font-medium text-foreground">UPI ID (manual transfer)</p>
              <p className="mt-1 font-mono text-base text-primary">{paymentUpiId}</p>
              <p className="mt-2 text-xs text-muted-foreground">Use this if you prefer typing a UPI ID instead of scanning the QR.</p>
            </div>
          ) : null}

          <label className="block text-sm">
            Extra transaction / UPI notes (optional)
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Reference or note beyond your registration ID"
            />
          </label>
          <div className="block text-sm font-medium">
            <span className="block">
              Payment screenshot <span className="text-destructive">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">Required — upload proof of payment</span>
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                id="registration-payment-screenshot"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => readPaymentFile(event.target.files?.[0])}
              />
              <label
                htmlFor="registration-payment-screenshot"
                className="btn btn-outline cursor-pointer"
              >
                Choose file
              </label>
              <span className="text-xs text-muted-foreground">
                {paymentScreenshot ? "Image selected — choose again to replace" : "No file chosen yet"}
              </span>
            </div>
          </div>
          {paymentScreenshot ? (
            <img src={paymentScreenshot} alt="Payment screenshot preview" className="max-h-48 rounded-md border border-border object-contain" />
          ) : null}
          <div className="reg-page__actions">
            <button type="submit" className={`${REGISTRATION_CONTINUE_BTN_CLASS} reg-page__cta`} disabled={busy || registrationGated || !paymentScreenshot}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {busy ? "Submitting…" : "Submit registration"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="reg-page__panel mt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Registration questions?{" "}
            <a className="text-secondary underline underline-offset-2 hover:text-foreground" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
              {PUBLIC_CONTACT_EMAIL}
            </a>
          </p>
          <a className={REGISTRATION_DISCORD_BTN_CLASS} href={discordUrl} target="_blank" rel="noreferrer">
            Join Discord
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Discord is mandatory for pairings, rules, and admin messages during the event.
        </p>
      </div>
      </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, max, placeholder }) {
  return (
    <label className="block text-sm">
      {label}
      <input
        required={required}
        type={type}
        max={max}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-input bg-background p-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
