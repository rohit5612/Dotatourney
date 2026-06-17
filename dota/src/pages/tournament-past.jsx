/**
 * Archived /tournament page content (saved before maintenance rebuild).
 * Copy back into PublicPages.jsx when the tournament hub is ready again.
 */
import { useEffect, useMemo, useState } from "react";
import { HiOutlineTrophy } from "react-icons/hi2";
import { TournamentStatusSlot } from "../components/TournamentStatusSlot.jsx";
import { TournamentWinnersBlock } from "../components/honors/TournamentWinnersBlock.jsx";
import { SITE_BRAND_LINE, SITE_BRAND_SHORT } from "../constants/siteMeta.js";
import { formatAnnouncementPostedAt, parseAnnouncementEntries } from "../lib/announcementEntries.js";
import {
  descriptionContentClassName,
  rulebookContentClassName,
  sanitizeDescriptionHtml,
  sanitizeRulebookHtml,
} from "../lib/sanitizeRulebookHtml.js";
import { hasPublicHonorsContent } from "../utils/tournamentHonors.js";
import { buildTeamNameLookup } from "../utils/teamPage.js";
import "../styles/tournament-page.css";
import "../styles/tournament-honors.css";

const defaultTournamentStart = "2026-05-22T00:00:00+05:30";

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


function TournamentStatCard({ label, value, accent = false }) {
  return (
    <article className="tournament-stat-card">
      <p className="tournament-stat-card__label">{label}</p>
      <p className={`tournament-stat-card__value${accent ? " tournament-stat-card__value--accent" : ""}`}>{value}</p>
    </article>
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

export function TournamentInfoPast({ event, message, navigate }) {
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