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
  "blast-qualifiers-playin",
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

/** Count of elimination rounds (distinct round columns) for a stage inside the current match bundle */
export function blastStageRoundColumnCount(matches, stageKey) {
  let maxRi = -1;
  for (const m of matches || []) {
    if (m.stageKey !== stageKey) continue;
    const ri = m.roundIndex ?? 0;
    if (ri > maxRi) maxRi = ri;
  }
  return maxRi >= 0 ? maxRi + 1 : 0;
}

/**
 * BLAST LC/PI column headings.
 * Neutral qualifier wording only — avoids QF/SF/Final style labels that belong on the championship bracket.
 * @param {'lc'|'pi'} phase
 */
export function blastEliminationRoundLabel(phase, ordinalFromStart, totalRoundsInStage) {
  const k = totalRoundsInStage;
  const ord = ordinalFromStart;
  if (k <= 0 || ord < 0) return "";

  const name = phase === "lc" ? "Last chance" : "Play-In";
  if (k === 1) {
    return `${name} · Knockout`;
  }
  return `${name} · Round ${ord + 1}`;
}

/**
 * Tooltip phrase for LC/PI win-token rounds (aligned with column naming).
 */
export function blastTokenRoundClause(phase, winTokenRound1Based, roundsInBracket) {
  const r = Number(winTokenRound1Based);
  if (!Number.isFinite(r) || r < 1) return `round ${winTokenRound1Based}`;
  const depth = roundsInBracket > 0 ? roundsInBracket : r;
  return blastEliminationRoundLabel(phase, r - 1, depth);
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

  if (stageKey === "blast-lastchance") {
    return blastEliminationRoundLabel("lc", ord, total);
  }
  if (stageKey === "blast-playin") {
    return blastEliminationRoundLabel("pi", ord, total);
  }
  if (stageKey === "blast-qualifiers-playin") {
    return "Play-Ins";
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

  if (sk === "blast-lastchance") {
    return `${blastEliminationRoundLabel("lc", ord, total)} · Match ${mi}`;
  }
  if (sk === "blast-playin") {
    return `${blastEliminationRoundLabel("pi", ord, total)} · Match ${mi}`;
  }

  return `${eliminationRoundLabel(ord, total)} · Match ${mi}`;
}

/** @param {object[]} matches */
export function buildWinTokenLookup(matches) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const m of matches || []) {
    const tok = m.meta?.winToken;
    if (tok && typeof tok === "string") map.set(tok, m);
  }
  return map;
}

/** @typedef {{ fromId: string, toId: string }} BracketConnectorEdge */

