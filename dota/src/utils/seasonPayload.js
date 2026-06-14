import { buildTeamNameLookup } from "./teamPage.js";
import { hasPublicHonorsContent } from "./tournamentHonors.js";
import { normalizeSponsorsConfig } from "./seasonContentSchema.js";

const FORMAT_LABELS = {
  dse: "Double Elimination",
  se: "Single Elimination",
  gsl: "GSL Groups",
  rr: "Round Robin",
  swiss: "Swiss System",
  hybrid: "Group + Playoffs",
  blast: "BLAST-style Groups",
};

import { parseSeasonLabelFromName, buildTournamentFullName, TOURNAMENT_BRAND } from "./tournamentNaming.js";

export function formatMvpLabel(mvp) {
  if (!mvp) return null;
  if (typeof mvp === "string") {
    const trimmed = mvp.trim();
    return trimmed || null;
  }
  if (typeof mvp === "object") {
    const playerName = String(mvp.playerName || "").trim();
    const teamName = String(mvp.teamName || "").trim();
    if (playerName && teamName) return `${playerName} · ${teamName}`;
    return playerName || teamName || null;
  }
  return null;
}

export function formatTrophyPlayers(players) {
  if (!Array.isArray(players) || !players.length) return null;
  const labels = players
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        return String(entry.playerName || entry.name || "").trim();
      }
      return "";
    })
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : null;
}

/** Normalize trophy_engraving — may be a compact engraving or full tournament_honors blob. */
export function normalizeTrophyEngraving(raw, honors) {
  const source = raw && typeof raw === "object" ? raw : {};
  const teamName =
    String(source.teamName || "").trim() ||
    String(honors?.podiumTeams?.[0]?.teamName || "").trim() ||
    String(honors?.champion?.teamName || "").trim() ||
    null;
  const playersLabel = formatTrophyPlayers(source.players);
  const mvpLabel = formatMvpLabel(source.mvp) || formatMvpLabel(honors?.mvp);

  return { teamName, playersLabel, mvpLabel };
}

export function resolveSeasonCardBg(heroMedia, fallbackUrl) {
  const media = heroMedia && typeof heroMedia === "object" ? heroMedia : {};
  const fromMedia = String(media.cardBg || media.card_bg || "").trim();
  if (fromMedia) return fromMedia;
  const fallback = String(fallbackUrl || "").trim();
  return fallback || null;
}

/** Player dashboard + registration — season hub card art/badge from tournament setup. */
export function resolveTournamentCardPresentation(tournament) {
  if (!tournament) {
    return { cardBg: null, badge: null, displayLabel: "Season" };
  }
  const cardBg = resolveSeasonCardBg(
    tournament.heroMedia,
    tournament.seasonCardBg || tournament.season_card_bg,
  );
  const customBadge = compactSeasonBadge(
    tournament.seasonCardBadge || tournament.season_card_badge,
  );
  const label = parseSeasonLabelFromName(tournament.name) || tournament.name || "Season";
  const badge = customBadge || compactSeasonBadge(label) || "S1";
  return {
    cardBg,
    badge,
    displayLabel: label,
  };
}

export function pickFeaturedSeason(seasons = []) {
  if (!seasons.length) return null;
  const sorted = [...seasons].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  return sorted.find((season) => season.status === "active") || sorted[0];
}

export function seasonDisplayLabel(season) {
  const fromName = parseSeasonLabelFromName(season?.name);
  if (fromName) return fromName;
  const number = season?.number;
  return number != null && Number.isFinite(Number(number)) ? `Season ${number}` : "Season";
}

function parseLocalDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function todayLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Resolve card/detail status using DB state + local calendar dates. */
export function resolveSeasonDisplayStatus(season, summary = {}) {
  const dbStatus = String(season?.status || "").toLowerCase();
  if (dbStatus === "concluded") return "concluded";

  const start = parseLocalDateOnly(summary.startDate);
  const end = parseLocalDateOnly(summary.endDate);
  const today = todayLocalDate();

  if (start && start > today) return "upcoming";

  const isLive =
    summary.isPublished ||
    dbStatus === "active" ||
    dbStatus === "published" ||
    String(summary.tournamentStatus || "").toLowerCase() === "published";

  if (isLive) {
    if (end && end < today) return "concluded";
    return "active";
  }

  if (dbStatus === "upcoming") return "upcoming";
  if (dbStatus === "active") return "active";
  if (start && start <= today) return "active";
  return "upcoming";
}

export function resolveSeasonCardStats(displayStatus, summary = {}, championName = null) {
  const champion = championName || summary.championName || null;

  if (displayStatus === "upcoming") {
    const registrationLabel = summary.registrationsOpen ? "Open" : summary.isPublished ? "Soon" : "Not open";
    return [
      {
        label: "Prize pool",
        value: formatSeasonStatValue(summary.prizePool, "TBA"),
        highlight: true,
      },
      {
        label: "Starts",
        value: formatSeasonDate(summary.startDate) || "Dates TBA",
      },
      {
        label: summary.registrationsOpen ? "Registration" : "Teams",
        value: summary.registrationsOpen
          ? registrationLabel
          : summary.teamCount > 0
            ? String(summary.teamCount)
            : "—",
      },
    ];
  }

  if (displayStatus === "active") {
    const matchLabel =
      summary.matchCount > 0
        ? `${summary.completedMatchCount || 0}/${summary.matchCount} played`
        : summary.teamCount > 0
          ? `${summary.teamCount} teams`
          : "—";
    return [
      {
        label: "Prize pool",
        value: formatSeasonStatValue(summary.prizePool, "TBA"),
        highlight: true,
      },
      {
        label: "Live dates",
        value: formatSeasonListDate(summary.startDate, summary.endDate),
      },
      {
        label: summary.playerCount > 0 ? "Players" : "Progress",
        value: summary.playerCount > 0 ? String(summary.playerCount) : matchLabel,
      },
    ];
  }

  return [
    {
      label: "Prize pool",
      value: formatSeasonStatValue(summary.prizePool, "TBA"),
      highlight: true,
    },
    {
      label: "Dates",
      value: formatSeasonListDate(summary.startDate, summary.endDate),
    },
    {
      label: champion ? "Champions" : "Players",
      value: champion
        ? formatSeasonStatValue(champion, "—")
        : summary.playerCount > 0
          ? String(summary.playerCount)
          : "—",
    },
  ];
}

export function resolveSeasonCardTagline(season, summary = {}, championName = null, displayStatus = null) {
  const status = displayStatus || resolveSeasonDisplayStatus(season, summary);
  const champion = championName || summary.championName || null;
  const fromSummary = String(summary?.tagline || "").trim();

  if (status === "concluded" && champion) return `Champions — ${champion}`;
  if (status === "active") {
    if (summary.playerCount > 0) return `${summary.playerCount} players · Live standings and bracket.`;
    if (summary.teamCount > 0) return `${summary.teamCount} teams · Matches in progress.`;
    return "Live season — follow standings, rosters, and bracket.";
  }
  if (status === "upcoming") {
    if (summary.registrationsOpen) return "Registration is open — join the next BPC League season.";
    if (summary.startDate) {
      const startLabel = formatSeasonDate(summary.startDate);
      return startLabel ? `Starts ${startLabel} · Prize pool and format announced.` : "Upcoming BPC League season.";
    }
    return "Upcoming BPC League season.";
  }

  if (fromSummary) return fromSummary;
  if (champion) return `Champions — ${champion}`;
  return "BPC League competitive season archive.";
}

export function resolveSeasonCardActionLabel(displayStatus) {
  if (displayStatus === "active") return "Follow live";
  if (displayStatus === "upcoming") return "View preview";
  return "View archive";
}

