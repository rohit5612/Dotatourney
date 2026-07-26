/** Client helpers for legacy 1-based playoff round configs (presentation-only). */

const TEAM_TOKEN_REGEX = /^[A-Z0-9_]+$/;

export function isPlayoffStageKey(stageKey) {
  const key = String(stageKey || "");
  return key === "blast-playoffs" || key === "playoffs";
}

export function distinctStageRoundIndices(matches, stageKey) {
  return [
    ...new Set(
      (matches || [])
        .filter((match) => match.stageKey === stageKey)
        .map((match) => match.roundIndex ?? 0),
    ),
  ].sort((a, b) => a - b);
}

export function stageRoundOrdinal(matches, stageKey, roundIndex) {
  const rounds = distinctStageRoundIndices(matches, stageKey);
  if (!rounds.length) return roundIndex ?? 0;
  const idx = rounds.indexOf(roundIndex ?? 0);
  return idx >= 0 ? idx : roundIndex ?? 0;
}

function playoffRoundsFromEnd(allMatches, stageKey, roundIndex) {
  const rounds = distinctStageRoundIndices(allMatches, stageKey);
  if (!rounds.length) return 0;
  const ordinal = stageRoundOrdinal(allMatches, stageKey, roundIndex ?? 0);
  return rounds.length - 1 - ordinal;
}

function canonicalPlayoffWinToken(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.winToken || null;
  const matchIndex = match.matchIndex ?? 0;
  const roundsFromEnd = playoffRoundsFromEnd(allMatches, stageKey, match.roundIndex ?? 0);
  if (roundsFromEnd <= 0) return "CHAMPION";
  if (roundsFromEnd === 1) return `SFR1M${matchIndex + 1}W`;
  return `QFR1M${matchIndex + 1}W`;
}

function buildStoredToCanonicalDisplayMap(matches) {
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

function playoffMatchesInRound(matches, stageKey, roundIndex) {
  return (matches || [])
    .filter((match) => match.stageKey === stageKey && (match.roundIndex ?? 0) === roundIndex)
    .sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
}

function compareMatchOrder(a, b) {
  const stageDiff = String(a.stageKey || "").localeCompare(String(b.stageKey || ""));
  if (stageDiff !== 0) return stageDiff;
  const roundDiff = (a.roundIndex ?? 0) - (b.roundIndex ?? 0);
  if (roundDiff !== 0) return roundDiff;
  return (a.matchIndex ?? 0) - (b.matchIndex ?? 0);
}

function inferFeedTokenFromStructure(producer, consumer, side, allMatches) {
  const token = producer.meta?.winToken;
  if (!token || compareMatchOrder(producer, consumer) >= 0) return null;

  const producerRound = producer.roundIndex ?? 0;
  const consumerRound = consumer.roundIndex ?? 0;
  const producerMatch = producer.matchIndex ?? 0;
  const consumerMatch = consumer.matchIndex ?? 0;

  if (producer.stageKey !== consumer.stageKey) return null;

  if (isPlayoffStageKey(consumer.stageKey)) {
    const producerOrd = stageRoundOrdinal(allMatches, consumer.stageKey, producerRound);
    const consumerOrd = stageRoundOrdinal(allMatches, consumer.stageKey, consumerRound);
    if (consumerOrd !== producerOrd + 1) return null;

    if (
      consumer.stageKey === "blast-playoffs" &&
      consumerOrd === producerOrd + 1 &&
      consumerMatch === producerMatch &&
      /^QFR/.test(String(producer.meta?.winToken || ""))
    ) {
      return side === "team2" ? token : null;
    }
    if (consumerOrd >= 2 && consumerMatch === 0) {
      if (side === "team1" && producerMatch === 0) return token;
      if (side === "team2" && producerMatch === 1) return token;
      return null;
    }
    const nextMatch = Math.floor(producerMatch / 2);
    if (consumerMatch === nextMatch) {
      return side === (producerMatch % 2 === 0 ? "team1" : "team2") ? token : null;
    }
    return null;
  }

  if (consumerRound !== producerRound + 1) return null;
  if (consumerMatch === producerMatch) return token;
  return null;
}

function consumerSideFedByProducer(consumer, side, producer, allMatches) {
  const structuralToken = inferFeedTokenFromStructure(producer, consumer, side, allMatches);
  const producerWinToken = producer.meta?.winToken;
  if (!producerWinToken || structuralToken !== producerWinToken) return false;

  const slotValue = String(consumer[side] || "");
  const feedMeta = consumer.meta?.[`${side}Feed`];

  if (feedMeta === producerWinToken) return true;
  if (slotValue === producerWinToken) return true;

  const producerFeedLabel = canonicalPlayoffWinToken(producer, allMatches);
  if (producerFeedLabel && slotValue === producerFeedLabel) return true;
  if (producerFeedLabel && feedMeta === producerFeedLabel) return true;

  const resolvedSlot = resolvePlayoffSlotDisplay(slotValue, consumer, side, allMatches);
  if (producerFeedLabel && resolvedSlot === producerFeedLabel) return true;

  return false;
}

function findFeederMatchForConsumerSlot(consumer, side, allMatches) {
  const sorted = [...(allMatches || [])].sort(compareMatchOrder);
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const candidate = sorted[index];
    if (compareMatchOrder(candidate, consumer) >= 0) continue;
    if (consumerSideFedByProducer(consumer, side, candidate, allMatches)) return candidate;
    const structural = inferFeedTokenFromStructure(candidate, consumer, side, allMatches);
    if (structural && candidate.meta?.winToken === structural) return candidate;
  }
  return null;
}

