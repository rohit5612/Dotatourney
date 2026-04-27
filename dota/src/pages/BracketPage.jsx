import { useState } from "react";
import { BracketDiagram } from "../components/BracketDiagram";

export function BracketPage({
  state,
  activeTab,
  setActiveTab,
  groupedMatches,
  submitResult,
  updateMatch,
  generateBracket,
  setup,
  rosters = [],
  approvedRoster,
  updateBracketVisibilityMode,
  updateBracketActivation,
  approveRoster,
}) {
  const [scores, setScores] = useState({});
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const totalMatches = (state?.matches || []).length;
  const completedMatches = (state?.matches || []).filter((match) => match.winner).length;
  const completionPct = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const mode = setup?.visibilityMode || "demo";
  const bracketActive = Boolean(setup?.bracketActive);
  const requiredTeamCount = Number(setup?.teamCount) || state?.tournament?.team_count || 0;
  const selectedRoster = rosters.find((roster) => roster.id === (selectedRosterId || approvedRoster?.id));
  const approvedRosterSummary = rosters.find((roster) => roster.id === approvedRoster?.id);
  const selectedRosterReady = selectedRoster && (!requiredTeamCount || selectedRoster.teamCount === requiredTeamCount);
  const canGenerateTournament = mode === "demo" || (!bracketActive && approvedRoster && (!requiredTeamCount || approvedRoster.teams?.length === requiredTeamCount));
  const generationCopy =
    mode === "demo"
      ? `Demo mode will generate placeholder teams from the ${requiredTeamCount}-team ${setup?.format?.toUpperCase() || "configured"} format for the public bracket map.`
      : "Tournament mode will generate real matches from the currently approved roster.";

  async function changeMode(nextMode) {
    setIsSavingMode(true);
    try {
      await updateBracketVisibilityMode?.(nextMode);
    } finally {
      setIsSavingMode(false);
    }
  }

  function approveSelectedRoster() {
    const rosterId = selectedRosterId || approvedRoster?.id;
    if (!rosterId) return;
    approveRoster?.(rosterId);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg">Bracket</h2>
          <div className="text-sm text-muted-foreground">
            {completedMatches}/{totalMatches} completed ({completionPct}%)
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-input bg-background p-2 text-sm"
            value={mode}
            disabled={isSavingMode}
            onChange={(event) => changeMode(event.target.value)}
          >
            <option value="demo">Demo mode</option>
            <option value="tournament">Tournament mode</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={generateBracket} disabled={!canGenerateTournament}>
            Generate bracket
          </button>
        </div>
      </div>
      <section className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Public bracket mode</div>
          <p className="mt-1 text-sm text-muted-foreground">{generationCopy}</p>
          {mode === "tournament" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`btn btn-sm ${bracketActive ? "btn-destructive-outline" : "btn-primary"}`}
                onClick={() => updateBracketActivation?.(!bracketActive)}
              >
                {bracketActive ? "Deactivate bracket" : "Activate bracket"}
              </button>
              <span className={bracketActive ? "text-xs text-secondary" : "text-xs text-muted-foreground"}>
                {bracketActive ? "Live bracket locked. Tournament regeneration is disabled." : "Activate once the tournament bracket is final."}
              </span>
            </div>
          ) : null}
          {isSavingMode ? <p className="mt-2 text-xs text-secondary">Saving bracket mode...</p> : null}
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Approved roster</div>
          <div className="flex flex-wrap gap-2">
            <select
              className="min-w-64 rounded-md border border-input bg-card p-2 text-sm"
              value={selectedRosterId || approvedRoster?.id || ""}
              onChange={(event) => setSelectedRosterId(event.target.value)}
            >
              <option value="">Select roster</option>
              {rosters.map((roster) => (
                <option key={roster.id} value={roster.id}>
                  {roster.name} - {roster.status} - {roster.teamCount} teams
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline"
              disabled={!selectedRoster || selectedRoster.status === "approved" || !selectedRosterReady}
              onClick={approveSelectedRoster}
            >
              Approve selected
            </button>
          </div>
          {approvedRoster ? (
            <p className="text-sm text-secondary">
              Active roster: {approvedRoster.name} ({approvedRoster.teams?.length || approvedRosterSummary?.teamCount || 0}/{requiredTeamCount} teams)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No approved roster yet. Tournament mode requires one before generation.</p>
          )}
          {selectedRoster && !selectedRosterReady ? (
            <p className="text-xs text-destructive">Selected roster needs exactly {requiredTeamCount} teams before approval.</p>
          ) : null}
        </div>
      </section>
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
      </div>
      <div className="flex gap-2">
        {(state?.tabs || []).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? "btn-primary" : "btn-outline"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Record winners to auto-propagate teams into downstream matches. Use tabs to manage upper/lower/finals or stage-specific group brackets.
      </div>
      <BracketDiagram
        matches={groupedMatches[activeTab] || []}
        editable
        scores={scores}
        setScores={setScores}
        submitResult={submitResult}
        updateMatch={updateMatch}
      />
    </div>
  );
}
