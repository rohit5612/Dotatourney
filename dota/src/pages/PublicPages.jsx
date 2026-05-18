import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineBolt, HiOutlineChatBubbleLeftRight, HiOutlineTrophy } from "react-icons/hi2";
import { FaYoutube } from "react-icons/fa";
import { AppFooter } from "../components/AppFooter";
import { PageLoadingSpinner } from "../components/PageLoadingSpinner";
import { BracketDiagram } from "../components/BracketDiagram";
import {
  augmentGroupedBracketMatches,
  buildStageTabLabels,
  formatMatchRoundSummary,
  getSchedulePhase,
  normalizedBlastBracketTabs,
  SCHEDULE_PHASE_GROUPS,
  SCHEDULE_PHASE_PLAYOFFS,
  SCHEDULE_PHASE_QUALIFIERS,
  stageRoundStructure,
} from "../components/bracket/bracketLayout.js";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import {
  PLAYER_RULES_DISCORD_SECTION_TITLE,
  PLAYER_RULES_REGISTRATION_NOTICE,
  PLAYER_RULES_SECTIONS,
} from "../constants/playerRules.js";
import { COOKIE_CONSENT_KEY, PUBLIC_CONTACT_EMAIL, VALVE_DISCLAIMER } from "../constants/legal.js";
import { roles } from "../constants/tournament";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock.js";
import { api } from "../lib/api";
import { LandingBannerAnnouncement } from "../components/LandingBannerAnnouncement.jsx";
import { StandingsTable } from "../components/StandingsTable.jsx";
import { PrimaryViewTabs, SchedulePhaseTabs } from "../components/navigation/TournamentTabs.jsx";
import { groupScheduleSlotsByDate, isValidScheduleInstant } from "../utils/schedule.js";
import { descriptionContentClassName, rulebookContentClassName, sanitizeDescriptionHtml, sanitizeRulebookHtml } from "../lib/sanitizeRulebookHtml.js";
import { formatAnnouncementPostedAt, parseAnnouncementEntries } from "../lib/announcementEntries.js";

const SITE_BRAND_SHORT = "BPC League";
const SITE_BRAND_FULL = "Bharat Pro Circuit League";
const SITE_BRAND_LINE = `${SITE_BRAND_SHORT} — ${SITE_BRAND_FULL}`;
const tournamentSlug = "bpcl";
const defaultTournamentStart = "2026-05-22T00:00:00+05:30";
const discordInviteUrl = "https://discord.gg/sV2PhYc6A3";
/** Discord brand blurple — used for the registration page CTA only. */
const REGISTRATION_DISCORD_BTN_CLASS =
  "btn inline-flex items-center justify-center gap-2 border-transparent bg-[#5865F2] text-white shadow-md hover:bg-[#4752C4] hover:brightness-100 focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const LANDING_JOURNEY_ICONS = {
  hub: HiOutlineChatBubbleLeftRight,
  blast: HiOutlineBolt,
  trophy: HiOutlineTrophy,
};

/** Primary registration flow CTA — red, full-width on small screens, prominent. */
const REGISTRATION_CONTINUE_BTN_CLASS =
  "btn btn-destructive inline-flex min-h-12 items-center justify-center gap-2 px-8 text-base font-semibold shadow-lg hover:shadow-xl";
const publicPaths = ["/", "/tournament", "/schedule", "/register", "/rules", "/privacy", "/cookies"];

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

