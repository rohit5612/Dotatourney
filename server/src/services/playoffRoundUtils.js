/** @param {string} stageKey */
export function isPlayoffStageKey(stageKey) {
  const key = String(stageKey || "");
  return key === "blast-playoffs" || key === "playoffs";
}

/** @param {object[]} matches @param {string} stageKey */
export function distinctStageRoundIndices(matches, stageKey) {
  return [
    ...new Set(
      (matches || [])
        .filter((match) => match.stageKey === stageKey)
        .map((match) => match.roundIndex ?? 0),
    ),
  ].sort((a, b) => a - b);
}

/**
 * 0-based ordinal of a round within a stage (handles 1-based configs like rounds 1,2,3).
 * @param {object[]} matches
 * @param {string} stageKey
 * @param {number} roundIndex
 */
export function stageRoundOrdinal(matches, stageKey, roundIndex) {
  const rounds = distinctStageRoundIndices(matches, stageKey);
  if (!rounds.length) return roundIndex ?? 0;
  const idx = rounds.indexOf(roundIndex ?? 0);
  return idx >= 0 ? idx : roundIndex ?? 0;
}

/** @param {object[]} plan */
export function planRoundOrdinals(plan) {
  return [...new Set((plan || []).map((match) => match.roundIndex ?? 0))].sort((a, b) => a - b);
}

/** @param {number} planRoundIndex @param {number[]} planRoundsSorted */
export function normalizePlanRoundIndex(planRoundIndex, planRoundsSorted) {
  const idx = planRoundsSorted.indexOf(planRoundIndex ?? 0);
  return idx >= 0 ? idx : planRoundIndex ?? 0;
}

/** @param {object[]} matches */
export function resolvePlayoffStageKey(matches) {
  if ((matches || []).some((match) => match.stageKey === "blast-playoffs")) return "blast-playoffs";
  if ((matches || []).some((match) => match.stageKey === "playoffs")) return "playoffs";
  return null;
}

/** @param {object[]} matches */
export function findPlayoffFinalMatch(matches) {
  const stageKey = resolvePlayoffStageKey(matches);
  if (!stageKey) return null;
  const stageMatches = (matches || []).filter((match) => match.stageKey === stageKey);
  if (!stageMatches.length) return null;
  const rounds = distinctStageRoundIndices(matches, stageKey);
  if (!rounds.length) return null;

  if (rounds.length === 1 && stageMatches.length === 1) {
    const only = stageMatches[0];
    const roundIndex = only.roundIndex ?? 0;
    const rule = only.meta?.seriesRuleKey || only.seriesRuleKey;
    if (rule === "blast-po-final" || roundIndex >= 2) return only;
    return null;
  }

  const finalRound = rounds[rounds.length - 1];
  const finals = stageMatches
    .filter((match) => (match.roundIndex ?? 0) === finalRound)
    .sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
  if (finals.length === 1) return finals[0];
  return finals[0] || null;
}

/** @param {object[]} matches @param {string} stageKey @param {number} roundIndex */
export function playoffMatchesInRound(matches, stageKey, roundIndex) {
  return (matches || [])
    .filter((match) => match.stageKey === stageKey && (match.roundIndex ?? 0) === roundIndex)
    .sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
}

/** @param {object} match @param {object[]} allMatches */
export function canonicalPlayoffWinToken(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.winToken || null;
  const matchIndex = match.matchIndex ?? 0;
  const ordinal = stageRoundOrdinal(allMatches, stageKey, match.roundIndex ?? 0);
  if (ordinal >= 2) return "CHAMPION";
  if (ordinal === 1) return `SFR1M${matchIndex + 1}W`;
  return `QFR1M${matchIndex + 1}W`;
}

/** @param {object} match @param {object[]} allMatches */
export function canonicalPlayoffSeriesRuleKey(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.seriesRuleKey || null;
  const ordinal = stageRoundOrdinal(allMatches, stageKey, match.roundIndex ?? 0);
  if (ordinal >= 2) return "blast-po-final";
  if (ordinal === 1) return "blast-po-semifinal";
  return "blast-po-quarterfinal";
}

/** @param {object[]} matches */
export function buildPlayoffTokenAliasMap(matches) {
  /** @type {Map<string, string>} */
  const aliases = new Map();
  for (const match of matches || []) {
    const stored = match?.meta?.winToken;
    const canonical = canonicalPlayoffWinToken(match, matches);
    if (!stored || !canonical || stored === canonical) continue;
    aliases.set(stored, canonical);
    aliases.set(canonical, stored);
    const storedLoser = stored.replace(/W$/, "L");
    const canonicalLoser = canonical.replace(/W$/, "L");
    if (storedLoser !== canonicalLoser) {
      aliases.set(storedLoser, canonicalLoser);
      aliases.set(canonicalLoser, storedLoser);
    }
  }
  return aliases;
}

/**
 * Adds presentation-only meta for legacy 1-based playoff rounds without mutating stored tokens.
 * @param {object[]} matches
 */
export function decorateMatchesForClient(matches) {
  if (!matches?.length) return matches || [];
  return matches.map((match) => {
    const presentationWinToken = canonicalPlayoffWinToken(match, matches);
    const presentationSeriesRuleKey = canonicalPlayoffSeriesRuleKey(match, matches);
    const storedToken = match.meta?.winToken;
    const storedRule = match.meta?.seriesRuleKey;
    if (
      (!presentationWinToken || presentationWinToken === storedToken) &&
      (!presentationSeriesRuleKey || presentationSeriesRuleKey === storedRule)
    ) {
      return match;
    }
    return {
      ...match,
      meta: {
        ...(match.meta || {}),
        presentationWinToken: presentationWinToken || storedToken,
        presentationSeriesRuleKey: presentationSeriesRuleKey || storedRule,
      },
    };
  });
}