/** @param {BracketConnectorEdge[]} edges */
export function dedupeConnectorEdges(edges) {
  const seen = new Set();
  const out = [];
  for (const e of edges || []) {
    const k = `${e.fromId}->${e.toId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/**
 * For consecutive elimination columns (sorted round keys), connect upstream matches whose
 * meta.winToken appears on downstream team1 / team2.
 * @param {Array<[string, object[]]>} sortedRoundsSorted (key, matches) sorted via compareRoundKeys
 * @returns {BracketConnectorEdge[]}
 */
export function eliminationFeederEdges(sortedRoundsPairs) {
  const edges = [];
  const flat =
    sortedRoundsPairs?.flatMap(([, rounds]) =>
      [...rounds].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0)),
    ) || [];
  const tokenLookup = buildWinTokenLookup(flat);

  for (let i = 0; i < sortedRoundsPairs.length - 1; i += 1) {
    const [, rawNext] = sortedRoundsPairs[i + 1];
    const nextKey = sortedRoundsPairs[i + 1][0];
    const { stageKey: nextSk } = parseRoundKey(nextKey);
    const nextRoundMatches =
      nextSk === "blast-qualifiers-playin"
        ? [...rawNext]
        : [...rawNext].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
    for (const m of nextRoundMatches) {
      for (const slot of [m.team1, m.team2]) {
        const feeder = tokenLookup.get(String(slot || ""));
        if (!feeder || feeder.id === m.id) continue;
        edges.push({ fromId: feeder.id, toId: m.id });
      }
    }
  }
  return dedupeConnectorEdges(edges);
}

/**
 * Crossover Play-In (#3/#4 vs LC survivors).
 * @param {object} match
 */
export function isBlastPlayInCrossMatch(match) {
  return match?.stageKey === "blast-playin" && match?.meta?.seriesRuleKey === "blast-playin-cross";
}

/**
 * Detect BLAST sizing from placeholder names in Last chance round 1 (explicit Group # ranks exist for 10 and 12 teams).
 * @returns {"ten"|"twelve"|"tiered_generic"|null}
 */
export function inferBlastBracketVariant(matches) {
  const samples = [];
  for (const m of matches || []) {
    if (m.stageKey !== "blast-lastchance") continue;
    if ((m.roundIndex ?? 0) !== 0) continue;
    samples.push(String(m.team1 || ""), String(m.team2 || ""));
  }
  const blob = samples.join("|");
  if (!blob) return null;
  if (blob.includes("Group A #5") || blob.includes("Group B #6")) return "twelve";
  if (blob.includes("Group A #4") || blob.includes("Group B #4")) return "ten";
  return "tiered_generic";
}

/**
 * Tooltip copy for seeded `Group X #n` placeholders in BLAST (10-team vs 12-team paths).
 */
export function describeBlastGroupSeedPlaceholder(teamToken, variant) {
  const m = String(teamToken || "").match(/^Group ([A-Z]) #(\d+)$/);
  if (!m) return null;
  const g = m[1];
  const seed = Number(m[2]);
  if (!Number.isFinite(seed)) return null;

  if (variant === "ten") {
    if (seed === 1) return `Group ${g} champion after BO1 group — seeded into the semifinals (waits on the quarterfinal tied to this side).`;
    if (seed === 2) return `Group ${g} #2 — playoff quarterfinal entrant versus the complementary Play‑In winner.`;
    if (seed === 3) return `Group ${g} #3 — one of four entrants in the single Play‑In hopper with two Last‑chance qualifiers.`;
    if (seed === 4 || seed === 5) return `Group ${g} #${seed} — Last‑chance starter; finalists join both #3 finishers inside the Play‑In.`;
    return null;
  }

  if (variant === "twelve") {
    if (seed === 1)
      return `Group ${g} champion after BO1 — semifinal bye until a quarterfinal winner arrives on this playoff lane.`;
    if (seed === 2)
      return `Group ${g} #2 — crossover Play‑In slot opposite a Last‑chance finalist; winner reaches the semifinal chase through quarterfinal cross-seeding.`;
    if (seed === 3 || seed === 4)
      return `Group ${g} #${seed} — middle Play‑In knockout with both groups’ #3 and #4 (paired A3↔B4, B3↔A4 style); finalist feeds quarterfinal cross-seeding.`;
    if (seed === 5 || seed === 6) return `Group ${g} #${seed} — Last‑chance band; finalists face each group's #2 in crossover Play‑Ins.`;
    return null;
  }

  return null;
}

/** Match-card level summary explaining structural outcome (shown as supplemental tooltip content). */
export function describeBlastMatchFlow(match, variant) {
  if (!match || (variant !== "ten" && variant !== "twelve")) return "";

  const sk = match.stageKey;
  const ri = match.roundIndex ?? 0;

  if (sk === "blast-lastchance") {
    if (variant === "twelve")
      return "Last chance — #5/#6 placements from both BO1 groups slug out until two finalists remain; both feed crossover matches against Group #2.";
    if (variant === "ten")
      return "Last chance — #4/#5 bands from both groups; two qualifiers advance into the 4-slot Play‑In with both group #3 teams.";
    return "";
  }

  if (sk === "blast-playin") {
    if (isBlastPlayInCrossMatch(match)) {
      if (variant === "twelve")
        return "Cross Play‑In — Group #2 vs Last‑chance finalist. Winner punches a semifinal berth after the quarterfinal cross-feed.";
      return "Cross Play‑In — feeds the semifinal chase via main playoffs.";
    }
    if (variant === "ten") return "Play‑In — four entrants (#3 ranks + LC movers) collide once; survivors jump the Group #2 quarterfinal hurdles.";
    if (variant === "twelve" && ri === 0) {
      return "Middle Play‑In — #3 and #4 seeds from both sides (paired A3↔B4, B3↔A4) until two contenders remain for crossover-fed quarterfinals.";
    }
    if (variant === "twelve") return "Qualifier row feeding the semifinal chase.";
    return "";
  }

  if (sk === "blast-playoffs") {
    if (variant === "twelve") {
      if (ri === 0) return "Championship quarterfinals — crossover winners duel middle survivors (cross seeded) before meeting Group champions.";
      if (ri === 1) return "Semifinals — awaiting BO1 champions on each rail; sends the finalist to crown.";
      if (ri === 2) return "BLAST championship final.";
    }
    if (variant === "ten") {
      if (ri === 0) return "Quarterfinals — complementary Play‑In winners challenge each group's #2; victors duel Group champions next.";
      if (ri === 1) return "Semifinals — Group winners vs surviving quarter finalists.";
      if (ri === 2) return "BLAST championship final.";
    }
  }

  return "";
}

/**
 * BLAST tiered qualifiers: ensure Last chance winner tokens draw into crossover Play-In slots
 * (those matches may sit after middle Play-In rows in the combined column).
 * @param {Array<[string, object[]]>} sortedRoundsPairs
 * @param {object[]} matches
 * @returns {BracketConnectorEdge[]}
 */
export function blastQualifierFeederEdges(sortedRoundsPairs, matches) {
  const base = eliminationFeederEdges(sortedRoundsPairs);
  if (!(matches || []).some((m) => isBlastPlayInCrossMatch(m))) {
    return base;
  }

  const lcByWinner = new Map();
  for (const m of matches) {
    if (m.stageKey !== "blast-lastchance") continue;
    const tok = m.meta?.winToken;
    if (tok && typeof tok === "string") lcByWinner.set(tok, m);
  }

  /** @type {BracketConnectorEdge[]} */
  const extra = [];
  /** Crossover slots reference Last chance winners (`LCR…` or legacy `LC…`). */
  const lcTokRe = /^(?:LCR\d+M\d+W|LC\d+M\d+W)$/;
  for (const xm of matches) {
    if (!isBlastPlayInCrossMatch(xm)) continue;
    for (const slot of [xm.team1, xm.team2]) {
      const s = String(slot || "");
      if (!lcTokRe.test(s)) continue;
      const feeder = lcByWinner.get(s);
      if (feeder) extra.push({ fromId: feeder.id, toId: xm.id });
    }
  }
  return dedupeConnectorEdges([...base, ...extra]);
}

/** Playoff QF slots fed from Play-In / Last-chance path (`PIR…`, legacy `PI` / `MP` / `XP`). */
const QUALIFIER_FEED_RE = /^(?:PIR\d+M\d+W|PI\d+M\d+W|MP\d+M\d+W|XP\d+M\d+W)$/;

/**
 * @param {object} match playoff match row
 */
export function playoffUsesPlayInWinners(match) {
  if (!match) return false;
  return (
    QUALIFIER_FEED_RE.test(String(match.team1 || "")) ||
    QUALIFIER_FEED_RE.test(String(match.team2 || ""))
  );
}

/**
 * Qualifier elimination matches whose winToken feeds the given playoff rows (QF round).
 * @param {object[]} playInMatches
 * @param {object[]} playoffFeedMatches
 */
export function blastQualifierMatchesFeedPlayoffs(playInMatches, playoffFeedMatches) {
  const want = new Set();
  for (const m of playoffFeedMatches || []) {
    const r = Number(m.roundIndex ?? 0);
    if (r !== 0) continue;
    for (const slot of [m.team1, m.team2]) {
      const s = String(slot || "");
      if (QUALIFIER_FEED_RE.test(s)) want.add(s);
    }
  }
  if (!want.size) return [];
  /** @type {object[]} */
  const out = [];
  for (const m of playInMatches || []) {
    const tok = m.meta?.winToken;
    if (tok && want.has(tok)) out.push(m);
  }
  return out.sort((a, b) => {
    const ca = isBlastPlayInCrossMatch(a) ? 1 : 0;
    const cb = isBlastPlayInCrossMatch(b) ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return (
      (a.roundIndex ?? 0) - (b.roundIndex ?? 0) ||
      (a.matchIndex ?? 0) - (b.matchIndex ?? 0)
    );
  });
}

/**
 * Sort Last chance matches so rows line up with crossover Play-In slots that use their win tokens.
 * @param {object[]} lcMatches
 * @param {object[]} crossMatches
 */
export function orderLastChanceMatchesForCrossover(lcMatches, crossMatches) {
  const sortedCross = [...crossMatches].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
  const lcByWinner = new Map();
  for (const m of lcMatches) {
    const t = m.meta?.winToken;
    if (t && typeof t === "string") lcByWinner.set(t, m);
  }
  /** @type {object[]} */
  const ordered = [];
  const lcTokRe = /^(?:LCR\d+M\d+W|LC\d+M\d+W)$/;
  const seenId = new Set();
  for (const cx of sortedCross) {
    for (const slot of [cx.team1, cx.team2]) {
      const s = String(slot || "");
      if (!lcTokRe.test(s)) continue;
      const m = lcByWinner.get(s);
      if (!m || seenId.has(m.id)) continue;
      seenId.add(m.id);
      ordered.push(m);
    }
  }
  const rest = lcMatches.filter((m) => !seenId.has(m.id));
  return [...ordered, ...rest];
}

/**
 * Tiered BLAST: stacked Play-Ins column (middle knockout above, crossover vs Last chance below).
 * Falls back if there are multiple middle or crossover rounds.
 */
export function buildBlastQualifierDisplayColumns(matches, baselinePairs) {
  const flat = baselinePairs.flatMap(([, list]) => list);
  const hasCross = flat.some(isBlastPlayInCrossMatch);
  if (!hasCross) {
    return { pairs: baselinePairs, tieredComposite: false, lastLcKey: null };
  }

  const mid = flat.filter((m) => m.stageKey === "blast-playin" && !isBlastPlayInCrossMatch(m));
  const cross = flat.filter(isBlastPlayInCrossMatch);
  const midRounds = [...new Set(mid.map((m) => m.roundIndex ?? 0))].sort((a, b) => a - b);
  const crossRounds = [...new Set(cross.map((m) => m.roundIndex ?? 0))].sort((a, b) => a - b);
  if (midRounds.length !== 1 || crossRounds.length !== 1) {
    return { pairs: baselinePairs, tieredComposite: false, lastLcKey: null };
  }

  const midKey = matchRoundKey({ stageKey: "blast-playin", roundIndex: midRounds[0] });
  const crossKey = matchRoundKey({ stageKey: "blast-playin", roundIndex: crossRounds[0] });
  if (midKey === crossKey) {
    return { pairs: baselinePairs, tieredComposite: false, lastLcKey: null };
  }

  const omit = new Set([midKey, crossKey]);
  const lcPairs = baselinePairs.filter(([k]) => k.startsWith("blast-lastchance"));
  const tail = baselinePairs.filter(([k]) => !omit.has(k) && !k.startsWith("blast-lastchance"));
  const lastLcKey = lcPairs.length ? lcPairs[lcPairs.length - 1][0] : null;

  const midSorted = [...mid].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
  const crossSorted = [...cross].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
  const compositeKey = "blast-qualifiers-playin:0";
  const composite = [...midSorted, ...crossSorted];
  const pairs = [...lcPairs, [compositeKey, composite], ...tail];
  return { pairs, tieredComposite: true, lastLcKey };
}

/**
 * Lowest roundIndex among play-in matches in the qualifier bundle.
 */
export function blastPlayInFirstRoundIndex(playInMatches) {
  let min = Number.POSITIVE_INFINITY;
  for (const m of playInMatches || []) {
    const r = m.roundIndex ?? 0;
    if (r < min) min = r;
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Adds `blast-qualifiers` merged bucket for UI when both LC and PI exist.
 * @param {Record<string, object[]>} groups stageKey → matches
 */
export function augmentGroupedBracketMatches(groups) {
  if (!groups || typeof groups !== "object") return {};
  const next = { ...groups };
  const lc = next["blast-lastchance"];
  const pi = next["blast-playin"];
  if (lc?.length && pi?.length) {
    next["blast-qualifiers"] = [...lc, ...pi].sort((a, b) => compareRoundKeys(matchRoundKey(a), matchRoundKey(b)));
  }
  return next;
}

/**
 * Older published snapshots still list separate Last Chance / Play-In tabs; merge for display.
 * @param {string} format tournament format id
 * @param {{ id: string, label?: string }[]} tabs
 */
export function normalizedBlastBracketTabs(format, tabs) {
  if (format !== "blast" || !Array.isArray(tabs) || tabs.length === 0) return tabs;
  const hasMerged = tabs.some((t) => t.id === "blast-qualifiers");
  const iLC = tabs.findIndex((t) => t.id === "blast-lastchance");
  const iPI = tabs.findIndex((t) => t.id === "blast-playin");
  if (!hasMerged && iLC >= 0 && iPI >= 0 && iPI === iLC + 1) {
    const next = [...tabs];
    next.splice(iLC, 2, { id: "blast-qualifiers", label: "Last Chance & Play-In" });
    return next;
  }
  return tabs;
}

/**
 * Tab order index for schedule / lists. Maps blast LC + PI match rows to `blast-qualifiers` when merged.
 * @param {string} format
 * @param {{ id: string }[]} tabs
 */
export function buildStageTabOrdering(format, tabs) {
  const normalized = normalizedBlastBracketTabs(format || "", tabs || []);
  /** @type {Record<string, number>} */
  const order = {};
  normalized.forEach((t, i) => {
    order[t.id] = i;
  });
  if (order["blast-qualifiers"] != null) {
    order["blast-lastchance"] = order["blast-qualifiers"];
    order["blast-playin"] = order["blast-qualifiers"];
  }
  return order;
}

/**
 * Labels keyed by stageKey (tabs + LC/PI aliases when merged blast tab exists).
 */
export function buildStageTabLabels(format, tabs) {
  const normalized = normalizedBlastBracketTabs(format || "", tabs || []);
  /** @type {Record<string, string>} */
  const labels = {};
  for (const t of normalized) {
    labels[t.id] = t.label || t.id;
  }
  if (labels["blast-qualifiers"]) {
    labels["blast-lastchance"] = labels["blast-qualifiers"];
    labels["blast-playin"] = labels["blast-qualifiers"];
  }
  return labels;
}
