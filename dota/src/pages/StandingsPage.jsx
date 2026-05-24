import { blastBracketUsesGroupRanksOnly } from "../constants/tournament.js";
import { StandingsTable } from "../components/StandingsTable.jsx";

export function StandingsPage({ standings = [], groupedStandings = [], format, teamCount = 0 }) {
  const hasGroups = groupedStandings.length > 0;
  const isBlast = format === "blast";
  const groupRankBracket = isBlast && blastBracketUsesGroupRanksOnly(teamCount);
  const showGlobalBlast = isBlast && hasGroups && standings.length > 0 && !groupRankBracket;

  const groupLeaders = hasGroups
    ? groupedStandings.map((group) => group.rows?.[0]).filter(Boolean)
    : [];
  const summaryRows = showGlobalBlast
    ? standings
    : hasGroups
      ? groupedStandings.flatMap((group) => group.rows)
      : standings;

  const advancingCount = hasGroups
    ? groupedStandings.reduce((sum, group) => sum + group.rows.filter((entry) => entry.status === "advancing").length, 0)
    : summaryRows.filter((entry) => entry.status === "advancing").length;
  const activeCount = hasGroups
    ? groupedStandings.reduce((sum, group) => sum + group.rows.filter((entry) => entry.status === "in_progress").length, 0)
    : summaryRows.filter((entry) => entry.status === "in_progress").length;

  const leaderLabel = showGlobalBlast
    ? "Global BO1 leader"
    : groupRankBracket && groupLeaders.length
      ? "Group leaders"
      : "Current leader";

  const leaderValue =
    groupRankBracket && groupLeaders.length
      ? groupLeaders.map((row) => row.team).join(" · ")
      : summaryRows[0]?.team || "TBD";

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-serif text-lg">Standings</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{leaderLabel}</div>
          <div className="mt-1 text-base font-medium">{leaderValue}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Advancing (group #1 → semis)</div>
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

      {showGlobalBlast ? (
        <StandingsTable
          title="Global ranking (BO1 group stage)"
          rows={standings}
          variant="admin"
          showRank
          showWinPct
          showStatus
        />
      ) : null}

      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        {isBlast ? (
          groupRankBracket ? (
            <>
              Bracket seeding (Last Chance, Play-In, semifinals) uses in-group rank only — Group A #1–#6 and Group B
              #1–#6 from the tables above. Group tables: wins, mini-league head-to-head, then Neustadtl. Playoff and
              qualifier results are excluded.
            </>
          ) : (
            <>
              Group tables use BO1 group-stage matches only (wins, head-to-head, Neustadtl). Global ranking merges both
              groups for tiered side-bracket slots (11+ teams). Playoff, Play-In, and Last Chance results are excluded
              from win rate and group standings.
            </>
          )
        ) : (
          <>Rankings are ordered by wins, then win percentage, then tiebreak score.</>
        )}
      </div>
    </div>
  );
}
