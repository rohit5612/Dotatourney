import { useEffect, useMemo, useState } from "react";
import { BracketDiagram } from "../components/BracketDiagram";
import { BracketStageTabs } from "../components/navigation/TournamentTabs.jsx";
import { GroupAssignmentPanel } from "../components/GroupAssignmentPanel.jsx";
import { normalizedBlastBracketTabs } from "../components/bracket/bracketLayout.js";
import { resolveBracketTabs } from "../utils/engineBracketTabs.js";
import { formatUsesGroupAssignment, isGroupAssignmentValid } from "../utils/groupAssignment.js";
import { AdminGlassPanel } from "../admin/components/AdminGlassPanel.jsx";

function summarizeEngineConfig(config) {
  if (!config?.stages?.length) return null;
  const lines = [`${config.teamCount} teams · ${String(config.format || "").toUpperCase()}`];
  for (const stage of config.stages) {
    lines.push(`• ${stage.label || stage.key} (${stage.type})`);
  }
  return lines.join("\n");
}

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
  saveGroupAssignments,
  applySeriesRulesToUpcoming,
  refreshBracketProgression,
}) {
  const [scores, setScores] = useState({});
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [isApplyingSeriesRules, setIsApplyingSeriesRules] = useState(false);
  const [isRefreshingProgression, setIsRefreshingProgression] = useState(false);
  const totalMatches = (state?.matches || []).length;
  const completedMatches = (state?.matches || []).filter((match) => match.winner).length;
  const completionPct = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const mode = setup?.visibilityMode || "demo";
  const bracketActive = Boolean(setup?.bracketActive);
  const requiredTeamCount = Number(setup?.teamCount) || state?.tournament?.team_count || 0;
  const selectedRoster = rosters.find((roster) => roster.id === (selectedRosterId || approvedRoster?.id));
  const approvedRosterSummary = rosters.find((roster) => roster.id === approvedRoster?.id);
  const selectedRosterReady = selectedRoster && (!requiredTeamCount || selectedRoster.teamCount === requiredTeamCount);
  const engineConfig = setup?.engineConfig || state?.tournament?.engine_config || null;
  const groupsReady =
    !formatUsesGroupAssignment(setup?.format, engineConfig) ||
    mode === "demo" ||
    isGroupAssignmentValid(approvedRoster?.teams || [], engineConfig);
  const canGenerateTournament =
    mode === "demo" ||
    (!bracketActive &&
      approvedRoster &&
      groupsReady &&
      (!requiredTeamCount || approvedRoster.teams?.length === requiredTeamCount));
  const generationCopy =
    mode === "demo"
      ? `Demo mode will generate placeholder teams from the ${requiredTeamCount}-team ${setup?.format?.toUpperCase() || "configured"} format for the public bracket map.`
      : "Tournament mode will generate real matches from the currently approved roster.";

  const engineSummary = summarizeEngineConfig(setup?.engineConfig || state?.tournament?.engine_config);
  const displayTabs = useMemo(() => {
    const raw = resolveBracketTabs(setup?.format || "", state?.tabs, engineConfig);
    return normalizedBlastBracketTabs(setup?.format || "", raw);
  }, [setup?.format, engineConfig, state?.tabs]);

  const blastPlayoffQuarterRows = useMemo(
    () => (groupedMatches["blast-playoffs"] || []).filter((m) => (m.roundIndex ?? 0) === 0),
    [groupedMatches],
  );

  useEffect(() => {
    if (setup?.format !== "blast") return;
    if (!groupedMatches["blast-qualifiers"]?.length) return;
    if (activeTab === "blast-lastchance" || activeTab === "blast-playin") {
      setActiveTab("blast-qualifiers");
    }
  }, [setup?.format, activeTab, groupedMatches, setActiveTab]);

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

  async function promptApplySeriesRules() {
    const ok = window.confirm(
      "Apply saved series rules to upcoming matches only? Finished and live matches are unchanged. Bracket structure is not regenerated.",
    );
    if (!ok) return;
    setIsApplyingSeriesRules(true);
    try {
      await applySeriesRulesToUpcoming?.();
    } finally {
      setIsApplyingSeriesRules(false);
    }
  }

  async function promptRefreshBracketProgression() {
    const ok = window.confirm(
      "Refresh playoff and other fed team slots from saved match results? Scores and bracket structure stay as they are — only downstream team names are re-synced (bracket, schedule, and public site).",
    );
    if (!ok) return;
    setIsRefreshingProgression(true);
    try {
      await refreshBracketProgression?.();
    } finally {
      setIsRefreshingProgression(false);
    }
  }

  return (
    <div className="admin-page-stack">
    <AdminGlassPanel className="space-y-4">
      {engineSummary ? (
        <div className="rounded-md border border-border/50 bg-background/30 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tournament engine</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-foreground">{engineSummary}</pre>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="admin-section-title">Bracket</h2>
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
                {bracketActive
                  ? "Live bracket locked for regeneration. You can still change series rules in Setup and apply them to upcoming matches below."
                  : "Activate once the tournament bracket is final."}
              </span>
              {totalMatches > 0 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={isRefreshingProgression}
                    onClick={() => void promptRefreshBracketProgression()}
                  >
                    {isRefreshingProgression ? "Refreshing…" : "Refresh playoff slots from results"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={isApplyingSeriesRules}
                    onClick={() => void promptApplySeriesRules()}
                  >
                    {isApplyingSeriesRules ? "Applying..." : "Apply series rules to upcoming matches"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {isSavingMode ? <p className="mt-2 text-xs text-secondary">Saving bracket mode...</p> : null}
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Approved roster</div>
          <div className="flex flex-wrap gap-2">
            <select
              className="min-w-0 w-full max-w-full rounded-md border border-input bg-card p-2 text-sm sm:min-w-64 sm:max-w-none"
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
          {mode === "tournament" && formatUsesGroupAssignment(setup?.format, engineConfig) && approvedRoster && !groupsReady ? (
            <p className="text-xs text-destructive">Assign and save groups before generating the bracket.</p>
          ) : null}
        </div>
      </section>
      {mode === "tournament" ? (
        <GroupAssignmentPanel
          format={setup?.format}
          engineConfig={engineConfig}
          approvedRoster={approvedRoster}
          bracketActive={bracketActive}
          bracketGenerated={totalMatches > 0}
          onSave={saveGroupAssignments}
          disabled={!approvedRoster}
        />
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
      </div>
      <BracketStageTabs value={activeTab} onChange={setActiveTab} tabs={displayTabs} />
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
        playoffFeedMatches={activeTab === "blast-qualifiers" ? blastPlayoffQuarterRows : undefined}
        blastSeedMatches={state?.matches ?? []}
      />
    </AdminGlassPanel>
    </div>
  );
}
