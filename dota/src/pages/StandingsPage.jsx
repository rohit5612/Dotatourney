import { StandingsTable } from "../components/StandingsTable.jsx";

export function StandingsPage({ standings = [], groupedStandings = [] }) {
  const hasGroups = groupedStandings.length > 0;
  const summaryRows = hasGroups ? groupedStandings.flatMap((group) => group.rows) : standings;
  const topTeam = summaryRows[0];
  const activeCount = summaryRows.filter((entry) => entry.status === "in_progress").length;
  const advancingCount = summaryRows.filter((entry) => entry.status === "advancing").length;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-serif text-lg">Standings</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Current leader</div>
          <div className="mt-1 text-base font-medium">{topTeam?.team || "TBD"}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Advancing</div>
          <div className="mt-1 text-base font-medium text-emerald-700 dark:text-emerald-400">{advancingCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Still in contention</div>
          <div className="mt-1 text-base font-medium">{activeCount}</div>
        </div>
      </div>

      {hasGroups ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groupedStandings.map((group) => (
            <StandingsTable
              key={group.id}
              title={group.label}
              rows={group.rows}
              variant="admin"
              showRank
              showWinPct
              showStatus
            />
          ))}
        </div>
      ) : (
        <StandingsTable
          title="Overall standings"
          rows={standings}
          variant="admin"
          showRank
          showWinPct
          showStatus
        />
      )}

      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Rankings are ordered by wins, then win percentage, then tiebreak score. Group tables reflect BO1 group-stage
        results only.
      </div>
    </div>
  );
}
