function globalHasContent(global) {
  if (!global) return false;
  const wins = Number(global.wins) || 0;
  const losses = Number(global.losses) || 0;
  return Boolean(
    global.rankLabel ||
      global.rankTier != null ||
      global.mmrEstimate != null ||
      wins + losses > 0 ||
      global.avgKda ||
      global.topHeroes?.length,
  );
}

function leagueStatsHasContent(stats) {
  return Boolean(stats && Number(stats.games) > 0);
}

/** Prefer richer OpenDota payload so refresh/HMR cannot wipe synced stats. */
export function mergePublicPlayerDotaStats(previous, next) {
  if (next == null) return previous ?? next;
  if (previous == null) return next;
  if (!next.available && previous.available) return previous;

  const merged = {
    ...next,
    available: Boolean(next.available || previous.available),
    steam32: next.steam32 ?? previous.steam32,
    lastUpdated: next.lastUpdated || previous.lastUpdated,
  };

  merged.global = globalHasContent(next.global) ? next.global : previous.global ?? next.global;

  const prevLeagues = previous.leagues || [];
  const nextLeagues = next.leagues || [];
  const byKey = new Map();
  for (const entry of prevLeagues) {
    const key = entry?.dotaLeagueId ?? entry?.tournamentSlug;
    if (key != null) byKey.set(key, entry);
  }
  for (const entry of nextLeagues) {
    const key = entry?.dotaLeagueId ?? entry?.tournamentSlug;
    if (key == null) continue;
    const prevEntry = byKey.get(key);
    if (leagueStatsHasContent(entry.stats)) {
      byKey.set(key, entry);
    } else if (prevEntry && leagueStatsHasContent(prevEntry.stats)) {
      byKey.set(key, { ...entry, stats: prevEntry.stats });
    } else {
      byKey.set(key, entry);
    }
  }
  merged.leagues = nextLeagues.length ? [...byKey.values()] : prevLeagues.length ? prevLeagues : nextLeagues;

  merged.matchHistory = next.matchHistory?.length ? next.matchHistory : previous.matchHistory || [];

  return merged;
}
