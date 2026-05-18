/** @param {{ title: string, rows?: Array<{ team: string, wins?: number, losses?: number, played?: number, winPct?: number, status?: string }>, variant?: 'admin' | 'compact', showRank?: boolean, showWinPct?: boolean, showStatus?: boolean }} props */
export function StandingsTable({
  title,
  rows = [],
  variant = "compact",
  showRank = false,
  showWinPct = false,
  showStatus = false,
}) {
  if (variant === "admin") {
    return (
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="border-b border-border bg-card/50 px-3 py-2 font-medium">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                {showRank ? <th className="p-2">Rank</th> : null}
                <th className="p-2">Team</th>
                <th className="p-2 text-emerald-700 dark:text-emerald-400">W</th>
                <th className="p-2 text-red-700 dark:text-red-400">L</th>
                {showWinPct ? <th className="p-2">Win%</th> : null}
                {showStatus ? <th className="p-2">Status</th> : null}
                {!showWinPct && !showStatus ? <th className="p-2">P</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.team} className="border-b border-border last:border-none">
                  {showRank ? <td className="p-2 text-muted-foreground">{index + 1}</td> : null}
                  <td className="p-2 font-medium">{row.team}</td>
                  <td className="standings-cell-wins p-2">{row.wins ?? 0}</td>
                  <td className="standings-cell-losses p-2">{row.losses ?? 0}</td>
                  {showWinPct ? (
                    <td className="p-2">{Math.round((row.winPct ?? 0) * 100)}%</td>
                  ) : null}
                  {showStatus ? <td className="p-2 capitalize">{String(row.status || "").replace("_", " ")}</td> : null}
                  {!showWinPct && !showStatus ? <td className="p-2">{row.played ?? 0}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">No results yet.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2 font-medium">{title}</div>
      <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Team</span>
        <span className="text-emerald-700 dark:text-emerald-400">W</span>
        <span className="text-red-700 dark:text-red-400">L</span>
        <span>P</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.team}
          className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 border-t border-border px-3 py-2 text-sm"
        >
          <span className="truncate font-medium">{row.team}</span>
          <span className="standings-cell-wins">{row.wins ?? 0}</span>
          <span className="standings-cell-losses">{row.losses ?? 0}</span>
          <span>{row.played ?? 0}</span>
        </div>
      ))}
      {!rows.length ? <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">No results yet.</p> : null}
    </div>
  );
}
