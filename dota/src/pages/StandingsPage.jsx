export function StandingsPage({ standings }) {
  const topTeam = standings?.[0];
  const activeCount = (standings || []).filter((entry) => entry.status === "in_progress").length;
  const advancingCount = (standings || []).filter((entry) => entry.status === "advancing").length;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-serif text-lg">Standings</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Current leader</div>
          <div className="mt-1 text-base font-medium">{topTeam?.team || "TBD"}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Advancing</div>
          <div className="mt-1 text-base font-medium">{advancingCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Still in contention</div>
          <div className="mt-1 text-base font-medium">{activeCount}</div>
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-2">Rank</th>
            <th className="p-2">Team</th>
            <th className="p-2">W</th>
            <th className="p-2">L</th>
            <th className="p-2">Win%</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(standings || []).map((entry, index) => (
            <tr key={entry.team} className="border-b border-border last:border-none">
              <td className="p-2">{index + 1}</td>
              <td className="p-2 font-medium">{entry.team}</td>
              <td className="p-2">{entry.wins}</td>
              <td className="p-2">{entry.losses}</td>
              <td className="p-2">{Math.round(entry.winPct * 100)}%</td>
              <td className="p-2 capitalize">{entry.status.replace("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Rankings are ordered by wins, then win percentage, then tiebreak score. This gives stable live placement even before all matches are completed.
      </div>
    </div>
  );
}
