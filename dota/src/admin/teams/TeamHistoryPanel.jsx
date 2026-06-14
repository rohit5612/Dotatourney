import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";

export function TeamHistoryPanel({ tournamentId, teamId, teamName }) {
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !tournamentId || !teamId) return;
    api
      .getTeamHistory(tournamentId, teamId)
      .then((payload) => setHistory(payload.history || []))
      .catch(() => setHistory([]));
  }, [open, tournamentId, teamId]);

  if (!tournamentId || !teamId) return null;

  return (
    <AdminGlassPanel subtle className="mt-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span>History — {teamName || "Team"}</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
          {history.map((entry) => (
            <li key={entry.id} className="rounded border border-border/40 bg-background/20 p-2">
              <span className="font-medium text-foreground">{entry.field}</span>: {entry.old_value || "—"} → {entry.new_value || "—"}
              <div className="mt-0.5">
                {entry.changed_by_name || "System"} · {new Date(entry.effective_at).toLocaleString()}
              </div>
            </li>
          ))}
          {!history.length ? <li>No profile changes recorded yet.</li> : null}
        </ul>
      ) : null}
    </AdminGlassPanel>
  );
}
