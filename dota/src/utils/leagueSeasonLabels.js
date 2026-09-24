/** Canonical franchise season finishes (BLAST-style brackets). */
export const BRACKET_FINISH_LABELS = {
  champion: "Champion",
  runnerUp: "Runner-up",
  semiFinalist: "Semi finalist",
  quarterFinalist: "Quarter finalist",
  playInCrossover: "Play in crossover",
  playIn: "Play in",
  lastChance: "Last chance",
};

const BRACKET_FINISH_RANK = {
  [BRACKET_FINISH_LABELS.champion]: 100,
  [BRACKET_FINISH_LABELS.runnerUp]: 90,
  [BRACKET_FINISH_LABELS.semiFinalist]: 80,
  [BRACKET_FINISH_LABELS.quarterFinalist]: 70,
  [BRACKET_FINISH_LABELS.playInCrossover]: 60,
  [BRACKET_FINISH_LABELS.playIn]: 50,
  [BRACKET_FINISH_LABELS.lastChance]: 40,
};

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Map stored roles / badge labels to canonical bracket finishes. */
export function normalizeBracketFinishLabel(value) {
  const token = normalizeToken(value);
  if (!token) return null;

  if (token === "champion" || token === "1st" || token === "1st place") {
    return BRACKET_FINISH_LABELS.champion;
  }
  if (token === "runner up" || token === "runner-up" || token === "2nd" || token === "2nd place") {
    return BRACKET_FINISH_LABELS.runnerUp;
  }
  if (
    token === "semi finalist" ||
    token === "semifinalist" ||
    token === "semifinals" ||
    token === "in semifinals" ||
    token === "3rd place" ||
    token === "third place" ||
    token === "3rd"
  ) {
    return BRACKET_FINISH_LABELS.semiFinalist;
  }
  if (
    token === "quarter finalist" ||
    token === "quarterfinalist" ||
    token === "quarterfinals" ||
    token === "in quarterfinals" ||
    token === "top 8" ||
    token === "top8"
  ) {
    return BRACKET_FINISH_LABELS.quarterFinalist;
  }
  if (
    token === "play in crossover" ||
    token === "play-in crossover" ||
    token === "crossover" ||
    token === "blast playin cross"
  ) {
    return BRACKET_FINISH_LABELS.playInCrossover;
  }
  if (token === "play in" || token === "play-in" || token === "playin" || token === "in play in") {
    return BRACKET_FINISH_LABELS.playIn;
  }
  if (token === "last chance" || token === "in last chance") {
    return BRACKET_FINISH_LABELS.lastChance;
  }
  if (token === "grand final" || token === "finals" || token === "in final") {
    return BRACKET_FINISH_LABELS.champion;
  }

  return null;
}

export function placementLabel(placement) {
  if (placement == null) return "—";
  const n = Number(placement);
  if (!Number.isFinite(n)) return "—";
  if (n === 1) return BRACKET_FINISH_LABELS.champion;
  if (n === 2) return BRACKET_FINISH_LABELS.runnerUp;
  if (n === 3) return `${n}rd place`;
  return `${n}th place`;
}

function isBlastFormat(format) {
  return String(format || "").trim().toLowerCase() === "blast";
}

function blastPlacementFallback(placement) {
  const n = Number(placement);
  if (!Number.isFinite(n)) return null;
  if (n === 1) return BRACKET_FINISH_LABELS.champion;
  if (n === 2) return BRACKET_FINISH_LABELS.runnerUp;
  if (n === 3) return BRACKET_FINISH_LABELS.semiFinalist;
  if (n >= 4 && n <= 8) return BRACKET_FINISH_LABELS.quarterFinalist;
  return placementLabel(n);
}

function collectBracketCandidates(season) {
  const out = [];
  const push = (value) => {
    const label = normalizeBracketFinishLabel(value);
    if (label) out.push(label);
  };

  push(season?.honors?.podium?.role);
  push(season?.honors?.bracketBadge?.label);

  const badges = Array.isArray(season?.honors?.badges) ? season.honors.badges : [];
  for (const badge of badges) {
    push(badge?.role);
  }

  return out;
}

function pickBestBracketLabel(labels) {
  if (!labels.length) return null;
  return [...labels].sort((a, b) => (BRACKET_FINISH_RANK[b] ?? 0) - (BRACKET_FINISH_RANK[a] ?? 0))[0];
}

function hasExplicitNumericRank(season, format) {
  const placement = season?.placement;
  if (placement == null || placement === "") return false;
  const n = Number(placement);
  if (!Number.isFinite(n)) return false;

  if (isBlastFormat(format)) {
    if (n >= 9) return true;
    return false;
  }

  const bracket = pickBestBracketLabel(collectBracketCandidates(season));
  if (bracket) return false;
  return true;
}

/** Best public finish for a franchise season (bracket stages unless explicit numeric rank). */
export function seasonFinishLabel(season) {
  if (!season) return "—";

  const format = season.tournamentFormat || season.format || null;
  const bracketLabel = pickBestBracketLabel(collectBracketCandidates(season));
  if (bracketLabel) return bracketLabel;

  if (hasExplicitNumericRank(season, format)) {
    return placementLabel(season.placement);
  }

  if (isBlastFormat(format) && season.placement != null && season.placement !== "") {
    const blast = blastPlacementFallback(season.placement);
    if (blast) return blast;
  }

  if (season.placement != null && season.placement !== "") {
    const n = Number(season.placement);
    if (Number.isFinite(n) && n <= 2) {
      return n === 1 ? BRACKET_FINISH_LABELS.champion : BRACKET_FINISH_LABELS.runnerUp;
    }
    return placementLabel(season.placement);
  }

  if (season.seasonStatus === "active") return "In progress";
  return "—";
}