function PublicHeader({ path, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const links = [
    ["/", "Home"],
    ["/tournament", "Tournament"],
    ["/schedule", "Bracket & schedule"],
    ["/register", "Register"],
    ["/rules", "Rules"],
  ];

  useBodyScrollLock(mobileMenuOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setMobileMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileMenuOpen]);

  const mobileMenu =
    mobileMenuOpen &&
    createPortal(
      <div
        id="public-mobile-nav"
        className="fixed inset-0 z-100 flex flex-col bg-background md:!hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-4 backdrop-blur-xl pt-[max(1rem,env(safe-area-inset-top))]">
          <span className="min-w-0 font-serif text-lg font-semibold tracking-tight text-foreground">{SITE_BRAND_SHORT}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm shrink-0"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            Close
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {links.map(([href, label]) => (
            <button
              key={href}
              type="button"
              onClick={() => {
                navigate(href);
                setMobileMenuOpen(false);
              }}
              className={`btn min-h-12 w-full justify-start text-left text-base ${path === href ? "btn-primary" : "btn-outline"}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline mt-auto min-h-12 w-full justify-start text-left"
            onClick={() => {
              navigate("/admin");
              setMobileMenuOpen(false);
            }}
          >
            Admin
          </button>
        </nav>
      </div>,
      document.body,
    );

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 transition-all duration-300 ${
        scrolled ? "border-b border-border bg-background/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:py-4">
        <button
          type="button"
          className="group flex min-w-0 max-w-full items-center gap-2 text-left transition-transform duration-300 hover:-translate-y-0.5 sm:gap-3"
          onClick={() => navigate("/")}
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-primary/35 bg-gradient-to-br from-primary/15 to-transparent p-1.5 shadow-sm ring-1 ring-white/[0.04] transition-colors duration-300 group-hover:border-primary/50 sm:size-16">
            <img className="h-full w-full object-contain" src="/bpcl.png" alt={`${SITE_BRAND_SHORT} logo`} />
          </span>
          <span className="min-w-0">
            <h1 className="truncate font-serif text-lg font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary sm:text-xl md:whitespace-normal">
              {SITE_BRAND_SHORT}
            </h1>
            <p className="truncate text-xs leading-snug text-muted-foreground transition-colors duration-300 group-hover:text-foreground/90 sm:whitespace-normal">
              {SITE_BRAND_FULL}
            </p>
          </span>
        </button>
        <nav
          className={`mx-auto flex w-full flex-wrap justify-center gap-1 rounded-2xl border px-2 py-1 transition-all duration-300 sm:w-fit sm:rounded-full ${
            scrolled ? "border-border bg-card/85 shadow-lg backdrop-blur-xl" : "border-transparent bg-transparent"
          } hidden md:flex`}
        >
          {links.map(([href, label]) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={`rounded-full border px-3 py-1 text-xs transition-all duration-300 hover:-translate-y-0.5 sm:text-sm ${
                path === href
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden justify-center md:flex md:justify-end">
          <button
            type="button"
            className={`w-full rounded-full border px-5 py-2 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg sm:w-auto ${
              scrolled ? "border-border/80 bg-card/40" : "border-transparent bg-transparent"
            }`}
            onClick={() => navigate("/admin")}
          >
            Admin
          </button>
        </div>
        <button
          type="button"
          className={`btn btn-sm btn-outline inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 md:!hidden ${scrolled ? "border-border bg-card/85" : ""}`}
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-controls="public-mobile-nav"
          aria-label="Open navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {mobileMenu}
    </header>
  );
}

function EventShell({ path, navigate, children, registerClosedCentered = false }) {
  const isFullBleedBg = path === "/schedule" || path === "/register" || path === "/rules";
  const contentClass = path === "/schedule" ? "mx-auto max-w-7xl space-y-6 px-4 pb-10 pt-28" : "mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-28";
  const fullBleedImage =
    path === "/schedule" ? images.bracketsBg : path === "/register" ? images.registerBg : path === "/rules" ? images.generalRulesBg : null;
  const fullBleedGradientClass =
    path === "/schedule"
      ? "bg-gradient-to-br from-background/88 via-background/80 to-background/72"
      : path === "/register"
        ? "bg-gradient-to-b from-background/86 via-background/78 to-background/84"
        : "bg-gradient-to-br from-background/87 via-background/78 to-background/80";

  const footerFullBleedStyling = isFullBleedBg || registerClosedCentered;
  const sectionClassName = registerClosedCentered
    ? "relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-24 sm:pt-28"
    : path === "/"
      ? "space-y-20"
      : `${contentClass} relative z-10`;

  return (
    <main
      className={`min-h-screen text-foreground ${isFullBleedBg ? "" : "bg-background"} ${registerClosedCentered ? "flex flex-col" : ""}`}
    >
      {isFullBleedBg && fullBleedImage ? (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          <img alt="" className="h-full w-full object-cover" src={fullBleedImage} />
          <div className={`absolute inset-0 ${fullBleedGradientClass}`} />
        </div>
      ) : null}
      <PublicHeader path={path} navigate={navigate} />
      <section className={sectionClassName}>
        {registerClosedCentered ? (
          <div className="flex min-h-[calc(100dvh-14rem)] flex-1 flex-col items-center justify-center py-10 sm:min-h-[calc(100dvh-12rem)] sm:py-16 md:py-20">
            {children}
          </div>
        ) : (
          children
        )}
      </section>
      <div className={`relative z-10 ${footerFullBleedStyling ? "mt-auto border-t border-border/60 bg-background/95 backdrop-blur-sm" : ""}`}>
        <AppFooter navigate={navigate} />
      </div>
      <CookieConsentBanner navigate={navigate} />
      <ScrollToTopButton />
    </main>
  );
}

export function PublicApp({ path, navigate }) {
  const [event, setEvent] = useState(null);
  const [message, setMessage] = useState("");
  const [publicBootstrapDone, setPublicBootstrapDone] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getPublicTournament(tournamentSlug)
      .then((payload) => {
        if (active) setEvent(payload);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setPublicBootstrapDone(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

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
      <EventShell path={path} navigate={navigate} registerClosedCentered={registerClosedCentered}>
        <RegistrationPage event={event} message={message} setMessage={setMessage} />
      </EventShell>
    );
  }

  if (path === "/rules") {
    const rulesDiscordUrl = event?.tournament?.discord_url || discordInviteUrl;
    return (
      <EventShell path={path} navigate={navigate}>
        <GeneralRulesPage discordUrl={rulesDiscordUrl} />
      </EventShell>
    );
  }

  if (path === "/privacy") {
    return (
      <EventShell path={path} navigate={navigate}>
        <PrivacyPolicyPage />
      </EventShell>
    );
  }

  if (path === "/cookies") {
    return (
      <EventShell path={path} navigate={navigate}>
        <CookiePolicyPage />
      </EventShell>
    );
  }

  if (path === "/schedule") {
    return (
      <EventShell path={path} navigate={navigate}>
        <PublicSchedule event={event} message={message} />
      </EventShell>
    );
  }

  if (path === "/tournament") {
    return (
      <EventShell path={path} navigate={navigate}>
        <TournamentInfo event={event} message={message} />
      </EventShell>
    );
  }

  return (
    <EventShell path={path} navigate={navigate}>
      <LandingPage event={event} navigate={navigate} message={message} />
    </EventShell>
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
      className="absolute inset-0 h-full w-full object-cover"
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

function LandingPage({ event, navigate, message }) {
  const tournament = event?.tournament;
  const discordUrl = tournament?.discord_url || discordInviteUrl;
  const formatLabel = `${getFormatName(tournament?.format)} ${tournament?.team_count || "TBA"} Teams`;

  function scrollToExplore() {
    document.getElementById("landing-explore")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <LandingBannerAnnouncement tournament={tournament} />
      {message ? <p className="mx-auto mt-4 max-w-6xl rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-24 md:py-16">
        <LandingPageHeroVideo />
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_75%_at_50%_-10%,rgba(233,168,74,0.2),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_95%_45%,rgba(94,234,212,0.1),transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06060a] via-[#06060a]/75 to-[#06060a]/20" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-8 text-center">
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary sm:text-xs sm:tracking-[0.34em]">
              A Dota 2 community tournament
            </p>
            <h2 className="wrap-break-word px-1 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              {SITE_BRAND_FULL}
            </h2>
            <p className="mx-auto max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:max-w-2xl sm:text-lg md:text-xl md:leading-relaxed">
              Assemble your roster, sharpen your strats, and compete in a high-stakes tournament format.
            </p>
            {event != null ? (
              <div className="flex justify-center pt-1">
                <ApprovedRegistrationsHero count={event.approvedRegistrationCount} />
              </div>
            ) : null}
            <p className="mx-auto max-w-lg border-t border-border/60 pt-3 text-pretty text-[9px] leading-snug text-muted-foreground/90 sm:text-[10px]">
              {VALVE_DISCLAIMER}
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-primary/25 bg-[#08080f]/90 px-6 py-5 shadow-2xl backdrop-blur-md ring-1 ring-white/[0.06] sm:px-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Prize pool</p>
            <AnimatedPrizePool value={tournament?.prize_pool || "TBA"} />
          </div>
          <div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <button type="button" className="btn btn-primary w-full px-6 py-3 text-base shadow-lg sm:w-auto" onClick={() => navigate("/register")}>
              Register now
            </button>
            <a className="btn btn-outline w-full px-6 py-3 text-base sm:w-auto" href={discordUrl} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>
        <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 sm:bottom-8">
          <button
            type="button"
            onClick={scrollToExplore}
            className="group flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:text-[11px] sm:tracking-[0.24em]"
            aria-label="Scroll to explore tournament details"
          >
            <span>Scroll to explore</span>
            <svg
              className="size-5 text-secondary motion-safe:animate-bounce group-hover:text-secondary sm:size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </section>

      <RevealSection>
        <section id="landing-explore" className="mx-auto max-w-6xl scroll-mt-20 space-y-4 px-4">
          <div className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-card/95 p-5 text-center shadow-xl backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tournament starts</p>
            <p className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground">{formatDate(tournament?.start_date || defaultTournamentStart)}</p>
          </div>
          <div className="flex justify-center">
            <CountdownTimer targetDate={tournament?.start_date || defaultTournamentStart} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Dates" value={`${formatDate(tournament?.start_date)} - ${formatDate(tournament?.end_date)}`} />
            <Metric label="Format" value={formatLabel} />
            <Metric label="Entry fee" value={tournament?.entry_fee || "TBA"} />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-wider text-secondary">
              <span>Overview</span>
              <span>⚔️</span>
            </div>
            <h3 className="font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{tournament?.name || SITE_BRAND_LINE}</h3>
            <TournamentDescriptionProse
              description={tournament?.description}
              className="mt-3 leading-relaxed text-muted-foreground"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <img
              src={images.overviewCard}
              alt="Tournament overview"
              className="h-64 w-full object-cover opacity-80 lg:h-full lg:min-h-64"
            />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 z-0 min-h-full" aria-hidden="true">
            <img
              src={images.journeySectionBg}
              alt=""
              className="h-full min-h-[28rem] w-full object-cover sm:min-h-[32rem]"
            />
            <div className="absolute inset-0 bg-background/80 dark:bg-background/75" />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/65 to-background dark:from-background dark:via-background/55 dark:to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_30%,rgba(180,83,9,0.08),transparent_55%)] dark:bg-[radial-gradient(ellipse_90%_60%_at_50%_30%,rgba(233,168,74,0.07),transparent_52%)]" />
          </div>
          <section className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:py-16" aria-labelledby="landing-journey-heading">
            <div className="mb-10 text-center md:mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary sm:tracking-[0.28em]">The path</p>
              <h2
                id="landing-journey-heading"
                className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl"
              >
                Registration to victory
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                Three steps — hub, competitive shape, then closing out your series.
              </p>
            </div>
            <div className="mx-auto max-w-5xl space-y-12 md:space-y-16 lg:space-y-20">
            {getLandingJourneySteps(tournament).map((item, i) => {
              const JourneyIcon = LANDING_JOURNEY_ICONS[item.icon];
              return (
              <div key={item.kicker} className="flex w-full">
                <article
                  style={{ animationDelay: `${i * 0.85}s` }}
                  className={`landing-journey-card w-full max-w-full rounded-3xl border-2 border-primary/20 bg-card/90 p-8 shadow-2xl backdrop-blur-md ring-1 ring-white/[0.05] dark:ring-white/[0.08] md:p-10 lg:max-w-3xl lg:p-12 ${
                    i % 2 === 0 ? "mr-auto" : "ml-auto"
                  }`}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                    <div
                      className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-background/80 shadow-inner sm:size-16"
                      aria-hidden
                    >
                      {JourneyIcon ? (
                        <JourneyIcon className={`size-7 sm:size-8 ${item.iconClassName}`} strokeWidth={1.75} />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-semibold tabular-nums tracking-[0.35em] text-primary md:text-xs">{item.kicker}</p>
                      <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{item.title}</h3>
                      <p className="mt-3 text-pretty text-base font-medium leading-snug text-foreground/90 md:text-lg">{item.summary}</p>
                      <ul className="mt-5 space-y-2.5 border-t border-border/60 pt-5 md:mt-6 md:space-y-3 md:pt-6">
                        {item.bullets.map((line, bi) => (
                          <li
                            key={`${item.kicker}-${bi}`}
                            className="flex gap-3 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed"
                          >
                            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-secondary md:mt-3" aria-hidden />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              </div>
              );
            })}
          </div>
        </section>
        </div>
      </RevealSection>

      <RevealSection>
        <section
          id="landing-tournament-rulebook"
          className="relative flex min-h-screen scroll-mt-28 items-center overflow-hidden py-16 md:py-20"
        >
          <div className="absolute inset-0">
            <img
              src={images.rulebookBg}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(233,168,74,0.14),transparent_62%)]" />
          </div>
          <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] w-full items-stretch px-4 md:px-8">
            <div className="mx-auto flex w-full flex-col rounded-2xl border border-border bg-card/70 p-5 shadow-2xl backdrop-blur sm:p-8 md:w-[80vw] md:p-10">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs uppercase tracking-wider text-secondary">
                <span>{SITE_BRAND_SHORT} rule book</span>
                <span>📜</span>
              </div>
              <h3 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">Rules — {SITE_BRAND_FULL}</h3>
              {tournament?.rulebook?.trim() ? (
                <div
                  className={`${rulebookContentClassName} mt-5 flex-1 overflow-y-auto pr-1 text-sm leading-7 text-muted-foreground sm:text-base md:text-lg md:leading-8`}
                  dangerouslySetInnerHTML={{ __html: sanitizeRulebookHtml(tournament.rulebook) }}
                />
              ) : (
                <p className="mt-5 flex-1 overflow-y-auto pr-1 text-sm leading-7 text-muted-foreground sm:text-base md:text-lg md:leading-8">
                  Rules will be published here before the tournament starts.
                </p>
              )}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mb-3 text-3xl">💬</div>
            <h3 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Join our Discord</h3>
            <p className="mx-auto mt-2 max-w-2xl leading-relaxed text-muted-foreground">
              Match-day communication, payment confirmation, announcements, and support happen in our Discord server.
            </p>
            <a className="btn btn-primary mt-6 px-6 py-3" href={discordUrl} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </section>
      </RevealSection>
    </>
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

/** Live-ish approved player count from the public tournament payload (`approvedRegistrationCount`). */
function ApprovedRegistrationsHero({ count }) {
  const n = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const playerLabel = n === 1 ? "player" : "players";
  return (
    <div
      className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-accent/35 bg-[#06060f]/88 px-4 py-2 text-left text-sm shadow-lg backdrop-blur-md ring-1 ring-white/[0.06]"
      role="status"
      aria-live="polite"
      aria-label={`${n} registered ${playerLabel} and counting`}
    >
      <span className="hero-approved-dot shrink-0" aria-hidden />
      <span className="min-w-0 leading-snug text-muted-foreground">
        <span className="font-semibold tabular-nums text-accent">{n}</span>  {playerLabel} registered and ready to play!
      </span>
    </div>
  );
}

function AnimatedPrizePool({ value }) {
  const parsed = useMemo(() => parsePrizePool(value), [value]);
  const [displayValue, setDisplayValue] = useState(0);

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
    return <p className="mt-2 font-serif text-3xl font-semibold tabular-nums tracking-tight text-primary sm:text-4xl">{value || "TBA"}</p>;
  }

  return (
    <p className="mt-2 font-serif text-3xl font-semibold tabular-nums tracking-tight text-primary sm:text-4xl">
      {parsed.prefix}
      {formatNumber(displayValue)}
      {parsed.suffix}
    </p>
  );
}

function CountdownTimer({ targetDate }) {
  const targetTime = useMemo(() => new Date(targetDate || defaultTournamentStart).getTime(), [targetDate]);
  const [remaining, setRemaining] = useState(() => Math.max(0, targetTime - Date.now()));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemaining(Math.max(0, targetTime - Date.now()));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [targetTime]);

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card/45 p-4 shadow-2xl backdrop-blur">
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <CountdownUnit label="Days" value={days} />
        <CountdownUnit label="Hours" value={hours} />
        <CountdownUnit label="Minutes" value={minutes} />
        <CountdownUnit label="Seconds" value={seconds} />
      </div>
    </div>
  );
}

function CountdownUnit({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="font-serif text-2xl font-semibold tabular-nums tracking-tight text-primary sm:text-3xl">{String(value).padStart(2, "0")}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</div>
    </div>
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur-md sm:p-8">
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

function MeetTheTeams({ teams }) {
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER)),
    [teams],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur-md sm:p-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Competing squads</p>
          <h3 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Meet the Teams</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The rosters battling for the crown — captains marked with <span className="font-semibold text-foreground">(C)</span>.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {sortedTeams.map((team) => {
            const roster = team.players?.length ? team.players : [{ name: "Roster TBA", roles: [] }];
            const logo = team.logoUrl || team.logo_url || "";
            const initials = (team.abbr || team.name || "?")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 3)
              .toUpperCase();
            return (
              <article key={team.id || team.name} className="meet-team-card overflow-hidden rounded-2xl border border-border bg-background/95 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-7">
                  <div className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-inner sm:mx-0 sm:h-36 sm:w-36">
                    {logo ? (
                      <img src={logo} alt="" className="h-full w-full object-contain p-3" />
                    ) : (
                      <span className="font-serif text-3xl font-bold tracking-wide text-primary/80">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {team.seed ? (
                        <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Seed {team.seed}
                        </span>
                      ) : null}
                      {team.abbr ? (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {team.abbr}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{team.name}</h4>
                    <ul className="mt-5 space-y-2.5">
                      {roster.map((player) => {
                        const roleText = Array.isArray(player.roles) ? player.roles.join(" · ") : player.role || "Player";
                        const isCaptain = Boolean(player.isCaptain);
                        return (
                          <li
                            key={player.id || player.name}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/70 px-3.5 py-2.5 text-sm"
                          >
                            <span className="font-medium text-foreground">
                              {player.name}
                              {isCaptain ? <span className="ml-1.5 font-semibold text-primary">(C)</span> : null}
                            </span>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">{roleText}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
  );
}

function TournamentInfo({ event, message }) {
  const tournament = event?.tournament;
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
  const tournamentMode = tournament?.visibility_mode !== "demo";
  const teams = event?.teams || [];
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
          <div className="rounded-xl border border-primary/20 bg-card/80 p-4 shadow-lg backdrop-blur ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tournament starts</p>
            <p className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">{formatDate(tournament?.start_date || defaultTournamentStart)}</p>
            <div className="mt-4">
              <CountdownTimer targetDate={tournament?.start_date || defaultTournamentStart} />
            </div>
          </div>
        </div>
      </section>

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="pointer-events-none absolute inset-0 z-0 min-h-full" aria-hidden="true">
          <img alt="" className="h-full w-full min-h-full object-cover" src={images.tournamentPageBg} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/88 via-background/76 to-background/86" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 pb-2">
          <section className="rounded-xl border border-border bg-card/85 p-4 shadow-lg backdrop-blur-md">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Format" value={`${getFormatName(tournament?.format)} ${tournament?.team_count || "TBA"} Teams`} />
              <Metric label="Registration fee" value={tournament?.entry_fee || "TBA"} />
              <Metric label="Prize pool" value={tournament?.prize_pool || "TBA"} />
              <Metric label="Registration cutoff (display)" value={formatDate(tournament?.registration_deadline)} />
            </div>
          </section>

          <section className="announcement-panel relative overflow-hidden rounded-2xl border-2 border-primary/45 bg-card/90 p-5 shadow-2xl shadow-primary/10 ring-1 ring-primary/15 backdrop-blur-md sm:p-8">
            <div
              className="announcement-panel-accent pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#c9782e] via-secondary to-[#1a6b5c]"
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

          {tournamentMode && teams.length ? <MeetTheTeams teams={teams} /> : null}
        </div>
      </div>
    </div>
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
    <div ref={ref} className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      {children}
    </div>
  );
}

function PublicScheduleMatchCard({ slot, match, stageLabel, roundStructureAll }) {
  const isLive = slot.status === "live";
  const streamUrl = typeof slot.streamUrl === "string" ? slot.streamUrl.trim() : "";
  const start = new Date(slot.startAt);
  const timeLabel = Number.isNaN(start.getTime())
    ? ""
    : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? <span className="schedule-live-dot" title="Live now" aria-hidden /> : null}
          <span className={`font-medium ${isLive ? "text-foreground" : ""}`}>
            {match ? `${match.team1} vs ${match.team2}` : slot.matchId}
          </span>
        </div>
        <div className="text-muted-foreground">
          {timeLabel ? `${timeLabel} — ` : ""}
          {slot.stream}
        </div>
        {!isLive && slot.status !== "upcoming" ? <div className="capitalize text-secondary">{slot.status}</div> : null}
        {streamUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <FaYoutube className="h-5 w-5 shrink-0 text-[#ff0000]" aria-hidden />
            <span className="text-muted-foreground">Watch live here:</span>
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {streamUrl}
            </a>
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-right">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Bracket</div>
        <div className="font-medium">{stageLabel}</div>
        <div className="text-xs text-muted-foreground">
          {match ? formatMatchRoundSummary(match, roundStructureAll) : "—"}
        </div>
      </div>
    </div>
  );
}

function PublicScheduleStatusSection({ title, subtitle, children, show = true }) {
  if (!show) return null;
  return (
    <section className="rounded-lg border border-border bg-background/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="border-b border-border pb-3">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function PublicSchedule({ event, message }) {
  const [viewMode, setViewMode] = useState("bracket");
  const [phaseTab, setPhaseTab] = useState(SCHEDULE_PHASE_GROUPS);

  const roundStructureAll = useMemo(() => stageRoundStructure(event?.matches || []), [event?.matches]);
  const { groupedMatches, stageTabs, stageLabels } = useMemo(() => {
    const groups = {};
    (event?.matches || []).forEach((match) => {
      if (!groups[match.stageKey]) groups[match.stageKey] = [];
      groups[match.stageKey].push(match);
    });
    const augmented = augmentGroupedBracketMatches(groups);
    const raw = event?.tabs?.length ? event.tabs : Object.keys(augmented).map((id) => ({ id, label: id }));
    const tabs = normalizedBlastBracketTabs(event?.tournament?.format || "", raw);
    const labels = buildStageTabLabels(event?.tournament?.format || "", tabs);
    return { groupedMatches: augmented, stageTabs: tabs, stageLabels: labels };
  }, [event]);

  const phaseNavTabs = useMemo(
    () => [
      { id: SCHEDULE_PHASE_GROUPS, label: "Groups" },
      { id: SCHEDULE_PHASE_QUALIFIERS, label: "Last chance & play-ins" },
      { id: SCHEDULE_PHASE_PLAYOFFS, label: "Playoffs" },
    ],
    [],
  );

  const phaseSlots = useMemo(() => {
    return [...(event?.schedule || [])]
      .filter((slot) => isValidScheduleInstant(slot.startAt))
      .filter((slot) => {
        const match = event?.matches?.find((m) => m.id === slot.matchId);
        if (!match) return false;
        return getSchedulePhase(match.stageKey) === phaseTab;
      });
  }, [event?.schedule, event?.matches, phaseTab]);

  const scheduleByStatus = useMemo(() => {
    const byTime = (a, b) => new Date(a.startAt) - new Date(b.startAt);
    const live = phaseSlots.filter((s) => s.status === "live").sort(byTime);
    const upcoming = phaseSlots.filter((s) => s.status === "upcoming").sort(byTime);
    const finished = phaseSlots.filter((s) => s.status === "finished").sort(byTime);
    return {
      live,
      upcomingByDate: groupScheduleSlotsByDate(upcoming),
      finished,
    };
  }, [phaseSlots]);

  const hasScheduleContent =
    scheduleByStatus.live.length > 0 ||
    scheduleByStatus.upcomingByDate.length > 0 ||
    scheduleByStatus.finished.length > 0;

  function renderScheduleSlot(slot) {
    const match = event?.matches?.find((entry) => entry.id === slot.matchId);
    const stageLabel = stageLabels[match?.stageKey] || match?.stageKey || "Bracket";
    return (
      <PublicScheduleMatchCard
        key={slot.id}
        slot={slot}
        match={match}
        stageLabel={stageLabel}
        roundStructureAll={roundStructureAll}
      />
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card/90 p-2 text-sm text-secondary shadow-sm backdrop-blur-sm">{message}</p> : null}
      <section className="rounded-lg border border-border bg-card/85 p-4 shadow-xl backdrop-blur-md sm:p-6">
        <h2 className="font-serif text-2xl text-foreground">Bracket & Schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {event?.tournament?.visibility_mode === "demo"
            ? "Demo mode is active. Brackets are previews and real team names unlock when tournament mode begins."
            : "Live tournament mode is active. Match names, scores, and standings reflect the current tournament state."}
        </p>
      </section>
      <PrimaryViewTabs
        ariaLabel="Bracket or schedule view"
        value={viewMode}
        onChange={setViewMode}
        tabs={[
          { id: "bracket", label: "Bracket" },
          { id: "schedule", label: "Schedule" },
        ]}
      />

      {viewMode === "bracket" ? (
        <>
          {(event?.groupedStandings || []).length ? (
            <section className="space-y-3 rounded-lg border border-border bg-card/85 p-4 shadow-lg backdrop-blur-md">
              <h3 className="font-serif text-lg">Group standings</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {event.groupedStandings.map((group) => (
                  <StandingsTable key={group.id} title={group.label} rows={group.rows} />
                ))}
              </div>
            </section>
          ) : null}
          <div className="space-y-6">
          {stageTabs.map((tab) => {
            const matches = groupedMatches[tab.id] || [];
            if (!matches.length) return null;
            return (
              <section key={tab.id} className="space-y-3 rounded-lg border border-border bg-card/85 p-4 shadow-lg backdrop-blur-md">
                <div>
                  <h3 className="font-serif text-xl">{tab.label}</h3>
                  <p className="text-sm text-muted-foreground">Bracket progression for this stage.</p>
                </div>
                <BracketDiagram
                  matches={matches}
                  blastSeedMatches={event?.matches ?? []}
                  playoffFeedMatches={
                    tab.id === "blast-qualifiers"
                      ? (groupedMatches["blast-playoffs"] || []).filter((m) => (m.roundIndex ?? 0) === 0)
                      : undefined
                  }
                />
              </section>
            );
          })}
          </div>
        </>
      ) : (
        <>
          <SchedulePhaseTabs value={phaseTab} onChange={setPhaseTab} tabs={phaseNavTabs} />
          <div className="flex flex-col gap-8">
            <PublicScheduleStatusSection
              title="Live"
              subtitle="Matches on air right now."
              show={scheduleByStatus.live.length > 0}
            >
              {scheduleByStatus.live.map(renderScheduleSlot)}
            </PublicScheduleStatusSection>

            <PublicScheduleStatusSection
              title="Upcoming"
              subtitle="Grouped by match day."
              show={scheduleByStatus.upcomingByDate.length > 0}
            >
              <div className="space-y-6">
                {scheduleByStatus.upcomingByDate.map((day) => (
                  <div key={day.dateKey} className="space-y-3">
                    <h4 className="schedule-day-heading">{day.heading}</h4>
                    <div className="space-y-3">{day.slots.map(renderScheduleSlot)}</div>
                  </div>
                ))}
              </div>
            </PublicScheduleStatusSection>

            <PublicScheduleStatusSection
              title="Finished"
              subtitle="Completed matches in start-time order."
              show={scheduleByStatus.finished.length > 0}
            >
              {scheduleByStatus.finished.map(renderScheduleSlot)}
            </PublicScheduleStatusSection>

            {!hasScheduleContent ? (
              <p className="rounded-lg border border-border bg-background/90 p-4 text-sm text-muted-foreground shadow-sm sm:p-5">
                No scheduled matches for this phase yet.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 text-foreground">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {new Date().getFullYear()}. For {SITE_BRAND_FULL} ({SITE_BRAND_SHORT}) public website and registration.</p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Who we are</h2>
        <p>
          {SITE_BRAND_FULL} operates this site as a community tournament platform. This policy describes how we handle information when you use the public site or register as a player.
        </p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Registration:</strong> When you sign up, we collect the details you submit (such as name, email, contact information, game-related identifiers, and payment proof you choose to upload) to run the tournament and communicate with you.
          </li>
          <li>
            <strong className="text-foreground">Admin access:</strong> Organizers who use the admin panel provide account credentials through that flow; those details are handled separately for access control.
          </li>
          <li>
            <strong className="text-foreground">Technical data:</strong> Like most websites, our host and infrastructure may process standard technical data (for example IP address, browser type, timestamps) in server or security logs.
          </li>
        </ul>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">How we use information</h2>
        <p>We use registration and contact data to verify participants, coordinate the event, send transactional emails (such as OTPs and status updates), and meet legitimate tournament operations. We do not sell your personal information.</p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Storage and retention</h2>
        <p>Data is stored for as long as needed to run the tournament and for any reasonable archival period the organizers require. Archived or deleted registrations may be handled according to admin workflow on the platform.</p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Third parties</h2>
        <p>
          We may link to external services (for example Discord). Their use is governed by their own policies. Email delivery relies on your tournament organizer&apos;s configured mail provider.
        </p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Your choices</h2>
        <p>
          You may contact tournament organizers via the channels they publish (for example Discord) to ask about your registration data. Essential cookies and storage are described in the{" "}
          <a className="text-secondary underline underline-offset-2" href="/cookies">
            Cookie Policy
          </a>
          .
        </p>
      </section>
    </article>
  );
}

function CookiePolicyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 text-foreground">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">How {SITE_BRAND_SHORT} uses cookies and similar technologies on this site.</p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">What we use</h2>
        <p>
          We keep use minimal. Essential functionality may rely on <strong className="text-foreground">browser local storage</strong> (similar to cookies) for things like remembering that you accepted this notice, and for admin sign-in tokens if you use the organizer panel.
        </p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Consent banner</h2>
        <p>
          When you click <strong className="text-foreground">Accept</strong> on the cookie notice, we store a small value in your browser so we do not show the banner again on future visits. You can clear site data in your browser settings to reset this.
        </p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">Analytics and ads</h2>
        <p>This site does not include third-party advertising or analytics cookies by default. If that changes, this policy will be updated.</p>
      </section>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-serif text-xl font-semibold text-foreground">More information</h2>
        <p>
          See our{" "}
          <a className="text-secondary underline underline-offset-2" href="/privacy">
            Privacy Policy
          </a>{" "}
          for how personal data from registration is handled.
        </p>
      </section>
    </article>
  );
}

function GeneralRulesPage({ discordUrl }) {
  const invite = (discordUrl || discordInviteUrl).trim();
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/85 p-4 shadow-xl backdrop-blur-md sm:p-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-secondary">{SITE_BRAND_SHORT}</p>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground">General Rules & Player Conduct</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          These rules cover player behavior, eligibility, communication, and fair-play expectations for every {SITE_BRAND_FULL} event.
        </p>
        <p className="mt-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm leading-relaxed text-foreground/95">
          {PLAYER_RULES_REGISTRATION_NOTICE}
        </p>
      </div>
      {PLAYER_RULES_SECTIONS.map(([title, body]) => (
        <div key={title} className="rounded-lg border border-border bg-background/90 p-4 shadow-sm backdrop-blur-sm">
          <h3 className="font-serif text-lg font-medium text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
          {title === PLAYER_RULES_DISCORD_SECTION_TITLE && invite ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground">
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
    </section>
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

function RegistrationPage({ event, message, setMessage }) {
  const tournament = event?.tournament;
  const discordUrl = tournament?.discord_url || discordInviteUrl;
  const registrationDeadline = tournament?.registration_deadline;
  const registrationAccepting = tournament?.registrations_open === true;
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
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl border border-border/80 bg-black/45 p-6 shadow-2xl backdrop-blur-md sm:p-10 dark:bg-black/50">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary sm:text-xs">Registration closed</p>
            <h1 className="mt-4 wrap-break-word font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {tournament?.name || SITE_BRAND_LINE}
            </h1>
            <p className="mt-8 text-pretty text-lg font-semibold leading-snug text-foreground sm:text-xl md:text-2xl">
              Registrations have been closed for this season because our intended player slots have been filled.
            </p>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Thank you for your interest — season updates and future registrations will be posted in our Discord community.
            </p>
            <p className="mt-6 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              If you used a link from your email to continue registration or open the Complete payment flow, that route is unavailable while sign-ups are
              closed. For questions about an existing signup, reach out on Discord.
            </p>
            {message ? (
              <p
                className="mx-auto mt-8 max-w-md rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/15"
                role="alert"
              >
                {message}
              </p>
            ) : null}
            <div className="mt-12 flex flex-col items-stretch gap-5 sm:items-center">
              <a
                className={`${REGISTRATION_DISCORD_BTN_CLASS} w-full justify-center rounded-xl px-8 py-4 text-lg font-semibold shadow-lg sm:w-auto sm:min-w-[min(92vw,22rem)] md:py-5 md:text-xl`}
                href={discordUrl}
                target="_blank"
                rel="noreferrer"
              >
                Join the Discord server
              </a>
              <a
                className="break-all text-center text-sm font-medium text-secondary underline underline-offset-4 transition hover:text-foreground sm:text-base"
                href={discordUrl}
                target="_blank"
                rel="noreferrer"
              >
                {discordUrl}
              </a>
            </div>
            <p className="mt-12 text-sm text-muted-foreground">
              Email{" "}
              <a className="text-secondary underline underline-offset-2 hover:text-foreground" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                {PUBLIC_CONTACT_EMAIL}
              </a>{" "}
              for other inquiries.
            </p>
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

  return (
    <div className="space-y-4 rounded-lg border border-border/40 bg-card/58 p-4 shadow-sm backdrop-blur-xl sm:p-5 dark:border-border/35 dark:bg-card/52">
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

      <div>
        <h2 className="font-serif text-2xl">Register for {tournament?.name || SITE_BRAND_LINE}</h2>
        <p className="text-sm text-muted-foreground">
          Multi-step registration: verify your email, receive your tournament ID, then upload payment proof for admin review. Already verified and only need to pay? Use the Complete payment tab.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-secondary">{stepLabel}</p>
        {registrationDeadline ? (
          <p className="mt-2 rounded-md border border-border bg-background p-2 text-sm text-secondary">
            Registrations will be closed on {new Date(registrationDeadline).toLocaleString()}. Follow Discord for any updates or extensions.
          </p>
        ) : null}
      </div>

      {!resumeLoading ? (
        <div
          className="inline-flex max-w-full flex-wrap gap-2 rounded-xl border-2 border-foreground/12 bg-muted/70 p-1.5 shadow-sm dark:border-border dark:bg-muted/50"
          role="tablist"
          aria-label="Registration type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={regTab === "new"}
            className={`shrink-0 rounded-lg px-3 py-2 text-center text-xs font-semibold tracking-tight whitespace-nowrap transition sm:px-4 sm:text-sm ${
              regTab === "new"
                ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                : "border-2 border-border/80 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-background dark:border-border dark:bg-card/90 dark:hover:border-primary/35"
            }`}
            onClick={() => setRegTab("new")}
          >
            New registration
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={regTab === "payment"}
            className={`shrink-0 rounded-lg px-3 py-2 text-center text-xs font-semibold tracking-tight whitespace-nowrap transition sm:px-4 sm:text-sm ${
              regTab === "payment"
                ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                : "border-2 border-border/80 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-background dark:border-border dark:bg-card/90 dark:hover:border-primary/35"
            }`}
            onClick={() => setRegTab("payment")}
          >
            Complete payment
          </button>
        </div>
      ) : null}

      {resumeLoading ? <p className="text-sm text-muted-foreground">Checking for a saved registration…</p> : null}
      {message ? (
        <p
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/15"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {showPaymentTabOtpHint ? (
        <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          Finish entering your <strong className="text-foreground">verification code</strong> on the <strong className="text-foreground">New registration</strong> tab first.
        </p>
      ) : null}

      {step === "done" && !resumeLoading ? (
        <div className="space-y-2 rounded-md border border-border bg-background p-4 text-sm">
          <p className="font-medium text-foreground">Thank you — your registration is under review.</p>
          <p className="text-muted-foreground">
            We emailed you a confirmation. Admins will verify your payment and approve or reject your registration; you will get another email when the decision is made.
          </p>
        </div>
      ) : null}

      {showNewForm && !resumeLoading ? (
        <form className="space-y-4" onSubmit={onFormSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm((prev) => ({ ...prev, email: v }))} required />
            <Input label="Name" value={form.name} onChange={(v) => setForm((prev) => ({ ...prev, name: v }))} required />
            <Input label="City / region (optional)" value={form.location} onChange={(v) => setForm((prev) => ({ ...prev, location: v }))} />
            <Input label="Phone number" type="tel" value={form.phoneNumber} onChange={(v) => setForm((prev) => ({ ...prev, phoneNumber: v }))} required />
            <Input label="Discord ID" value={form.discordHandle} onChange={(v) => setForm((prev) => ({ ...prev, discordHandle: v }))} required />
            <p className="text-xs text-muted-foreground md:col-span-2 -mt-2">
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
            <p className="text-xs text-muted-foreground md:col-span-2 -mt-2">
              Must be a <span className="font-mono text-foreground">steamcommunity.com</span> profile link, e.g.{" "}
              <span className="font-mono text-foreground">https://steamcommunity.com/profiles/76561198912345678</span> or{" "}
              <span className="font-mono text-foreground">https://steamcommunity.com/id/yourname</span> — you can paste with or
              without <span className="font-mono text-foreground">https://</span>.
            </p>
          </div>
          <div>
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
              <span className="text-sm font-medium">Roles</span>
              <span className="text-xs leading-snug text-muted-foreground sm:max-w-xl">
                (Select one or more roles to assign to your id.)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const selected = form.roles.includes(role);
                const breatheHint = form.roles.length === 0;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`btn btn-sm ${selected ? "btn-primary" : "btn-outline"} ${breatheHint ? "registration-role-breathe" : ""}`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className={REGISTRATION_CONTINUE_BTN_CLASS} disabled={registrationGated || busy}>
                {busy ? <RegistrationButtonSpinner /> : null}
                {registrationGated ? "Registration closed" : busy ? "Continuing…" : "Continue"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {showPaymentGate && !resumeLoading ? (
        <form className="space-y-4" onSubmit={onLoadPaymentSession}>
          <p className="text-sm text-muted-foreground">
            Enter the same email you registered with and your <strong className="text-foreground">registration ID</strong> (for example BPC-012) from your verification email.
          </p>
          <Input label="Email" type="email" value={paymentLookupEmail} onChange={setPaymentLookupEmail} required />
          <Input label="Registration ID" value={paymentLookupCode} onChange={setPaymentLookupCode} required />
          <div className="flex justify-end">
            <button type="submit" className={REGISTRATION_CONTINUE_BTN_CLASS} disabled={busy || registrationGated}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {registrationGated ? "Registration closed" : busy ? "Continuing…" : "Continue"}
            </button>
          </div>
        </form>
      ) : null}

      {showOtp && !resumeLoading ? (
        <form className="space-y-4" onSubmit={onVerifyOtp}>
          <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
            <p className="font-serif text-xl font-semibold text-foreground sm:text-2xl">Check your email — including Spam</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{form.email}</span>. If you do not see it within a few minutes, look in your{" "}
              <strong className="text-foreground">spam</strong>, <strong className="text-foreground">junk</strong>, or <strong className="text-foreground">Promotions</strong> folder and
              mark the message as “not spam” so future mail arrives in your inbox.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Enter the code below when you have it.</p>
          {devOtpHint ? (
            <p className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-sm text-muted-foreground">
              Dev mode: use OTP <span className="font-mono text-foreground">{devOtpHint}</span> (email send skipped).
            </p>
          ) : null}
          <Input label="Verification code" value={otp} onChange={setOtp} required />
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <button type="submit" className={REGISTRATION_CONTINUE_BTN_CLASS} disabled={busy}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {busy ? "Continuing…" : "Continue"}
            </button>
          </div>
        </form>
      ) : null}

      {showPayment && !resumeLoading ? (
        <form className="space-y-4" onSubmit={onCompletePayment}>
          <div className="rounded-md border border-border bg-background p-4 text-sm">
            <p className="text-xs uppercase tracking-wider text-secondary">Your registration ID</p>
            <p className="mt-1 font-mono text-lg text-primary">{publicCode}</p>
            <p className="mt-2 text-muted-foreground">Keep this ID — you will use it in your UPI payment note.</p>
          </div>

          <div className="rounded-lg border border-primary/35 bg-primary/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Registration fee</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{registrationFeeDisplay || "See tournament announcement or Discord"}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              In your UPI app, add this registration ID in the payment note when you send the fee, using the same format you received (for example{" "}
              <span className="font-mono font-medium text-foreground">{publicCode || "BPC-001"}</span>) so admins can match your payment to your registration.
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
          <div className="flex justify-end">
            <button type="submit" className={REGISTRATION_CONTINUE_BTN_CLASS} disabled={busy || registrationGated || !paymentScreenshot}>
              {busy ? <RegistrationButtonSpinner /> : null}
              {busy ? "Continuing…" : "Continue"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 space-y-4 border-t border-border pt-6">
        <div className="flex justify-end">
          <div className="max-w-md text-right">
            <a className={REGISTRATION_DISCORD_BTN_CLASS} href={discordUrl} target="_blank" rel="noreferrer">
              Join Discord for match updates
            </a>
            <p className="mt-3 rounded-md border-2 border-secondary/60 bg-secondary/20 px-3 py-2 text-left text-sm font-semibold text-foreground sm:text-right">
              Mandatory: join the Discord server to receive pairings, rules, and admin messages for this event.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Registration questions?{" "}
          <a
            className="text-secondary underline underline-offset-2 hover:text-foreground"
            href={`mailto:${PUBLIC_CONTACT_EMAIL}`}
          >
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </p>
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
