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

/** @param {object[]} allMatches @param {string} stageKey @param {number} roundIndex */
export function playoffRoundsFromEnd(allMatches, stageKey, roundIndex) {
  const rounds = distinctStageRoundIndices(allMatches, stageKey);
  if (!rounds.length) return 0;
  const ordinal = stageRoundOrdinal(allMatches, stageKey, roundIndex ?? 0);
  return rounds.length - 1 - ordinal;
}

/** @param {object} match @param {object[]} allMatches */
export function canonicalPlayoffWinToken(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.winToken || null;
  const matchIndex = match.matchIndex ?? 0;
  const roundsFromEnd = playoffRoundsFromEnd(allMatches, stageKey, match.roundIndex ?? 0);
  if (roundsFromEnd <= 0) return "CHAMPION";
  if (roundsFromEnd === 1) return `SFR1M${matchIndex + 1}W`;
  return `QFR1M${matchIndex + 1}W`;
}

/** @param {object} match @param {object[]} allMatches */
export function canonicalPlayoffSeriesRuleKey(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.seriesRuleKey || null;
  const roundsFromEnd = playoffRoundsFromEnd(allMatches, stageKey, match.roundIndex ?? 0);
  if (roundsFromEnd <= 0) return "blast-po-final";
  if (roundsFromEnd === 1) return "blast-po-semifinal";
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
    if (stored === "CHAMPION") continue;
    aliases.set(stored, canonical);
    aliases.set(canonical, stored);
    if (stored.endsWith("W") && canonical.endsWith("W")) {
      const storedLoser = stored.replace(/W$/, "L");
      const canonicalLoser = canonical.replace(/W$/, "L");
      if (storedLoser !== canonicalLoser) {
        aliases.set(storedLoser, canonicalLoser);
        aliases.set(canonicalLoser, storedLoser);
      }
    }
  }
  return aliases;
}

/** @param {object[]} matches */
export function buildStoredToCanonicalDisplayMap(matches) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const match of matches || []) {
    const stored = match?.meta?.winToken;
    const canonical = canonicalPlayoffWinToken(match, matches);
    if (!stored || !canonical || stored === canonical) continue;
    if (stored === "CHAMPION") continue;
    map.set(stored, canonical);
    if (stored.endsWith("W") && canonical.endsWith("W")) {
      const storedLoser = stored.replace(/W$/, "L");
      const canonicalLoser = canonical.replace(/W$/, "L");
      if (storedLoser !== canonicalLoser) map.set(storedLoser, canonicalLoser);
    }
  }
  return map;
}

const TEAM_TOKEN_REGEX = /^[A-Z0-9_]+$/;

/**
 * BLAST main path: QF match *i* winner feeds semifinal match *i* on team2 (group #1 on team1).
 */
export function blastPairedSemifinalReceivesQuarterfinal(producer, consumer, side, allMatches) {
  if (producer?.stageKey !== "blast-playoffs" || consumer?.stageKey !== "blast-playoffs") return false;
  if (side !== "team2") return false;
  if (!/^QFR/.test(String(producer.meta?.winToken || ""))) return false;
  const producerOrd = stageRoundOrdinal(allMatches, "blast-playoffs", producer.roundIndex ?? 0);
  const consumerOrd = stageRoundOrdinal(allMatches, "blast-playoffs", consumer.roundIndex ?? 0);
  if (consumerOrd !== producerOrd + 1) return false;
  return (consumer.matchIndex ?? 0) === (producer.matchIndex ?? 0);
}

/** Expected QF win-token on semifinal match *i* team2. */
export function blastSemifinalQuarterfinalFeedToken(match, allMatches) {
  if (match?.stageKey !== "blast-playoffs") return null;
  const rounds = distinctStageRoundIndices(allMatches, "blast-playoffs");
  if (rounds.length < 2) return null;
  const ord = stageRoundOrdinal(allMatches, "blast-playoffs", match.roundIndex ?? 0);
  if (ord !== rounds.length - 2) return null;
  const mi = match.matchIndex ?? 0;
  return `QFR1M${mi + 1}W`;
}

/**
 * Fix mis-seeded semifinal team2 placeholders (e.g. both rows set to QFR1M2W).
 * @param {object[]} matches
 */
