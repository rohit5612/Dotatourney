import { useMemo, useState } from "react";

export function SchedulePage({ state, saveSchedule, saveCustomSchedule }) {
  const [draft, setDraft] = useState([]);
  const liveCount = (state?.schedule || []).filter((slot) => slot.status === "live").length;
  const upcomingCount = (state?.schedule || []).filter((slot) => slot.status === "upcoming").length;
  const finishedCount = (state?.schedule || []).filter((slot) => slot.status === "finished").length;
  const editableSchedule = useMemo(() => {
    if (draft.length) return draft;
    return (state?.matches || []).map((match) => {
      const slot = state?.schedule?.find((entry) => entry.matchId === match.id);
      return {
        id: slot?.id,
        matchId: match.id,
        startAt: slot?.startAt
          ? new Date(slot.startAt).toISOString().slice(0, 16)
          : match.slotAt
            ? new Date(match.slotAt).toISOString().slice(0, 16)
            : "",
        stream: slot?.stream || "Main",
        status: slot?.status || match.status || "upcoming",
        notes: slot?.notes || "",
      };
    });
  }, [draft, state]);

  function updateSlot(matchId, patch) {
    setDraft((prev) => {
      const base = prev.length ? prev : editableSchedule;
      return base.map((slot) => (slot.matchId === matchId ? { ...slot, ...patch } : slot));
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg">Schedule</h2>
        <button type="button" className="btn btn-primary" onClick={saveSchedule}>
          Build suggested schedule
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Live</div>
          <div className="mt-1 text-lg font-serif">{liveCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming</div>
          <div className="mt-1 text-lg font-serif">{upcomingCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Finished</div>
          <div className="mt-1 text-lg font-serif">{finishedCount}</div>
        </div>
      </div>
      <div className="space-y-2">
        {editableSchedule.map((slot) => {
          const match = state?.matches?.find((entry) => entry.id === slot.matchId);
          return (
            <div key={slot.matchId} className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr]">
              <div className="font-medium">{match ? `${match.team1} vs ${match.team2}` : slot.matchId}</div>
              <input type="datetime-local" className="rounded-md border border-input bg-card p-1" value={slot.startAt} onChange={(event) => updateSlot(slot.matchId, { startAt: event.target.value })} />
              <input className="rounded-md border border-input bg-card p-1" value={slot.stream} onChange={(event) => updateSlot(slot.matchId, { stream: event.target.value })} />
              <select className="rounded-md border border-input bg-card p-1 capitalize" value={slot.status} onChange={(event) => updateSlot(slot.matchId, { status: event.target.value })}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="finished">Finished</option>
              </select>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() =>
          saveCustomSchedule(
            editableSchedule
              .filter((slot) => slot.startAt)
              .map((slot) => ({ ...slot, startAt: new Date(slot.startAt).toISOString() })),
          )
        }
      >
        Save schedule edits
      </button>
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Scheduling tip: keep round transitions on a 10-15 minute buffer to absorb pauses, draft delays, and stream handoffs.
      </div>
    </div>
  );
}
