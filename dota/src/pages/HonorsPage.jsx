import { useMemo, useState } from "react";
import { createId } from "../utils/client.js";
import { honorsToApiPayload, normalizeHonorsAdmin } from "../utils/tournamentHonors.js";
import { playerDisplayName } from "../utils/teamPage.js";
import { AdminGlassPanel } from "../admin/components/AdminGlassPanel.jsx";

function rosterTeams(approvedRoster) {
  if (!approvedRoster?.teams?.length) return [];
  const playersByTeam = new Map();
  for (const link of approvedRoster.teamPlayers || []) {
    if (!playersByTeam.has(link.team_id)) playersByTeam.set(link.team_id, []);
    playersByTeam.get(link.team_id).push(link.player_id);
  }
  const playersById = new Map((approvedRoster.players || []).map((player) => [player.id, player]));
  return approvedRoster.teams.map((team) => ({
    ...team,
    players: (playersByTeam.get(team.id) || [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean),
  }));
}

export function HonorsPage({ setup, setSetup, saveTournament, honorsPreview = null, approvedRoster = null }) {
  const [isSaving, setIsSaving] = useState(false);
  const honors = normalizeHonorsAdmin(setup.tournamentHonors);
  const cards = honors.customCards;
  const isBlast = setup.format === "blast";
  const teams = useMemo(() => rosterTeams(approvedRoster), [approvedRoster]);
  const maxPlacements = honorsPreview?.maxPodiumPlacements || honorsPreview?.placementTeams?.length || 8;

  function patchHonors(patch) {
    setSetup((prev) => ({
      ...prev,
      tournamentHonors: { ...normalizeHonorsAdmin(prev.tournamentHonors), ...patch },
    }));
  }

  function updateCards(nextCards) {
    patchHonors({ customCards: nextCards });
  }

  function updateCard(index, patch) {
    updateCards(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  }

  function updateMvp(patch) {
    patchHonors({
      mvp: { ...(honors.mvp || { prize: "", teamName: "", playerId: "", playerName: "", notes: "" }), ...patch },
    });
  }

  function addCard() {
    updateCards([
      ...cards,
      {
        id: createId(),
        title: "",
        prize: "",
        winnerLabel: "",
        teamName: "",
        playerName: "",
        notes: "",
        sortOrder: cards.length,
      },
    ]);
  }

  function removeCard(index) {
    if (!window.confirm("Remove this honor card?")) return;
    updateCards(cards.filter((_, i) => i !== index));
  }

  const mvpTeam = teams.find((team) => team.name === honors.mvp?.teamName);
  const mvpPlayers = mvpTeam?.players || [];

  async function saveHonors() {
    setIsSaving(true);
    try {
      await saveTournament?.();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <AdminGlassPanel className="space-y-4">
      <section>
        <h2 className="admin-section-title">Tournament honors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how many auto-detected winning teams appear on the Tournament page, landing page, and Teams page. MVP is a dedicated showcase card.
        </p>
        <label className="mt-4 block max-w-xs text-sm">
          <span className="text-muted-foreground">Winning teams to display (1–{Math.max(1, maxPlacements)})</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, maxPlacements)}
            className="mt-1 w-full rounded-md border border-input bg-background p-2"
            value={honors.displayPodiumCount}
            onChange={(event) =>
              patchHonors({
                displayPodiumCount: Math.max(1, Math.min(maxPlacements, Number(event.target.value) || 1)),
              })
            }
          />
        </label>
        {isBlast && honorsPreview?.placementTeams?.length ? (
          <ol className="mt-3 space-y-1 rounded-md border border-border/80 bg-background/80 p-3 text-sm">
            {honorsPreview.placementTeams.map((entry, index) => (
              <li key={`${entry.teamName}-${index}`} className={index >= honors.displayPodiumCount ? "text-muted-foreground" : ""}>
                {index < honors.displayPodiumCount ? "✓ " : "· "}
                #{entry.placement} {entry.role} — {entry.teamName}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Podium teams populate automatically once the BLAST final has a winner.</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-primary/30 bg-card p-4 ring-1 ring-primary/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Featured award</p>
          <h3 className="mt-1 font-serif text-xl">MVP showcase</h3>
          <p className="mt-1 text-sm text-muted-foreground">Pick the team and player — their role and name render on the public MVP card.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Team</span>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={honors.mvp?.teamName || ""}
              onChange={(event) => {
                const teamName = event.target.value;
                updateMvp({ teamName, playerId: "", playerName: "" });
              }}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Player</span>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={honors.mvp?.playerId || ""}
              disabled={!mvpPlayers.length}
              onChange={(event) => {
                const player = mvpPlayers.find((entry) => entry.id === event.target.value);
                updateMvp({
                  playerId: player?.id || "",
                  playerName: player ? playerDisplayName(player) : "",
                });
              }}
            >
              <option value="">Select player</option>
              {mvpPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {playerDisplayName(player)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-muted-foreground">MVP prize</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={honors.mvp?.prize || ""}
              placeholder="₹10,000, exclusive merch bundle…"
              onChange={(event) => updateMvp({ prize: event.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-muted-foreground">Notes (optional)</span>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
              value={honors.mvp?.notes || ""}
              onChange={(event) => updateMvp({ notes: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg">Other winner cards</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={addCard}>
            Add card
          </button>
        </div>
        {cards.length ? (
          cards.map((card, index) => (
            <article key={card.id || index} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-secondary">Custom card {index + 1}</p>
                <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => removeCard(index)}>
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-muted-foreground">Title</span>
                  <input className="mt-1 w-full rounded-md border border-input bg-background p-2" value={card.title} onChange={(e) => updateCard(index, { title: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Prize</span>
                  <input className="mt-1 w-full rounded-md border border-input bg-background p-2" value={card.prize} onChange={(e) => updateCard(index, { prize: e.target.value })} />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-muted-foreground">Display line (optional)</span>
                  <input className="mt-1 w-full rounded-md border border-input bg-background p-2" value={card.winnerLabel} onChange={(e) => updateCard(index, { winnerLabel: e.target.value })} />
                </label>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Optional extra awards beyond MVP and the auto podium.
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => void saveHonors()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save honors"}
        </button>
      </div>
      </AdminGlassPanel>
    </div>
  );
}

export { honorsToApiPayload };
