/**
 * Heuristics for Steam profiles that do not expose public match history on OpenDota.
 * Used to skip expensive league match fetches that cannot succeed.
 */

function totalsGameCount(totals) {
  if (!Array.isArray(totals)) return 0;
  const kills = totals.find((row) => row?.field === "kills");
  const n = Number(kills?.n) || 0;
  return n > 0 ? n : 0;
}

/** @param {{ win?: number, lose?: number }} wl */
export function inferMatchHistoryRestricted(wl, heroes, totals) {
  const wins = Number(wl?.win) || 0;
  const losses = Number(wl?.lose) || 0;
  if (wins + losses > 0) return false;

  const heroGames = (heroes || []).reduce((sum, row) => sum + (Number(row?.games) || 0), 0);
  if (heroGames > 0) return false;

  if (totalsGameCount(totals) > 0) return false;

  return true;
}

export function leagueSnapshotIsSettled(payload) {
  if (!payload || payload.verifiedLeague !== true) return false;
  if (payload.emptyLeagueSync === true) return true;
  const rawLen = Array.isArray(payload.raw) ? payload.raw.length : 0;
  const idLen = Array.isArray(payload.matchIds) ? payload.matchIds.length : 0;
  return rawLen > 0 || idLen > 0;
}
