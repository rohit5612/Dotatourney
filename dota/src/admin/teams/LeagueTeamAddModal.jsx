import { useMemo, useState } from "react";
import { TEAM_LOGO_CATALOG } from "../../constants/teamLogos.js";
import { TeamsPanelModal } from "./TeamsPanelModal.jsx";

function abbrFromName(name) {
  return String(name || "")
    .split(" ")
    .map((word) => word[0] || "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function LeagueTeamAddModal({
  open,
  onClose,
  leagueTeams = [],
  onSelectExisting,
  onCreateNew,
  busy = false,
}) {
  const [mode, setMode] = useState("existing");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    abbr: "",
    logoUrl: "",
    accentColor: "#e9a84a",
    tagline: "",
    lore: "",
    status: "active",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leagueTeams;
    return leagueTeams.filter((team) => {
      const hay = `${team.name} ${team.slug} ${(team.seasonsPlayed || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [leagueTeams, search]);

  function resetAndClose() {
    setMode("existing");
    setSearch("");
    setForm({
      name: "",
      abbr: "",
      logoUrl: "",
      accentColor: "#e9a84a",
      tagline: "",
      lore: "",
      status: "active",
    });
    onClose?.();
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    await onCreateNew?.({
      ...form,
      name: form.name.trim(),
      abbr: form.abbr.trim() || abbrFromName(form.name),
    });
    resetAndClose();
  }

  return (
    <TeamsPanelModal
      open={open}
      onClose={resetAndClose}
      title="Add league team"
      description="Attach a franchise from The League or register a new one for this season roster."
      size="lg"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${mode === "existing" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setMode("existing")}
        >
          Use existing
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === "create" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setMode("create")}
        >
          Create new franchise
        </button>
      </div>

      {mode === "existing" ? (
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-md border border-input bg-background p-2"
            placeholder="Search franchises…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {filtered.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40"
                  disabled={busy}
                  onClick={() => {
                    onSelectExisting?.(team);
                    resetAndClose();
                  }}
                >
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs font-bold">
                      {abbrFromName(team.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.status}
                      {(team.seasonsPlayed || []).length
                        ? ` · Seasons ${team.seasonsPlayed.join(", ")}`
                        : " · No seasons yet"}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {!filtered.length ? <p className="text-sm text-muted-foreground">No franchises match your search.</p> : null}
          </ul>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Team name</span>
            <input
              className="w-full rounded-md border border-input bg-background p-2"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                  abbr: prev.abbr || abbrFromName(event.target.value),
                }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Abbreviation</span>
            <input
              className="w-full rounded-md border border-input bg-background p-2"
              value={form.abbr}
              onChange={(event) => setForm((prev) => ({ ...prev, abbr: event.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Accent color</span>
            <input
              type="color"
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
              value={form.accentColor || "#e9a84a"}
              onChange={(event) => setForm((prev) => ({ ...prev, accentColor: event.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Logo</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2"
              value={form.logoUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
            >
              <option value="">— Select catalog logo —</option>
              {TEAM_LOGO_CATALOG.map((entry) => (
                <option key={entry.id} value={entry.url}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Tagline</span>
            <input
              className="w-full rounded-md border border-input bg-background p-2"
              value={form.tagline}
              onChange={(event) => setForm((prev) => ({ ...prev, tagline: event.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Lore (optional)</span>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-input bg-background p-2"
              value={form.lore}
              onChange={(event) => setForm((prev) => ({ ...prev, lore: event.target.value }))}
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={resetAndClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !form.name.trim()} onClick={handleCreate}>
              Create & add to roster
            </button>
          </div>
        </div>
      )}
    </TeamsPanelModal>
  );
}
