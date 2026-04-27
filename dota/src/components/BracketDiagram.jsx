import { useState } from "react";

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
                    clearMatchDraft={(matchId) =>
                      setScores?.((prev) => {
                        if (!prev?.[matchId]) return prev;
                        const next = { ...prev };
                        delete next[matchId];
                        return next;
                      })
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

function describeBracketToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const upperMatch = text.match(/^U(\d+)M(\d+)([WL])$/);
  if (upperMatch) {
    return `${upperMatch[3] === "W" ? "Winner" : "Loser"} of Upper bracket round ${upperMatch[1]}, match ${upperMatch[2]}.`;
  }

  const lowerMatch = text.match(/^L(\d+)M(\d+)([WL])$/);
  if (lowerMatch) {
    return `${lowerMatch[3] === "W" ? "Winner" : "Loser"} of Lower bracket round ${lowerMatch[1]}, match ${lowerMatch[2]}.`;
  }

  const roundMatch = text.match(/^R(\d+)M(\d+)([WL])$/);
  if (roundMatch) {
    return `${roundMatch[3] === "W" ? "Winner" : "Loser"} of round ${roundMatch[1]}, match ${roundMatch[2]}.`;
  }

  const gslSlot = text.match(/^G([A-Z])(\d)$/);
  if (gslSlot) return `Group ${gslSlot[1]} seed #${gslSlot[2]} after group matches.`;

  const leagueSlot = text.match(/^League #(\d+)$/);
  if (leagueSlot) return `League standings seed #${leagueSlot[1]} after round robin matches.`;

  const swissSlot = text.match(/^Swiss #(\d+)$/);
  if (swissSlot) return `Swiss standings seed #${swissSlot[1]} after Swiss rounds.`;

  const groupSlot = text.match(/^Group ([A-Z]) #(\d+)$/);
  if (groupSlot) return `Group ${groupSlot[1]} seed #${groupSlot[2]} after group-stage standings.`;

  const namedSlots = {
    UBW: "Upper bracket winner.",
    UBL: "Upper bracket final loser.",
    LBW: "Lower bracket winner.",
    HUF: "Hybrid upper final winner.",
    HLF: "Hybrid lower final winner.",
    CHAMPION: "Tournament champion slot.",
  };
  if (namedSlots[text]) return namedSlots[text];

  if (/^[A-Z0-9_]+$/.test(text)) return "Auto-filled bracket placeholder. It will be replaced once earlier matches are completed.";
  return "";
}

function splitMetaScore(meta) {
  const raw = meta?.score;
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split("-").map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => p === "")) return null;
  return { a: parts[0], b: parts[1] };
}

function baseSideScore(match, split, side) {
  if (side === 1) {
    if (match.meta?.team1Score != null && match.meta.team1Score !== "") return String(match.meta.team1Score);
    return split?.a ?? "";
  }
  if (match.meta?.team2Score != null && match.meta.team2Score !== "") return String(match.meta.team2Score);
  return split?.b ?? "";
}

/** While editing, respect draft only if the key was set; empty string in draft is intentional. Avoids "" from stale state overriding server scores. */
function scoreLineValue(scoreDraft, key, base, isEditing) {
  if (!isEditing) return base;
  if (scoreDraft && Object.prototype.hasOwnProperty.call(scoreDraft, key)) return String(scoreDraft[key] ?? "");
  return base;
}

function MatchNode({ match, editable, scoreDraft, setScoreDraft, clearMatchDraft, submitResult, updateMatch }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const split = splitMetaScore(match.meta);
  const base1 = baseSideScore(match, split, 1);
  const base2 = baseSideScore(match, split, 2);
  const editing = Boolean(editable && isEditing);
  const team1Score = scoreLineValue(scoreDraft, "team1Score", base1, editing);
  const team2Score = scoreLineValue(scoreDraft, "team2Score", base2, editing);
  const slotValue = match.slotAt ? new Date(match.slotAt).toISOString().slice(0, 16) : "";
  const seriesLabel = String(match.meta?.seriesType || "").toUpperCase();
  const requiredWins = Math.max(1, Math.ceil((Number(seriesLabel.replace("BO", "")) || 1) / 2));
  const leftScore = team1Score === "" ? null : Number(team1Score);
  const rightScore = team2Score === "" ? null : Number(team2Score);
  const scoreComplete =
    Number.isFinite(leftScore) &&
    Number.isFinite(rightScore) &&
    leftScore !== rightScore &&
    (leftScore >= requiredWins || rightScore >= requiredWins);
  const scoreWinner = scoreComplete ? (leftScore > rightScore ? match.team1 : match.team2) : "";

  const teamLinesReadOnly = !editable || !isEditing;
  const lockedBodyClass = editable && !isEditing ? "opacity-60" : "";

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

  async function saveScore() {
    if (scoreComplete) {
      if (!submitResult) return;
    } else if (!updateMatch) {
      return;
    }
    setSaving(true);
    try {
      if (scoreComplete) {
        await submitResult(match.id, scorePayload(scoreWinner));
      } else {
        await updateMatch(match.id, {
          team1Score: Number.isFinite(leftScore) ? leftScore : null,
          team2Score: Number.isFinite(rightScore) ? rightScore : null,
          score: Number.isFinite(leftScore) && Number.isFinite(rightScore) ? `${leftScore}-${rightScore}` : "",
          status: match.status || "upcoming",
        });
      }
      setIsEditing(false);
      clearMatchDraft?.(match.id);
    } finally {
      setSaving(false);
    }
  }

  async function recordWin(pick) {
    if (!submitResult) return;
    setSaving(true);
    try {
      await submitResult(match.id, scorePayload(pick));
      setIsEditing(false);
      clearMatchDraft?.(match.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-3 shadow-sm ${
        editable && !isEditing ? "border-border/80" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Match {match.matchIndex + 1}</span>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {seriesLabel ? <span className="rounded border border-border px-1.5 py-0.5">{seriesLabel}</span> : null}
          {match.meta?.winToken ? (
            <span
              className="rounded border border-border px-1.5 py-0.5"
              title={`${match.meta.winToken}: winner of this match feeds into the next bracket slot.`}
            >
              {match.meta.winToken}
            </span>
          ) : null}
          <span className="capitalize">{match.status || "upcoming"}</span>
          {editable && !isEditing ? (
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          ) : null}
        </span>
      </div>
      <div className={lockedBodyClass}>
        <TeamLine
          name={match.team1}
          winner={match.winner === match.team1}
          editable={!teamLinesReadOnly}
          score={teamLinesReadOnly ? base1 : team1Score}
          onScoreChange={(value) => setScoreDraft?.({ team1Score: value })}
          onWin={() => void recordWin(match.team1)}
        />
        <TeamLine
          name={match.team2}
          winner={match.winner === match.team2}
          editable={!teamLinesReadOnly}
          score={teamLinesReadOnly ? base2 : team2Score}
          onScoreChange={(value) => setScoreDraft?.({ team2Score: value })}
          onWin={() => void recordWin(match.team2)}
        />
      </div>
      {match.winner ? <div className="mt-2 text-xs text-secondary">Winner: {match.winner}</div> : null}

      {editable && isEditing ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-input bg-background p-1 text-xs"
              value={slotValue}
              disabled={saving}
              onChange={(event) =>
                updateMatch?.(match.id, { slotAt: event.target.value ? new Date(event.target.value).toISOString() : null })
              }
            />
            <select
              className="rounded-md border border-input bg-background p-1 text-xs"
              value={match.status || "upcoming"}
              disabled={saving}
              onChange={(event) => updateMatch?.(match.id, { status: event.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2 text-xs">
            <span className="text-muted-foreground">
              {scoreComplete
                ? `${scoreWinner} has completed ${seriesLabel || "the series"}. Saving will advance the bracket.`
                : `Enter first to ${requiredWins} wins, then save score.`}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveScore()} disabled={saving}>
              {saving ? "Saving…" : "Save score"}
            </button>
          </div>
        </div>
      ) : null}
      {editable && !isEditing ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {match.slotAt ? (
            <span>Slot: {new Date(match.slotAt).toLocaleString()}</span>
          ) : (
            <span className="italic">No slot time set</span>
          )}{" "}
          <span className="capitalize">· {match.status || "upcoming"}</span>
        </div>
      ) : null}
    </div>
  );
}

function TeamLine({ name, winner, editable, score, onScoreChange, onWin }) {
  const tokenHelp = describeBracketToken(name);
  return (
    <div
      className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${winner ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
      title={tokenHelp || undefined}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {tokenHelp ? (
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-muted-foreground"
          title={`${name}: ${tokenHelp}`}
          aria-label={`${name}: ${tokenHelp}`}
        >
          ?
        </span>
      ) : null}
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
      ) : (
        <span
          className={`ml-auto min-w-5 shrink-0 text-right text-sm tabular-nums ${
            winner ? "font-semibold text-primary" : "text-muted-foreground"
          }`}
        >
          {score === "" || score == null ? "—" : score}
        </span>
      )}
    </div>
  );
}
