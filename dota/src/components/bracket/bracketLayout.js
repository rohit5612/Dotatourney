/** Order stages left-to-right / top-to-bottom in list and flow layouts */
export const STAGE_SORT_ORDER = [
  "group-a",
  "group-b",
  "blast-group-a",
  "blast-group-b",
  "group-stage",
  "swiss",
  "league",
  "upper",
  "blast-lastchance",
  "blast-playin",
  "blast-playoffs",
  "lower",
  "upper-playoff",
  "lower-playoff",
  "playoffs",
  "bracket",
  "grand",
];

export function stageSortIndex(stageKey) {
  const i = STAGE_SORT_ORDER.indexOf(stageKey || "");
  return i === -1 ? STAGE_SORT_ORDER.length + String(stageKey || "").localeCompare("z") : i;
}

/** Composite bucket for list columns: stage + round */
export function matchRoundKey(match) {
  const stage = match.stageKey || "bracket";
  const round = match.roundIndex ?? 0;
  return `${stage}:${round}`;
}

export function parseRoundKey(key) {
  const idx = key.lastIndexOf(":");
  if (idx === -1) return { stageKey: key, roundIndex: 0 };
  return {
    stageKey: key.slice(0, idx),
    roundIndex: Number(key.slice(idx + 1)) || 0,
  };
}

export function compareRoundKeys(a, b) {
  const pa = parseRoundKey(a);
  const pb = parseRoundKey(b);
  const sa = stageSortIndex(pa.stageKey);
  const sb = stageSortIndex(pb.stageKey);
  if (sa !== sb) return sa - sb;
  return pa.roundIndex - pb.roundIndex;
}

/** Group stages (BO1 round robin, etc.): keep numeric rounds, not quarter/semi/final. */
export function isRoundRobinStyleStage(stageKey) {
  if (!stageKey) return false;
  return (
    stageKey === "league" ||
    stageKey === "swiss" ||
    stageKey === "group-stage" ||
    stageKey.startsWith("blast-group-") ||
    stageKey.startsWith("group-")
  );
}

export function humanizeStageKey(stageKey) {
  return String(stageKey || "bracket").replace(/-/g, " ");
}

/**
 * @param {number} ordinalFromStart — 0 = first column in this stage, …
 * @param {number} totalRounds — number of distinct round columns in this stage
 */
export function eliminationRoundLabel(ordinalFromStart, totalRounds) {
  const k = totalRounds;
  if (k <= 0) return `Round ${ordinalFromStart + 1}`;
  if (k === 1) return "Finals";
  if (k === 2) return ordinalFromStart === 0 ? "Semifinals" : "Finals";
  if (k === 3) {
    const labels = ["Quarterfinals", "Semifinals", "Finals"];
    return labels[ordinalFromStart] ?? `Round ${ordinalFromStart + 1}`;
  }
  const fromEnd = k - 1 - ordinalFromStart;
  if (fromEnd === 0) return "Finals";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${ordinalFromStart + 1}`;
}

/**
 * @param {object[]} matches — typically all matches for one stage
 * @returns {Record<string, number[]>} stageKey → sorted distinct roundIndex values
 */
export function stageRoundStructure(matches) {
  const byStage = {};
  for (const m of matches || []) {
    const sk = m.stageKey || "bracket";
    if (!byStage[sk]) byStage[sk] = new Set();
    byStage[sk].add(m.roundIndex ?? 0);
  }
  return Object.fromEntries(
    Object.entries(byStage).map(([sk, set]) => [sk, [...set].sort((a, b) => a - b)]),
  );
}

/**
 * Short title for one bracket column (tab already shows stage name in BracketDiagram).
 */
export function bracketColumnTitle(stageKey, roundIndex, sortedRoundsByStage) {
  const order = sortedRoundsByStage[stageKey] ?? [roundIndex];
  const total = order.length;
  const ordinal = order.indexOf(roundIndex);
  const ord = ordinal === -1 ? 0 : ordinal;

  if (isRoundRobinStyleStage(stageKey)) {
    return `Round ${roundIndex + 1}`;
  }

  const label = eliminationRoundLabel(ord, total);
  if (stageKey === "upper") return `Upper · ${label}`;
  if (stageKey === "lower") return `Lower · ${label}`;
  return label;
}

/**
 * Schedule / summaries: elimination phase + match number (stage name is shown separately).
 */
export function formatMatchRoundSummary(match, sortedRoundsByStageFull) {
  if (!match) return "";
  const sk = match.stageKey || "bracket";
  const ri = match.roundIndex ?? 0;
  const mi = (match.matchIndex ?? 0) + 1;
  const order = sortedRoundsByStageFull[sk] ?? [ri];
  const total = order.length;
  const ordinal = order.indexOf(ri);
  const ord = ordinal === -1 ? 0 : ordinal;

  if (isRoundRobinStyleStage(sk)) {
    return `Round ${ri + 1} · Match ${mi}`;
  }

  return `${eliminationRoundLabel(ord, total)} · Match ${mi}`;
}
