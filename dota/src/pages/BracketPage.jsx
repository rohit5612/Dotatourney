import { useState } from "react";

export function BracketPage({ state, activeTab, setActiveTab, groupedMatches, submitResult, updateMatch }) {
  const [scores, setScores] = useState({});
  const totalMatches = (state?.matches || []).length;
  const completedMatches = (state?.matches || []).filter((match) => match.winner).length;
  const completionPct = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg">Bracket</h2>
        <div className="text-sm text-muted-foreground">
          {completedMatches}/{totalMatches} completed ({completionPct}%)
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
      </div>
      <div className="flex gap-2">
        {(state?.tabs || []).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md border px-3 py-1 text-sm ${activeTab === tab.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Record winners to auto-propagate teams into downstream matches. Use tabs to manage upper/lower/finals or stage-specific group brackets.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(groupedMatches[activeTab] || []).map((match) => (
          <div key={match.id} className="rounded-md border border-border bg-background p-3">
            <div className="text-sm text-muted-foreground">Round {match.roundIndex + 1}</div>
            <div className="mt-1 font-medium">{match.team1} vs {match.team2}</div>
            <div className="mt-2 flex gap-2">
              <input
                className="w-full rounded-md border border-input bg-card p-1 text-xs"
                placeholder="Score, e.g. 2-1"
                value={scores[match.id] ?? match.meta?.score ?? ""}
                onChange={(event) => setScores((prev) => ({ ...prev, [match.id]: event.target.value }))}
              />
              <select
                className="rounded-md border border-input bg-card p-1 text-xs"
                value={match.status || "upcoming"}
                onChange={(event) => updateMatch?.(match.id, { status: event.target.value })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="finished">Finished</option>
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => submitResult(match.id, { winner: match.team1, score: scores[match.id] ?? match.meta?.score ?? "" })}>
                {match.team1} wins
              </button>
              <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => submitResult(match.id, { winner: match.team2, score: scores[match.id] ?? match.meta?.score ?? "" })}>
                {match.team2} wins
              </button>
            </div>
            {match.winner ? <div className="mt-2 text-sm text-secondary">Winner: {match.winner}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
