import { roles } from "../constants/tournament";

export function TeamsPage({
  teamDraft,
  poolDraft,
  newCaptain,
  setNewCaptain,
  newPlayer,
  setNewPlayer,
  addCaptain,
  addPoolPlayer,
  assignPlayer,
  autoAssign,
  saveTeams,
  registrations = [],
  addRegistrationPlayer,
  markCaptain,
}) {
  const assignedPlayers = poolDraft.filter((player) => player.teamId).length;
  const unassignedPlayers = poolDraft.length - assignedPlayers;
  const completeTeams = teamDraft.filter((team) => {
    const teamPlayers = poolDraft.filter((player) => player.teamId === team.id);
    return roles.every((role) => teamPlayers.some((player) => player.role === role));
  }).length;

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="font-serif text-lg">Captains and teams</h3>
          <div className="flex gap-2">
            <input placeholder="Captain" className="w-full rounded-md border border-input bg-background p-2" value={newCaptain.captain} onChange={(event) => setNewCaptain((prev) => ({ ...prev, captain: event.target.value }))} />
            <input placeholder="Team name" className="w-full rounded-md border border-input bg-background p-2" value={newCaptain.team} onChange={(event) => setNewCaptain((prev) => ({ ...prev, team: event.target.value }))} />
            <button type="button" className="rounded-md bg-primary px-3 text-primary-foreground" onClick={addCaptain}>
              Add
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {teamDraft.map((team) => (
              <li key={team.id} className="rounded-md border border-border p-2">
                <span className="font-medium">{team.name}</span> - {team.captain}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="font-serif text-lg">Player pool</h3>
          <div className="flex gap-2">
            <input placeholder="Player name" className="w-full rounded-md border border-input bg-background p-2" value={newPlayer.name} onChange={(event) => setNewPlayer((prev) => ({ ...prev, name: event.target.value }))} />
            <select className="rounded-md border border-input bg-background p-2" value={newPlayer.role} onChange={(event) => setNewPlayer((prev) => ({ ...prev, role: event.target.value }))}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button type="button" className="rounded-md bg-primary px-3 text-primary-foreground" onClick={addPoolPlayer}>
              Add
            </button>
          </div>
          <div className="space-y-2">
            {poolDraft.map((player) => (
              <div key={player.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <span className="w-44">{player.name}</span>
                <span className="w-44 text-muted-foreground">
                  {(player.roles?.length ? player.roles : [player.role]).join(", ")}
                  {player.mmr ? ` - ${player.mmr} MMR` : ""}
                </span>
                <select className="rounded-md border border-input bg-background p-1" value={player.teamId || ""} onChange={(event) => assignPlayer(player.id, event.target.value || null)}>
                  <option value="">Unassigned</option>
                  {teamDraft.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={Boolean(player.isCaptain)} onChange={(event) => markCaptain?.(player.id, event.target.checked)} />
                  Captain
                </label>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-md border border-border px-3 py-2" onClick={autoAssign}>
              Auto assign (role aware)
            </button>
            <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={saveTeams}>
              Save teams
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg">Approved registrations ready for teams</h3>
        <p className="mb-3 text-sm text-muted-foreground">Only paid and approved registrations should be added to the player pool.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {registrations
            .filter((registration) => registration.paymentStatus === "paid" && registration.registrationStatus === "approved")
            .map((registration) => {
              const alreadyAdded = poolDraft.some((player) => player.registrationId === registration.id);
              return (
                <div key={registration.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-sm">
                  <div>
                    <div className="font-medium">{registration.name}</div>
                    <div className="text-muted-foreground">{registration.roles?.join(", ")} - {registration.mmr || "MMR TBA"}</div>
                  </div>
                  <button type="button" className="rounded-md border border-border px-3 py-1 disabled:opacity-50" disabled={alreadyAdded} onClick={() => addRegistrationPlayer?.(registration)}>
                    {alreadyAdded ? "Added" : "Add to pool"}
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {teamDraft.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 font-serif text-lg">Role coverage checks</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {teamDraft.map((team) => {
              const teamPlayers = poolDraft.filter((player) => player.teamId === team.id);
              const missingRoles = roles.filter((role) => !teamPlayers.some((player) => player.role === role));
              return (
                <div key={team.id} className="rounded-md border border-border bg-background p-2 text-sm">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-muted-foreground">
                    {missingRoles.length ? `Missing: ${missingRoles.join(", ")}` : "All roles covered"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        Pro tip: finalize at least one player per role before lock-in. This reduces imbalance and improves draft integrity in elimination formats.
      </div>
    </>
  );
}
