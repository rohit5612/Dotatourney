import { AdminGlassPanel } from "./AdminGlassPanel.jsx";
import { useAdminTournament } from "../context/AdminTournamentContext.jsx";

function statusLabel(tournament) {
  if (!tournament) return "No tournament";
  if (tournament.status === "concluded") return "Concluded";
  if (tournament.is_published) return "Published (active)";
  if (tournament.status === "approved") return "Approved";
  return "Draft";
}

function statusClass(tournament) {
  if (!tournament) return "admin-tournament-banner__status--draft";
  if (tournament.status === "concluded") return "admin-tournament-banner__status--concluded";
  if (tournament.is_published) return "admin-tournament-banner__status--published";
  return "admin-tournament-banner__status--draft";
}

export function AdminTournamentBanner({ showSelector = false }) {
  const ctx = useAdminTournament();
  const tournament = ctx?.activeTournament;
  const list = ctx?.tournamentList || [];

  if (!tournament && !showSelector) return null;

  return (
    <AdminGlassPanel className="admin-tournament-banner">
      <div>
        <h2 className="admin-tournament-banner__title">{tournament?.name || "Select a tournament in Setup"}</h2>
        {tournament ? (
          <p className="admin-tournament-banner__meta">Tournament ID: {tournament.id}</p>
        ) : null}
        {showSelector && list.length > 1 ? (
          <select
            className="mt-2 rounded border border-border bg-background/80 px-2 py-1 text-sm"
            value={ctx?.activeTournamentId || ""}
            onChange={(e) => ctx?.selectTournament?.(e.target.value)}
          >
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.status}{t.is_published ? ", live" : ""})
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {tournament ? (
        <span className={`admin-tournament-banner__status ${statusClass(tournament)}`}>{statusLabel(tournament)}</span>
      ) : null}
    </AdminGlassPanel>
  );
}
