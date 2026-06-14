import { formatDetails } from "../../constants/tournament.js";
import { summarizeEngineConfig } from "../../utils/engineTemplateSummary.js";
import { parseSeasonLabelFromName } from "../../utils/tournamentNaming.js";

export function categorizeTournaments(tournaments = []) {
  const drafts = [];
  const active = [];
  const past = [];
  for (const tournament of tournaments) {
    if (tournament.status === "concluded") past.push(tournament);
    else if (tournament.status === "draft") drafts.push(tournament);
    else active.push(tournament);
  }
  return { drafts, active, past };
}

export function tournamentCounts(tournaments = []) {
  const { drafts, active, past } = categorizeTournaments(tournaments);
  return { drafts: drafts.length, active: active.length, past: past.length, total: tournaments.length };
}

export function tournamentStatusLabel(tournament) {
  if (tournament.status === "concluded") return "Past";
  if (tournament.is_published) return "Live";
  if (tournament.status === "approved") return "Approved";
  if (tournament.status === "published") return "Published";
  if (tournament.status === "draft") return "Draft";
  return tournament.status || "Unknown";
}

export function tournamentStatusClass(tournament) {
  if (tournament.status === "concluded") return "setup-badge--past";
  if (tournament.is_published) return "setup-badge--live";
  if (tournament.status === "approved" || tournament.status === "published") return "setup-badge--approved";
  return "setup-badge--draft";
}

export function tournamentMetaLine(tournament, templateById = {}) {
  const template = templateById[tournament.engine_template_id];
  const fromTemplate = template?.label;
  const fromConfig = summarizeEngineConfig(tournament.engine_config);
  const format =
    fromTemplate ||
    fromConfig ||
    formatDetails[tournament.format]?.name ||
    tournament.format;
  return `${format} · ${tournament.team_count} teams · ${tournament.start_date || "Dates TBA"}`;
}

export function tournamentCardTitle(tournament) {
  return parseSeasonLabelFromName(tournament.name) || tournament.name || "Untitled";
}

export function formatSetupDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