function resolvePlayoffSlotDisplay(value, consumerMatch, side, allMatches, tokenDisplayMap) {
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

/** Win-token lookup for bracket SVG connectors (aliases legacy stored tokens). */
export function buildPlayoffConnectorTokenLookup(matches) {
  const map = new Map();
  const aliases = buildStoredToCanonicalDisplayMap(matches);
  for (const match of matches || []) {
    const token = match?.meta?.winToken;
    if (!token || typeof token !== "string") continue;
    map.set(token, match);
    if (token.endsWith("W")) {
      map.set(token.replace(/W$/, "L"), match);
    }
    const canonical = canonicalPlayoffWinToken(match, matches);
    if (canonical && canonical !== token) {
      map.set(canonical, match);
      if (canonical.endsWith("W")) {
        map.set(canonical.replace(/W$/, "L"), match);
      }
    }
    const alias = aliases.get(token);
    if (alias) {
      map.set(alias, match);
      if (alias.endsWith("W")) {
        map.set(alias.replace(/W$/, "L"), match);
      }
    }
  }
  return map;
}

/** Resolve a downstream slot token for connector edge wiring. */
export function resolveConnectorSlotToken(consumer, side, allMatches) {
  const presentationKey = side === "team1" ? "presentationTeam1" : "presentationTeam2";
  if (consumer?.meta?.[presentationKey]) return consumer.meta[presentationKey];
  return resolvePlayoffSlotDisplay(consumer?.[side], consumer, side, allMatches);
}

export function resolveDisplayWinToken(match) {
  return match?.meta?.presentationWinToken || match?.meta?.winToken || null;
}

export function resolveDisplaySeriesRuleKey(match) {
  return match?.meta?.presentationSeriesRuleKey || match?.meta?.seriesRuleKey || null;
}

/** Display-only team slot label; underlying match.team1/team2 stay unchanged for progression saves. */
export function resolveDisplayTeamName(match, side, allMatches = null) {
  const raw = side === 1 ? match?.team1 : match?.team2;
  if (!TEAM_TOKEN_REGEX.test(String(raw || "").trim())) return raw;

  const slotSide = side === 1 ? "team1" : "team2";
  const presentationKey = side === 1 ? "presentationTeam1" : "presentationTeam2";
  const displayToken =
    match?.meta?.[presentationKey] || resolvePlayoffSlotDisplay(raw, match, slotSide, allMatches);

  if (!allMatches?.length) return displayToken;

  const feeder = findFeederMatchForConsumerSlot(match, slotSide, allMatches);
  if (feeder?.winner) {
    if (String(displayToken).endsWith("L")) {
      return feeder.winner === feeder.team1 ? feeder.team2 : feeder.team1;
    }
    return feeder.winner;
  }

  return displayToken;
}
