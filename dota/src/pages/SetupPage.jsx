import { useState } from "react";
import { buildDefaultSeriesRules, formatDetails, seriesOptions, seriesRuleTemplates } from "../constants/tournament";

function normalizeAnnouncements(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return [];
}

export function SetupPage({
  setup,
  setSetup,
  selectedFormat,
  onFormatChange,
  bootstrapTournament,
  exportData,
  importData,
  state,
  tournaments = [],
  selectTournament,
  publishTournament,
  unpublishTournament,
  deleteTournament,
  startNewTournament,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const teamCount = Number(setup.teamCount) || 0;
  const isPowerOfTwo = teamCount > 0 && (teamCount & (teamCount - 1)) === 0;
  const estimatedLeagueMatches = Math.max(0, Math.floor((teamCount * (teamCount - 1)) / 2));
  const estimatedBracketRounds = teamCount > 1 ? Math.ceil(Math.log2(teamCount)) : 0;
  const currentSeriesTemplates = seriesRuleTemplates[setup.format] || [];
  const announcementLines = normalizeAnnouncements(setup.announcements);

  function resetDraft() {
    setSetup({
      name: "The Forge",
      slug: "the-forge",
      format: "dse",
      seriesType: "bo3",
      teamCount: 8,
      seriesRules: buildDefaultSeriesRules("dse", "bo3"),
      description: "",
      prizePool: "",
      entryFee: "",
      startDate: "",
      endDate: "",
      registrationDeadline: "",
      discordUrl: "https://discord.gg/NmC2Xqnb",
      rulebook: "",
      announcements: [],
      visibilityMode: "demo",
      status: "draft",
    });
  }

  async function saveDraft() {
    setIsSaving(true);
    try {
      await bootstrapTournament();
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function editTournament(id) {
    await selectTournament?.(id);
    setIsModalOpen(true);
  }

  function confirmDelete(tournament) {
    const confirmed = window.confirm(`Delete draft tournament "${tournament.name}"? This will archive the draft and remove it from this list.`);
    if (confirmed) deleteTournament?.(tournament.id);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg tracking-wide">Tournament Setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create draft tournaments, edit settings, and publish exactly one tournament to the public site.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              startNewTournament?.();
              resetDraft();
              setIsModalOpen(true);
            }}
          >
            Create tournament
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg">Drafts and tournaments</h3>
        {(tournaments || []).map((tournament) => (
          <div key={tournament.id} className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tournament.name}</span>
                <span className="rounded border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{tournament.status}</span>
                {tournament.is_published ? <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Published</span> : null}
              </div>
              <div className="mt-1 text-muted-foreground">
                {formatDetails[tournament.format]?.name || tournament.format} - {tournament.team_count} teams - Starts {tournament.start_date || "TBA"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => editTournament(tournament.id)}>
                Edit
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => publishTournament?.(tournament.id)}>
                Approve + publish
              </button>
              {tournament.is_published ? (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => unpublishTournament?.(tournament.id)}>
                  Unpublish
                </button>
              ) : null}
              {tournament.status === "draft" && !tournament.is_published ? (
                <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => confirmDelete(tournament)}>
                  Delete draft
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!tournaments?.length ? <p className="text-sm text-muted-foreground">No tournament drafts yet. Create one to begin.</p> : null}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto max-w-6xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl">Tournament draft</h3>
                <p className="text-sm text-muted-foreground">Saving keeps the tournament as a draft until you approve and publish it.</p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.name}
          onChange={(event) => setSetup((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Tournament name"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.slug || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, slug: event.target.value }))}
          placeholder="Public slug"
        />
        <input
          type="number"
          min={2}
          max={64}
          className="rounded-md border border-input bg-background p-2"
          value={setup.teamCount}
          onChange={(event) =>
            setSetup((prev) => ({
              ...prev,
              teamCount: Math.max(2, Math.min(64, Number(event.target.value) || 2)),
            }))
          }
          placeholder="Team count"
        />
        <select
          className="rounded-md border border-input bg-background p-2"
          value={setup.seriesType}
          onChange={(event) =>
            setSetup((prev) => ({
              ...prev,
              seriesType: event.target.value,
              seriesRules: Object.fromEntries(
                Object.entries(prev.seriesRules || {}).map(([ruleKey]) => [ruleKey, event.target.value]),
              ),
            }))
          }
        >
          {seriesOptions.map((series) => (
            <option key={series} value={series}>
              {series.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-background p-2"
          value={setup.format}
          onChange={(event) => {
            onFormatChange(event.target.value);
          }}
        >
          {Object.entries(formatDetails).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setSetup((prev) => ({
              ...prev,
              teamCount: 8,
            }))
          }
        >
          Reset to 8 teams
        </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
        <textarea
          className="min-h-28 rounded-md border border-input bg-background p-2"
          value={setup.description || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Public tournament description"
        />
        <textarea
          className="min-h-28 rounded-md border border-input bg-background p-2"
          value={setup.rulebook || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, rulebook: event.target.value }))}
          placeholder="Rule book"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.prizePool || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, prizePool: event.target.value }))}
          placeholder="Prize pool"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.entryFee || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, entryFee: event.target.value }))}
          placeholder="Entry fee"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.discordUrl || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, discordUrl: event.target.value }))}
          placeholder="Discord invite URL"
        />
        <label className="text-sm text-muted-foreground">
          Start date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground"
            value={setup.startDate || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, startDate: event.target.value }))}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Finish date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground"
            value={setup.endDate || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, endDate: event.target.value }))}
          />
        </label>
            </div>

            <label className="block text-sm">
        Public announcements, one per line
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-2"
          value={announcementLines.join("\n")}
          onChange={(event) =>
            setSetup((prev) => ({
              ...prev,
              announcements: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
            }))
          }
        />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Structure hint</div>
          <div className="mt-1 text-sm">
            {isPowerOfTwo
              ? "Great: this count maps cleanly to standard elimination rounds."
              : "Non power-of-two count: byes/play-in rounds may be required for clean brackets."}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Round robin workload</div>
          <div className="mt-1 text-sm">{estimatedLeagueMatches} league matches (single round robin)</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bracket depth</div>
          <div className="mt-1 text-sm">~{estimatedBracketRounds} rounds to crown a winner</div>
        </div>
            </div>

            <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Format Library</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(formatDetails).map(([key, format]) => {
            const active = selectedFormat === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onFormatChange(key);
                }}
                className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary hover:bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base">{format.name}</h3>
                  <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {format.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{format.description}</p>
                <p className="mt-2 text-xs text-secondary">{format.guidance}</p>
              </button>
            );
          })}
        </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Why format choice matters:</span> it impacts bracket fairness, upset probability,
          stream pacing, and how meaningful standings become across rounds.
        </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Series setup by stage</p>
          <p className="text-xs text-muted-foreground">
            Tournament default: <span className="uppercase">{setup.seriesType}</span>
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {currentSeriesTemplates.map((rule) => (
            <label key={rule.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">{rule.label}</span>
              <select
                className="rounded-md border border-input bg-card px-2 py-1 text-sm uppercase"
                value={setup.seriesRules?.[rule.key] || rule.defaultSeries}
                onChange={(event) =>
                  setSetup((prev) => ({
                    ...prev,
                    seriesRules: {
                      ...(prev.seriesRules || {}),
                      [rule.key]: event.target.value,
                    },
                  }))
                }
              >
                {seriesOptions.map((series) => (
                  <option key={series} value={series}>
                    {series.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Operational note:</span> these series rules are stored with tournament config and are meant to drive match
          pacing, stream time planning, and stage difficulty. You can tune them before each major phase.
        </p>
            </div>

            {state?.tournament?.id ? (
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          Tournament ID: <span className="font-mono text-foreground">{state.tournament.id}</span>
        </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={saveDraft} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save draft"}
        </button>
        <button type="button" className="btn btn-outline" onClick={exportData}>
          Export JSON
        </button>
        <label className="btn btn-outline cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={importData} />
        </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
