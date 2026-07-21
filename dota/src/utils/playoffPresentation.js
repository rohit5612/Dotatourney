/** Client helpers for legacy 1-based playoff round configs (presentation-only). */

const TEAM_TOKEN_REGEX = /^[A-Z0-9_]+$/;

function isPlayoffStageKey(stageKey) {
  const key = String(stageKey || "");
  return key === "blast-playoffs" || key === "playoffs";
}

function distinctStageRoundIndices(matches, stageKey) {
  return [
    ...new Set(
      (matches || [])
        .filter((match) => match.stageKey === stageKey)
        .map((match) => match.roundIndex ?? 0),
    ),
  ].sort((a, b) => a - b);
}

function stageRoundOrdinal(matches, stageKey, roundIndex) {
  const rounds = distinctStageRoundIndices(matches, stageKey);
  if (!rounds.length) return roundIndex ?? 0;
  const idx = rounds.indexOf(roundIndex ?? 0);
  return idx >= 0 ? idx : roundIndex ?? 0;
}

function canonicalPlayoffWinToken(match, allMatches) {
  const stageKey = match?.stageKey;
  if (!isPlayoffStageKey(stageKey)) return match?.meta?.winToken || null;
  const matchIndex = match.matchIndex ?? 0;
  const ordinal = stageRoundOrdinal(allMatches, stageKey, match.roundIndex ?? 0);
  if (ordinal >= 2) return "CHAMPION";
  if (ordinal === 1) return `SFR1M${matchIndex + 1}W`;
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
  if (map.has(text)) return map.get(text);

  return value;
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
  const presentationKey = side === 1 ? "presentationTeam1" : "presentationTeam2";
  if (match?.meta?.[presentationKey]) return match.meta[presentationKey];
  if (!allMatches?.length) return raw;
  return resolvePlayoffSlotDisplay(raw, match, side === 1 ? "team1" : "team2", allMatches);
}
