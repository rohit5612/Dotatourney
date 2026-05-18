import { useMemo, useState } from "react";
import { roles } from "../constants/tournament";

export function TeamsPage({
  teamDraft,
  poolDraft,
  newCaptain,
  setNewCaptain,
  addCaptain,
  assignPlayer,
  autoAssign,
  saveTeams,
  registrations = [],
  addRegistrationPlayer,
  markCaptain,
  updateTeam,
  deleteTeam,
  removePlayerFromTeam,
  rosters = [],
  approvedRoster,
  requiredTeamCount = 0,
  activeRosterId = "",
  isTeamPaneActive = false,
  loadRosterForEditing,
  createNewRosterDraft,
  saveRosterSnapshot,
  renameRoster,
  replaceRosterFromCurrent,
  approveRoster,
  deleteRoster,
}) {
  const [actionMenuTeamId, setActionMenuTeamId] = useState("");
  const [playerModalTeam, setPlayerModalTeam] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [rosterName, setRosterName] = useState("");
  const assignedPlayers = poolDraft.filter((player) => player.teamId).length;
  const unassignedPlayers = poolDraft.length - assignedPlayers;
  const playerModalTeamCount = playerModalTeam ? poolDraft.filter((player) => player.teamId === playerModalTeam.id).length : 0;
  const completeTeams = teamDraft.filter((team) => {
    const teamPlayers = poolDraft.filter((player) => player.teamId === team.id);
    return roles.every((role) => teamPlayers.some((player) => player.role === role));
  }).length;
  const readyRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          registration.paymentStatus === "paid" &&
          registration.registrationStatus === "approved" &&
          !registration.archivedAt,
      ),
    [registrations],
  );

  const availableRegistrations = useMemo(() => {
    return readyRegistrations
      .filter((registration) => {
        const existing = poolDraft.find((player) => player.registrationId === registration.id);
        return !existing?.teamId;
      })
      .filter((registration) => {
        const text = [registration.name, registration.discordHandle, registration.steamName, registration.roles?.join(" "), registration.mmr]
          .join(" ")
          .toLowerCase();
        return !playerSearch || text.includes(playerSearch.toLowerCase());
      });
  }, [readyRegistrations, poolDraft, playerSearch]);

  function addPlayerToTeam(registration, teamId) {
    if (poolDraft.filter((player) => player.teamId === teamId).length >= 5) return;
    const existing = poolDraft.find((player) => player.registrationId === registration.id);
    if (existing) assignPlayer(existing.id, teamId);
    else addRegistrationPlayer?.(registration, teamId);
  }

  function editTeam(team) {
    const nextName = window.prompt("Edit team name", team.name);
    if (nextName?.trim()) updateTeam?.(team.id, { name: nextName.trim() });
    setActionMenuTeamId("");
  }

  function handleTeamLogoUpload(team, file) {
    if (!file || !updateTeam) return;
    const reader = new FileReader();
    reader.onload = () => updateTeam(team.id, { logoUrl: reader.result || "" });
    reader.readAsDataURL(file);
  }

  function confirmDeleteTeam(team) {
    const confirmed = window.confirm(`Delete team "${team.name}"? Assigned players will be moved back to the available pool.`);
    if (confirmed) deleteTeam?.(team.id);
    setActionMenuTeamId("");
  }

  function confirmRemovePlayer(player, team) {
    const confirmed = window.confirm(`Remove ${player.name} from "${team.name}"? They will return to the available pool.`);
    if (confirmed) removePlayerFromTeam?.(player.id);
  }

  function saveNamedRoster() {
    const name = rosterName.trim();
    if (!name) return;
    saveRosterSnapshot?.(name);
    setRosterName("");
  }

  function editRosterName(roster) {
    const nextName = window.prompt("Edit roster name", roster.name);
    if (nextName?.trim()) renameRoster?.(roster.id, nextName.trim());
  }

  function confirmReplaceRoster(roster) {
    const confirmed = window.confirm(`Replace "${roster.name}" with the current teams and players? This roster will need approval again.`);
    if (confirmed) replaceRosterFromCurrent?.(roster.id, roster.name);
  }

  function confirmResaveOpenRoster() {
    const roster = rosters.find((item) => item.id === activeRosterId);
    if (!roster) return;
    const confirmed = window.confirm(`Save the current teams and players back into "${roster.name}"? This will move it back to draft until approved again.`);
    if (confirmed) replaceRosterFromCurrent?.(roster.id, roster.name);
  }

  function confirmApproveRoster(roster) {
    const confirmed = window.confirm(`Approve "${roster.name}" for bracket and schedule generation? This will replace any previously approved roster.`);
    if (confirmed) approveRoster?.(roster.id);
  }

  function confirmDeleteRoster(roster) {
    const confirmed = window.confirm(`Delete roster "${roster.name}"? This cannot be undone.`);
    if (confirmed) deleteRoster?.(roster.id, roster.name);
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Teams built</div>
          <div className="mt-1 text-2xl font-serif">{teamDraft.length}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Assigned players</div>
          <div className="mt-1 text-2xl font-serif">{assignedPlayers}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Unassigned players</div>
          <div className="mt-1 text-2xl font-serif">{unassignedPlayers}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Role-complete teams</div>
          <div className="mt-1 text-2xl font-serif">{completeTeams}</div>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg">Teams</h3>
            <p className="text-sm text-muted-foreground">
              {isTeamPaneActive
                ? "Each card is one team. Add up to 5 registered players and mark one assigned player as captain."
                : "Select a saved roster below or start a new roster to show teams here."}
            </p>
          </div>
          {isTeamPaneActive ? (
            <div className="flex flex-wrap gap-2">
              <input placeholder="Team name" className="rounded-md border border-input bg-background p-2" value={newCaptain.team} onChange={(event) => setNewCaptain((prev) => ({ ...prev, team: event.target.value }))} />
              <button type="button" className="btn btn-primary" onClick={addCaptain}>
                Add team
              </button>
              <button type="button" className="btn btn-outline" onClick={autoAssign}>
                Auto assign
              </button>
              <button type="button" className="btn btn-primary" onClick={saveTeams}>
                Save teams
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={createNewRosterDraft}>
              Create new roster
            </button>
          )}
        </div>

        {isTeamPaneActive ? (
          <div className="grid gap-6 xl:grid-cols-2">
          {teamDraft.map((team) => {
            const teamPlayers = poolDraft.filter((player) => player.teamId === team.id);
            const missingRoles = roles.filter((role) => !teamPlayers.some((player) => player.role === role));
            const roleCoverageText = missingRoles.length ? `Missing: ${missingRoles.join(", ")}` : "All roles covered";
            const logoUrl = team.logoUrl || team.logo_url || "";
            const initials = (team.abbr || team.name || "?")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 3)
              .toUpperCase();

            return (
              <div key={team.id} className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-inner">
                      {logoUrl ? (
                        <img src={logoUrl} alt="" className="h-full w-full object-contain p-2" />
                      ) : (
                        <span className="font-serif text-2xl font-bold text-primary/75">{initials}</span>
                      )}
                    </div>
                    <label className="btn btn-outline btn-xs cursor-pointer">
                      {logoUrl ? "Change logo" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleTeamLogoUpload(team, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {logoUrl ? (
                      <button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => updateTeam?.(team.id, { logoUrl: "" })}>
                        Remove logo
                      </button>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-serif text-xl font-semibold tracking-tight">{team.name}</h4>
                    <div className="mt-1 text-sm text-muted-foreground">{teamPlayers.length}/5 players assigned</div>
                    <div className="mt-2 inline-flex cursor-help rounded border border-border px-2 py-1 text-xs text-secondary" title={roleCoverageText}>
                      Role coverage
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActionMenuTeamId((prev) => (prev === team.id ? "" : team.id))}
                    >
                      Actions
                    </button>
                    {actionMenuTeamId === team.id ? (
                      <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-border bg-card p-1 shadow-xl">
                        <button
                          type="button"
                          className="btn-menu"
                          onClick={() => {
                            setPlayerSearch("");
                            setActionMenuTeamId("");
                            setPlayerModalTeam(team);
                          }}
                        >
                          Add players
                        </button>
                        <button type="button" className="btn-menu" onClick={() => editTeam(team)}>
                          Edit team
                        </button>
                        <button type="button" className="btn-menu text-destructive hover:text-destructive" onClick={() => confirmDeleteTeam(team)}>
                          Delete team
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {teamPlayers.map((player) => (
                    <div key={player.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {player.name}
                            {player.isCaptain ? <span className="ml-1.5 font-semibold text-primary">(C)</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(player.roles?.length ? player.roles : [player.role]).join(", ")}
                            {player.mmr ? ` - ${player.mmr} MMR` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input type="checkbox" checked={Boolean(player.isCaptain)} onChange={(event) => markCaptain?.(player.id, event.target.checked)} />
                            Captain
                          </label>
                          <button
                            type="button"
                            className="btn btn-destructive-outline btn-xs"
                            onClick={() => confirmRemovePlayer(player, team)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!teamPlayers.length ? <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No players assigned yet.</p> : null}
                </div>
                  </div>
                </div>
              </div>
            );
          })}
            {!teamDraft.length ? <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">This roster is empty. Add a team to begin.</p> : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
            No roster is open. Pick an approved/draft roster below, or create a new one.
          </div>
        )}
      </section>

      {isTeamPaneActive ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <h3 className="font-serif text-lg">Save roster</h3>
            <p className="text-sm text-muted-foreground">Save the teams above under a roster name before approving.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeRosterId ? (
              <button type="button" className="btn btn-outline" onClick={confirmResaveOpenRoster}>
                Resave open roster
              </button>
            ) : null}
            <input
              placeholder="Roster name"
              className="rounded-md border border-input bg-background p-2"
              value={rosterName}
              onChange={(event) => setRosterName(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!rosterName.trim() || !teamDraft.length}
              onClick={saveNamedRoster}
            >
              Save named roster
            </button>
          </div>
        </section>
      ) : null}

      {playerModalTeam ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg">Add players to {playerModalTeam.name}</h3>
                <p className="text-sm text-muted-foreground">Search paid and approved registered players. Players already assigned to a team are hidden.</p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPlayerSearch("");
                  setPlayerModalTeam(null);
                }}
              >
                Close
              </button>
            </div>
            <input
              className="w-full rounded-md border border-input bg-background p-2"
              placeholder="Search by name, Discord, Steam, role, or MMR"
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-2">
              {availableRegistrations.map((registration) => (
                <div key={registration.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
                  <div>
                    <div className="font-medium">{registration.name}</div>
                    <div className="text-muted-foreground">{registration.roles?.join(", ")} - {registration.mmr || "MMR TBA"}</div>
                    <div className="text-muted-foreground">{registration.discordHandle || registration.steamName}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={playerModalTeamCount >= 5}
                    onClick={() => addPlayerToTeam(registration, playerModalTeam.id)}
                  >
                    {playerModalTeamCount >= 5 ? "Full" : "Add"}
                  </button>
                </div>
              ))}
              {!availableRegistrations.length ? <p className="text-sm text-muted-foreground">No available registered players match this search.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg">Tournament approved roster</h3>
            <p className="text-sm text-muted-foreground">
              Save the current teams under a name, then approve one roster for bracket and schedule generation.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={createNewRosterDraft}>
            New roster
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {rosters.map((roster) => {
            const hasRequiredTeams = !requiredTeamCount || roster.teamCount === requiredTeamCount;
            return (
              <div
                key={roster.id}
                role="button"
                tabIndex={0}
                className={`rounded-lg border p-3 text-left transition hover:border-primary hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring ${
                  activeRosterId === roster.id ? "border-primary bg-background" : "border-border bg-background"
                }`}
                onClick={() => loadRosterForEditing?.(roster.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    loadRosterForEditing?.(roster.id);
                  }
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{roster.name}</h4>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${roster.status === "approved" ? "border-secondary text-secondary" : "border-border text-muted-foreground"}`}>
                        {roster.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {roster.teamCount} teams, {roster.assignedPlayerCount}/{roster.playerCount} players assigned
                    </p>
                    {!hasRequiredTeams ? (
                      <p className="mt-1 text-xs text-destructive">Needs exactly {requiredTeamCount} teams before approval.</p>
                    ) : null}
                    {roster.approvedAt ? <p className="text-xs text-muted-foreground">Approved {new Date(roster.approvedAt).toLocaleString()}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        editRosterName(roster);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmReplaceRoster(roster);
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="btn btn-destructive-outline btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmDeleteRoster(roster);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={roster.status === "approved" || !hasRequiredTeams}
                      className="btn btn-primary btn-sm"
                      title={!hasRequiredTeams ? `Roster must have exactly ${requiredTeamCount} teams before approval` : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmApproveRoster(roster);
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!rosters.length ? <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No saved roster drafts yet.</p> : null}
        </div>

        {approvedRoster ? (
          <div className="rounded-lg border border-secondary/50 bg-background p-3">
            <h4 className="font-medium text-secondary">Approved roster: {approvedRoster.name}</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {approvedRoster.teams?.map((team) => {
                const playerIds = new Set((approvedRoster.teamPlayers || []).filter((record) => record.team_id === team.id).map((record) => record.player_id));
                const players = (approvedRoster.players || []).filter((player) => playerIds.has(player.id));
                return (
                  <div key={team.id} className="rounded-md border border-border p-2 text-sm">
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-muted-foreground">{players.map((player) => player.name).join(", ") || "No players assigned"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No roster is approved yet. Approve one before generating a live tournament bracket.
          </p>
        )}
      </section>

      <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        Pro tip: finalize at least one player per role before lock-in. This reduces imbalance and improves draft integrity in elimination formats.
      </div>
    </>
  );
}
