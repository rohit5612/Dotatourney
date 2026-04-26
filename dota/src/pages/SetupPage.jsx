import { formatDetails, seriesOptions, seriesRuleTemplates } from "../constants/tournament";

export function SetupPage({
  setup,
  setSetup,
  selectedFormat,
  onFormatChange,
  bootstrapTournament,
  generateBracket,
  exportData,
  importData,
  state,
}) {
  const teamCount = Number(setup.teamCount) || 0;
  const isPowerOfTwo = teamCount > 0 && (teamCount & (teamCount - 1)) === 0;
  const estimatedLeagueMatches = Math.max(0, Math.floor((teamCount * (teamCount - 1)) / 2));
  const estimatedBracketRounds = teamCount > 1 ? Math.ceil(Math.log2(teamCount)) : 0;
  const currentSeriesTemplates = seriesRuleTemplates[setup.format] || [];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-serif text-lg tracking-wide">Tournament Setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure event basics, choose a format, and generate a bracket structure tailored for your tournament flow.
        </p>
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
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
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
          value={setup.discordUrl || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, discordUrl: event.target.value }))}
          placeholder="Discord invite URL"
        />
        <input
          type="date"
          className="rounded-md border border-input bg-background p-2"
          value={setup.startDate || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, startDate: event.target.value }))}
        />
        <input
          type="date"
          className="rounded-md border border-input bg-background p-2"
          value={setup.endDate || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, endDate: event.target.value }))}
        />
        <input
          type="datetime-local"
          className="rounded-md border border-input bg-background p-2"
          value={setup.registrationDeadline || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, registrationDeadline: event.target.value }))}
        />
        <select
          className="rounded-md border border-input bg-background p-2"
          value={setup.visibilityMode || "demo"}
          onChange={(event) => setSetup((prev) => ({ ...prev, visibilityMode: event.target.value }))}
        >
          <option value="demo">Demo mode</option>
          <option value="tournament">Tournament mode</option>
        </select>
      </div>

      <label className="block text-sm">
        Public announcements, one per line
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-2"
          value={(setup.announcements || []).join("\n")}
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
                className={`rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50"
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
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={bootstrapTournament}>
          Save setup
        </button>
        <button type="button" className="rounded-md border border-border px-4 py-2" onClick={generateBracket}>
          Generate bracket
        </button>
        <button type="button" className="rounded-md border border-border px-4 py-2" onClick={exportData}>
          Export JSON
        </button>
        <label className="rounded-md border border-border px-4 py-2">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={importData} />
        </label>
      </div>
    </div>
  );
}
