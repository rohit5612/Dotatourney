const TEAM_TOKEN_REGEX = /^[A-Z0-9_]+$/;

const STAGE_ORDER = [
  "blast-group-a",
  "blast-group-b",
  "blast-lastchance",
  "blast-playin",
  "blast-qualifiers-playin",
  "blast-playoffs",
  "upper",
  "lower",
  "grand",
  "playoffs",
  "groups-open",
  "groups-decider",
  "upper-playoff",
  "lower-playoff",
];

function stageRank(stageKey) {
  const index = STAGE_ORDER.indexOf(stageKey);
  return index === -1 ? STAGE_ORDER.length + String(stageKey || "").charCodeAt(0) : index;
}

export function compareMatchOrder(a, b) {
  const stageDiff = stageRank(a.stageKey) - stageRank(b.stageKey);
  if (stageDiff !== 0) return stageDiff;
  const roundDiff = (a.roundIndex ?? 0) - (b.roundIndex ?? 0);
  if (roundDiff !== 0) return roundDiff;
  return (a.matchIndex ?? 0) - (b.matchIndex ?? 0);
}

export function buildWinTokenLookup(matches) {
  const map = new Map();
  for (const match of matches || []) {
    const token = match.meta?.winToken;
    if (!token || typeof token !== "string") continue;
    map.set(token, match);
    if (token.endsWith("W")) {
      map.set(token.replace(/W$/, "L"), match);
    }
  }
  return map;
}

function slotKey(matchId, side) {
  return `${matchId}:${side}`;
}

function inferFeedTokenFromStructure(producer, consumer, side) {
  const token = producer.meta?.winToken;
  if (!token || compareMatchOrder(producer, consumer) >= 0) return null;

  const producerRound = producer.roundIndex ?? 0;
  const consumerRound = consumer.roundIndex ?? 0;
  const producerMatch = producer.matchIndex ?? 0;
  const consumerMatch = consumer.matchIndex ?? 0;

  if (producer.stageKey !== consumer.stageKey || consumerRound !== producerRound + 1) {
    return null;
  }

  // BLAST playoffs: semis keep the group champion on team1 and QF winners on team2.
  if (consumer.stageKey === "blast-playoffs") {
    if (consumerRound === 1 && consumerMatch === producerMatch) {
      return side === "team2" ? token : null;
    }
    if (consumerRound === 2 && consumerMatch === 0) {
      if (side === "team1" && producerMatch === 0) return token;
      if (side === "team2" && producerMatch === 1) return token;
      return null;
    }
    return null;
  }

  if (consumerMatch === producerMatch) {
    return token;
  }

  return null;
}

function inferFeedTokenFromPrior(prior, consumer, side) {
  for (let index = prior.length - 1; index >= 0; index -= 1) {
    const candidate = prior[index];
    const structural = inferFeedTokenFromStructure(candidate, consumer, side);
    if (structural && candidate.meta?.winToken === structural) {
      return candidate.meta.winToken;
    }
  }
  return null;
}

export function buildProgressionFeedMap(matches) {
  const map = new Map();
  const tokenLookup = buildWinTokenLookup(matches);
  const sorted = [...matches].sort(compareMatchOrder);
  const prior = [];

  for (const match of matches) {
    for (const side of ["team1", "team2"]) {
      const value = String(match[side] || "");
      if (TEAM_TOKEN_REGEX.test(value)) {
        map.set(slotKey(match.id, side), value);
      }
    }
  }

  for (const match of sorted) {
    for (const side of ["team1", "team2"]) {
      const key = slotKey(match.id, side);
      if (map.has(key)) continue;

      const value = String(match[side] || "");
      if (!value) continue;

      if (tokenLookup.has(value)) {
        map.set(key, value);
        continue;
      }

      const structuralFeed = inferFeedTokenFromPrior(prior, match, side);
      if (structuralFeed) {
        map.set(key, structuralFeed);
        continue;
      }

      const storedFeed = match.meta?.[`${side}Feed`];
      if (storedFeed && typeof storedFeed === "string") {
        map.set(key, storedFeed);
        continue;
      }

      if (!TEAM_TOKEN_REGEX.test(value)) {
        for (let index = prior.length - 1; index >= 0; index -= 1) {
          const candidate = prior[index];
          if (!candidate?.winner || String(candidate.winner) !== value || !candidate.meta?.winToken) continue;
          const structural = inferFeedTokenFromStructure(candidate, match, side);
          if (structural === candidate.meta.winToken) {
            map.set(key, candidate.meta.winToken);
            break;
          }
        }
      }
    }
    prior.push(match);
  }

  return map;
}

function resetProgressiveSlots(matches, feedMap) {
  return matches.map((match) => {
    const feed1 = feedMap.get(slotKey(match.id, "team1"));
    const feed2 = feedMap.get(slotKey(match.id, "team2"));
    const meta = { ...(match.meta || {}) };

    let team1 = match.team1;
    let team2 = match.team2;

    if (feed1 && TEAM_TOKEN_REGEX.test(feed1)) {
      team1 = feed1;
      meta.team1Feed = feed1;
    }
    if (feed2 && TEAM_TOKEN_REGEX.test(feed2)) {
      team2 = feed2;
      meta.team2Feed = feed2;
    }

    return {
      ...match,
      team1,
      team2,
      meta,
    };
  });
}

export function applyProgression(matches, changedMatch) {
  if (!changedMatch?.winner || !changedMatch.meta?.winToken) {
    return matches;
  }

  const loser = changedMatch.winner === changedMatch.team1 ? changedMatch.team2 : changedMatch.team1;
  const winnerToken = changedMatch.meta.winToken;
  const loserToken = winnerToken.replace(/W$/, "L");

  return matches.map((match) => {
    const next = { ...match, meta: { ...(match.meta || {}) } };

    if (TEAM_TOKEN_REGEX.test(String(next.team1 || "")) && next.team1 === winnerToken) {
      next.team1 = changedMatch.winner;
      next.meta.team1Feed = winnerToken;
    }
    if (TEAM_TOKEN_REGEX.test(String(next.team2 || "")) && next.team2 === winnerToken) {
      next.team2 = changedMatch.winner;
      next.meta.team2Feed = winnerToken;
    }
    if (TEAM_TOKEN_REGEX.test(String(next.team1 || "")) && next.team1 === loserToken) {
      next.team1 = loser;
      next.meta.team1Feed = loserToken;
    }
    if (TEAM_TOKEN_REGEX.test(String(next.team2 || "")) && next.team2 === loserToken) {
      next.team2 = loser;
      next.meta.team2Feed = loserToken;
    }
    return next;
  });
}

export function reapplyAllProgression(matches) {
  if (!matches?.length) return matches || [];

  const feedMap = buildProgressionFeedMap(matches);
  let current = resetProgressiveSlots(matches, feedMap);

  const finished = [...matches]
    .filter((match) => match.winner && match.meta?.winToken)
    .sort(compareMatchOrder);

  for (const finishedMatch of finished) {
    const live = matches.find((match) => match.id === finishedMatch.id);
    if (!live) continue;

    const state = {
      ...current.find((match) => match.id === live.id),
      team1: live.team1,
      team2: live.team2,
      winner: live.winner,
      status: live.status,
      meta: live.meta,
    };

    current = current.map((match) => (match.id === live.id ? state : match));
    current = applyProgression(current, state);
  }

  return current;
}