export function seasonFullTitle(season) {
  const label = parseSeasonLabelFromName(season?.name);
  if (label) return buildTournamentFullName(label);
  return season?.name || TOURNAMENT_BRAND;
}

function compactSeasonBadge(value) {
  const compact = String(value || "").trim().replace(/\s+/g, "");
  if (!compact) return "";
  return compact.length <= 4 ? compact : compact.slice(0, 4);
}

export function seasonBadgeShort(season) {
  const custom = compactSeasonBadge(season?.tournamentCardBadge);
  if (custom) return custom;

  const label = parseSeasonLabelFromName(season?.name);
  if (label) return compactSeasonBadge(label);
  const number = season?.number;
  return number != null && Number.isFinite(Number(number)) ? `S${number}` : "S";
}

export function formatSeasonStatusUpper(status) {
  const key = String(status || "").toLowerCase();
  if (key === "active") return "Active";
  if (key === "concluded") return "Completed";
  if (key === "upcoming") return "Upcoming";
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : "Season";
}

export function formatSeasonListDate(start, end) {
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const sameDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();
      if (sameDay) return formatSeasonDate(start);
    }
    return formatSeasonDateRange(start, end);
  }
  return formatSeasonDate(start || end) || "Dates TBA";
}

export function resolveSeasonTagline(season, summary, championName, displayStatus = null) {
  return resolveSeasonCardTagline(season, summary, championName, displayStatus);
}

export function formatSeasonStatValue(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

export function formatTournamentFormat(format) {
  const key = String(format || "").toLowerCase();
  return FORMAT_LABELS[key] || "Custom bracket";
}

export function formatSeasonDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatSeasonDateRange(start, end) {
  const startLabel = formatSeasonDate(start);
  const endLabel = formatSeasonDate(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel || endLabel || "Dates TBA";
}

export function normalizePrizeBreakdown(value) {
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

export function prizePlacementLabel(item, index) {
  if (item.label && item.label !== `${index + 1}`) return item.label;
  const n = item.placement ?? index + 1;
  if (n === 1) return "1st Place";
  if (n === 2) return "2nd Place";
  if (n === 3) return "3rd Place";
  return `${n}th Place`;
}

/** Normalize GET /public/seasons/:slug payload for UI sections. */
export function normalizeSeasonPayload(data) {
  if (!data?.season) return null;

  const bundle = data.tournament || {};
  const tournament = bundle.tournament || null;
  const teams = bundle.teams || [];
  const matches = bundle.matches || [];
  const honors = bundle.honors || null;
  const standings = bundle.standings || [];
  const groupedStandings = bundle.groupedStandings || [];
  const trophyEngraving = data.trophyEngraving || data.season?.trophyEngraving || {};
  const trophy = normalizeTrophyEngraving(trophyEngraving, honors);
  const sponsorsConfig =
    data.sponsorsConfig ||
    data.season?.sponsorsConfig ||
    (data.snapshot && typeof data.snapshot === "object" ? data.snapshot.sponsorsConfig : null) ||
    {};

  return {
    season: data.season,
    tournament,
    teams,
    matches,
    honors,
    standings,
    groupedStandings,
    participations: data.participations || [],
    trophyEngraving,
    trophy,
    sponsorsConfig: normalizeSponsorsConfig(sponsorsConfig),
    teamLookup: buildTeamNameLookup(teams),
    hasHonors: hasPublicHonorsContent(honors),
    championName: trophy.teamName,
    prizePool: tournament?.prize_pool || "",
    prizeBreakdown: normalizePrizeBreakdown(tournament?.prize_pool_breakdown),
  };
}

export function summarizeBracketStages(matches = []) {
  const counts = new Map();
  for (const match of matches) {
    const stage = String(match.stageKey || match.stage_key || match.round || "Bracket").trim() || "Bracket";
    counts.set(stage, (counts.get(stage) || 0) + 1);
  }
  return [...counts.entries()].map(([stage, count]) => ({ stage, count }));
}