export function repairBlastSemifinalQuarterfinalFeeds(matches) {
  if (!matches?.length) return matches;
  return matches.map((match) => {
    const expected = blastSemifinalQuarterfinalFeedToken(match, matches);
    if (!expected) return match;
    const team2 = String(match.team2 || "");
    const feed = match.meta?.team2Feed;
    const wrongQfToken = /^QFR1M\d+W$/.test(team2) && team2 !== expected;
    const wrongFeed = typeof feed === "string" && /^QFR1M\d+W$/.test(feed) && feed !== expected;
    if (!wrongQfToken && !wrongFeed) return match;
    return {
      ...match,
      team2: expected,
      meta: { ...(match.meta || {}), team2Feed: expected },
    };
  });
}

/**
 * Display label for unresolved playoff feeder slots (team1/team2 placeholders).
 * @param {string} value
 * @param {object} consumerMatch
 * @param {"team1"|"team2"} side
 * @param {object[]} allMatches
 * @param {Map<string, string>} [tokenDisplayMap]
 */
export function resolvePlayoffSlotDisplay(value, consumerMatch, side, allMatches, tokenDisplayMap) {
  const text = String(value || "").trim();
  if (!text || !TEAM_TOKEN_REGEX.test(text)) return value;

  if (text === "CHAMPION" && isPlayoffStageKey(consumerMatch?.stageKey || "")) {
    const stageKey = consumerMatch.stageKey;
    const rounds = distinctStageRoundIndices(allMatches, stageKey);
    const consumerOrd = stageRoundOrdinal(allMatches, stageKey, consumerMatch.roundIndex ?? 0);
    if (rounds.length >= 2 && consumerOrd === rounds.length - 1) {
      const sfRound = rounds[rounds.length - 2];
      const sfMatches = playoffMatchesInRound(allMatches, stageKey, sfRound);
      const sfIndex = side === "team2" ? 1 : 0;
      const sf = sfMatches[sfIndex];
      if (sf) {
        const canon = canonicalPlayoffWinToken(sf, allMatches);
        if (canon && canon !== "CHAMPION") return canon;
      }
    }
  }

  const map = tokenDisplayMap || buildStoredToCanonicalDisplayMap(allMatches);
  const roundsFromEnd = playoffRoundsFromEnd(allMatches, consumerMatch.stageKey, consumerMatch.roundIndex ?? 0);
  if (roundsFromEnd > 0 && map.has(text)) return map.get(text);

  return value;
}

/**
 * Adds presentation-only meta for legacy 1-based playoff rounds without mutating stored tokens.
 * @param {object[]} matches
 */
export function decorateMatchesForClient(matches) {
  if (!matches?.length) return matches || [];
  const tokenDisplayMap = buildStoredToCanonicalDisplayMap(matches);

  return matches.map((match) => {
    const presentationWinToken = canonicalPlayoffWinToken(match, matches);
    const presentationSeriesRuleKey = canonicalPlayoffSeriesRuleKey(match, matches);
    const storedToken = match.meta?.winToken;
    const storedRule = match.meta?.seriesRuleKey;

    const presentationTeam1 = resolvePlayoffSlotDisplay(match.team1, match, "team1", matches, tokenDisplayMap);
    const presentationTeam2 = resolvePlayoffSlotDisplay(match.team2, match, "team2", matches, tokenDisplayMap);

    const meta = { ...(match.meta || {}) };
    let changed = false;

    if (presentationWinToken && presentationWinToken !== storedToken) {
      meta.presentationWinToken = presentationWinToken;
      changed = true;
    }
    if (presentationSeriesRuleKey && presentationSeriesRuleKey !== storedRule) {
      meta.presentationSeriesRuleKey = presentationSeriesRuleKey;
      changed = true;
    }
    if (presentationTeam1 !== match.team1) {
      meta.presentationTeam1 = presentationTeam1;
      changed = true;
    }
    if (presentationTeam2 !== match.team2) {
      meta.presentationTeam2 = presentationTeam2;
      changed = true;
    }

    if (!changed) return match;
    return { ...match, meta };
  });
}
