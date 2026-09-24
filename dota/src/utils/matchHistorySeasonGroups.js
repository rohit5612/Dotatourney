export function groupMatchesBySeason(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row.seasonNumber ?? row.seasonSlug ?? row.tournamentSlug ?? "other");
    if (!map.has(key)) {
      map.set(key, {
        key,
        seasonNumber: row.seasonNumber,
        seasonSlug: row.seasonSlug,
        tournamentName: row.tournamentName,
        rows: [],
      });
    }
    map.get(key).rows.push(row);
  }
  return [...map.values()].sort((a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
}

export function seasonGroupLabel(group) {
  if (group.seasonNumber != null) return `Season ${group.seasonNumber}`;
  if (group.seasonSlug) return group.seasonSlug;
  return group.tournamentName || "Circuit";
}

export function enrichMatchRowsWithDota(rows, dotaByMatchId) {
  if (!dotaByMatchId?.size) return rows || [];
  return (rows || []).map((row) => {
    const extra = dotaByMatchId.get(String(row.matchId));
    return extra
      ? { ...row, dotaGames: extra.dotaGames, dotaMatchIds: extra.dotaMatchIds }
      : row;
  });
}

export function summarizeSeasonRows(rows) {
  let wins = 0;
  let losses = 0;
  let lastAt = null;
  for (const row of rows || []) {
    if (row.won === true) wins += 1;
    else if (row.won === false) losses += 1;
    if (row.startAt) {
      const t = new Date(row.startAt).getTime();
      if (!lastAt || t > lastAt) lastAt = t;
    }
  }
  return {
    wins,
    losses,
    total: rows?.length ?? 0,
    lastAt: lastAt ? new Date(lastAt) : null,
  };
}
