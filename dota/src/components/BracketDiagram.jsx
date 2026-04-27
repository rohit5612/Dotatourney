export function BracketDiagram({ matches = [], editable = false, scores = {}, setScores, submitResult, updateMatch }) {
  const rounds = matches.reduce((acc, match) => {
    const key = match.roundIndex ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
  const sortedRounds = Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));

  if (!matches.length) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
        No matches generated yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background p-4">
      <div className="flex min-w-max gap-6 xl:min-w-0">
        {sortedRounds.map(([roundIndex, roundMatches]) => (
          <div key={roundIndex} className="flex w-72 flex-col gap-4 xl:flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Round {Number(roundIndex) + 1}</div>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {roundMatches
                .sort((a, b) => a.matchIndex - b.matchIndex)
                .map((match) => (
                  <MatchNode
                    key={match.id}
                    match={match}
                    editable={editable}
                    scoreDraft={scores[match.id] || {}}
                    setScoreDraft={(patch) =>
                      setScores?.((prev) => ({
                        ...prev,
                        [match.id]: {
                          ...(prev[match.id] || {}),
                          ...patch,
                        },
                      }))
                    }
                    submitResult={submitResult}
                    updateMatch={updateMatch}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchNode({ match, editable, scoreDraft, setScoreDraft, submitResult, updateMatch }) {
  const team1Score = scoreDraft.team1Score ?? match.meta?.team1Score ?? "";
  const team2Score = scoreDraft.team2Score ?? match.meta?.team2Score ?? "";
  const slotValue = match.slotAt ? new Date(match.slotAt).toISOString().slice(0, 16) : "";
  const seriesLabel = String(match.meta?.seriesType || "").toUpperCase();

  function scorePayload(winner) {
    const left = team1Score === "" ? null : Number(team1Score);
    const right = team2Score === "" ? null : Number(team2Score);
    return {
      winner,
      team1Score: Number.isFinite(left) ? left : null,
      team2Score: Number.isFinite(right) ? right : null,
      score: left !== null && right !== null ? `${left}-${right}` : "",
    };
  }

  return (
    <div className="relative rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Match {match.matchIndex + 1}</span>
        <span className="flex items-center gap-2">
          {seriesLabel ? <span className="rounded border border-border px-1.5 py-0.5">{seriesLabel}</span> : null}
          <span className="capitalize">{match.status || "upcoming"}</span>
        </span>
      </div>
      <TeamLine
        name={match.team1}
        winner={match.winner === match.team1}
        editable={editable}
        score={team1Score}
        onScoreChange={(value) => setScoreDraft?.({ team1Score: value })}
        onWin={() => submitResult?.(match.id, scorePayload(match.team1))}
      />
      <TeamLine
        name={match.team2}
        winner={match.winner === match.team2}
        editable={editable}
        score={team2Score}
        onScoreChange={(value) => setScoreDraft?.({ team2Score: value })}
        onWin={() => submitResult?.(match.id, scorePayload(match.team2))}
      />
      {match.winner ? <div className="mt-2 text-xs text-secondary">Winner: {match.winner}</div> : null}
      {match.meta?.score && !editable ? <div className="mt-1 text-xs text-muted-foreground">Score: {match.meta.score}</div> : null}

      {editable ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-input bg-background p-1 text-xs"
              value={slotValue}
              onChange={(event) =>
                updateMatch?.(match.id, { slotAt: event.target.value ? new Date(event.target.value).toISOString() : null })
              }
            />
            <select
              className="rounded-md border border-input bg-background p-1 text-xs"
              value={match.status || "upcoming"}
              onChange={(event) => updateMatch?.(match.id, { status: event.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeamLine({ name, winner, editable, score, onScoreChange, onWin }) {
  return (
    <div className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${winner ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {editable ? (
        <>
          <input
            className="w-12 rounded border border-input bg-card px-1 py-0.5 text-center text-xs"
            type="number"
            min="0"
            value={score}
            onChange={(event) => onScoreChange?.(event.target.value)}
          />
          <button type="button" className="btn btn-outline btn-xs" onClick={onWin}>
            Win
          </button>
        </>
      ) : null}
    </div>
  );
}
