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

function blastPairedSemifinalReceivesQuarterfinal(producer, consumer, side, allMatches) {
  if (producer?.stageKey !== "blast-playoffs" || consumer?.stageKey !== "blast-playoffs") return false;
  if (side !== "team2") return false;
  if (!/^QFR/.test(String(producer.meta?.winToken || ""))) return false;
  const producerOrd = stageRoundOrdinal(allMatches, "blast-playoffs", producer.roundIndex ?? 0);
  const consumerOrd = stageRoundOrdinal(allMatches, "blast-playoffs", consumer.roundIndex ?? 0);
  if (consumerOrd !== producerOrd + 1) return false;
  return (consumer.matchIndex ?? 0) === (producer.matchIndex ?? 0);
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

function isBlastPlayInCrossMatch(match) {
  if (match?.stageKey !== "blast-playin") return false;
  const key = match?.meta?.seriesRuleKey || match?.meta?.presentationSeriesRuleKey;
  return key === "blast-playin-cross";
}

function isBlastMiddlePlayInMatch(match) {
  if (match?.stageKey !== "blast-playin") return false;
  const key = match?.meta?.seriesRuleKey || match?.meta?.presentationSeriesRuleKey;
  return key === "blast-mp-semifinal";
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

    if (consumer.stageKey === "blast-playoffs") {
      const producerTok = String(producer.meta?.winToken || "");
      // QF *i* → SF *i* on team2 (group #1 on team1); not a converging single-elim tree.
      if (/^QFR/.test(producerTok) && consumerMatch === producerMatch) {
        return side === "team2" ? token : null;
      }
      // SF *i* → Grand final slot *i*.
      if (/^SFR/.test(producerTok) && consumerMatch === 0) {
        if (side === "team1" && producerMatch === 0) return token;
        if (side === "team2" && producerMatch === 1) return token;
        return null;
      }
      return null;
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

  if (isBlastPlayInCrossMatch(consumer) && isBlastMiddlePlayInMatch(producer)) {
    return null;
  }

  if (consumerMatch === producerMatch) return token;
  return null;
}

function isQualifierStageKey(stageKey) {
  const key = String(stageKey || "");
  return key === "blast-playin" || key === "blast-lastchance";
}

function consumerSideFedByProducer(consumer, side, producer, allMatches) {
  const producerWinToken = producer.meta?.winToken;
  if (!producerWinToken) return false;

  const slotValue = String(consumer[side] || "");
  const feedMeta = consumer.meta?.[`${side}Feed`];

  if (isQualifierStageKey(producer.stageKey) && isPlayoffStageKey(consumer.stageKey || "")) {
    if (feedMeta === producerWinToken || slotValue === producerWinToken) return true;
  }

  const structuralToken = inferFeedTokenFromStructure(producer, consumer, side, allMatches);
  if (structuralToken === producerWinToken) {
    if (blastPairedSemifinalReceivesQuarterfinal(producer, consumer, side, allMatches)) return true;
  }
  if (!structuralToken || structuralToken !== producerWinToken) return false;

  if (feedMeta === producerWinToken || slotValue === producerWinToken) return true;

  const producerFeedLabel = canonicalPlayoffWinToken(producer, allMatches);
  if (producerFeedLabel && slotValue === producerFeedLabel) return true;
  if (producerFeedLabel && feedMeta === producerFeedLabel) return true;

  const resolvedSlot = resolvePlayoffSlotDisplay(slotValue, consumer, side, allMatches);
  if (producerFeedLabel && resolvedSlot === producerFeedLabel) return true;

  return false;
}

function findMatchByWinToken(allMatches, token) {
  const t = String(token || "").trim();
  if (!t) return null;
  return (allMatches || []).find((m) => m.meta?.winToken === t) || null;
}

function matchupLabelFromUpstreamToken(token, allMatches, depth = 0) {
  if (depth >= 4) return null;
  const upstream = findMatchByWinToken(allMatches, token);
  if (!upstream) return null;
  return matchupLabelFromMatch(upstream, allMatches, depth + 1);
}

/**
 * Human-readable label for an unfinished feeder match (team names or nested matchup).
 */
export function matchupLabelFromMatch(match, allMatches, depth = 0) {
  if (!match || depth >= 4) return null;
  if (match.winner) return String(match.winner);

  const t1 = String(match.team1 || "").trim();
  const t2 = String(match.team2 || "").trim();
  const tok1 = TEAM_TOKEN_REGEX.test(t1);
  const tok2 = TEAM_TOKEN_REGEX.test(t2);

  if (!tok1 && !tok2) return `${t1} vs ${t2}`;

  if (!tok1 && tok2) {
    const sub = matchupLabelFromUpstreamToken(t2, allMatches, depth);
    if (sub && sub.includes(" vs ") && !t1) return sub;
    return sub ? `${t1} vs ${sub}` : t1;
  }
  if (tok1 && !tok2) {
    const sub = matchupLabelFromUpstreamToken(t1, allMatches, depth);
    return sub ? `${sub} vs ${t2}` : t2;
  }

  const sub1 = matchupLabelFromUpstreamToken(t1, allMatches, depth);
  const sub2 = matchupLabelFromUpstreamToken(t2, allMatches, depth);
  if (sub1 && sub2) return `${sub1} vs ${sub2}`;
  return sub1 || sub2;
}

function findFeederMatchForConsumerSlot(consumer, side, allMatches) {
  const slotToken = String(consumer?.[side] || "").trim();
  if (TEAM_TOKEN_REGEX.test(slotToken)) {
    const direct = findMatchByWinToken(allMatches, slotToken);
    if (direct && compareMatchOrder(direct, consumer) < 0) return direct;
  }

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

  let feeder =
    findFeederMatchForConsumerSlot(match, slotSide, allMatches) ||
    findMatchByWinToken(allMatches, raw);

  // Token slots (QF/SF feeders) → show the upstream match, not the whole semifinal row.
  if (feeder && TEAM_TOKEN_REGEX.test(String(raw || "").trim())) {
    const byToken = findMatchByWinToken(allMatches, raw);
    if (byToken) feeder = byToken;
  }

  if (feeder?.winner) {
    if (String(displayToken).endsWith("L")) {
      return feeder.winner === feeder.team1 ? feeder.team2 : feeder.team1;
    }
    return feeder.winner;
  }

  // Upstream round not decided — keep bracket tags (QFR… / SFR… / PIR…) for open slots.
  return displayToken;
}
