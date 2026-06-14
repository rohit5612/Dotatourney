import { useEffect, useMemo, useState } from "react";
import {
  applySeedingDraft,
  defaultGroupKeyForIndex,
  formatUsesGroupAssignment,
  isGroupAssignmentValid,
  resolveGroupStageConfig,
  SEEDING_MODES,
} from "../utils/groupAssignment.js";
import "../styles/group-assignment.css";

function buildDraftFromTeams(teams, engineConfig) {
  return (teams || []).map((team, index) => ({
    teamId: team.id,
    name: team.name,
    abbr: team.abbr,
    seed: team.seed,
    groupKey: team.groupKey || defaultGroupKeyForIndex(index, engineConfig),
  }));
}

export function GroupAssignmentPanel({
  format,
  engineConfig,
  approvedRoster,
  bracketActive,
  bracketGenerated = false,
  onSave,
  disabled,
}) {
  const teams = approvedRoster?.teams || [];
  const plan = useMemo(() => resolveGroupStageConfig(engineConfig || { teamCount: teams.length, format }), [engineConfig, teams.length, format]);
  const savedSignature = teams.map((team) => `${team.id}:${team.groupKey || ""}`).join("|");
  const [draft, setDraft] = useState(() => buildDraftFromTeams(teams, engineConfig));
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const draftValid = isGroupAssignmentValid(
    draft.map((entry) => ({ groupKey: entry.groupKey })),
    engineConfig,
  );
  const savedValid = isGroupAssignmentValid(teams, engineConfig);
  const canSave = draftValid && (dirty || !savedValid);
  const readOnly = Boolean(disabled || bracketActive);
  const preferCollapsed = bracketGenerated && savedValid && !dirty;

  useEffect(() => {
    setDraft(buildDraftFromTeams(teams, engineConfig));
    setDirty(false);
  }, [approvedRoster?.id, savedSignature, engineConfig]);

  useEffect(() => {
    if (preferCollapsed) setExpanded(false);
  }, [preferCollapsed]);

  if (!formatUsesGroupAssignment(format, engineConfig) || !approvedRoster) {
    return null;
  }

  function moveTeam(teamId, nextGroup) {
    setDraft((current) =>
      current.map((entry) => (entry.teamId === teamId ? { ...entry, groupKey: nextGroup } : entry)),
    );
    setDirty(true);
  }

  function resetToSaved() {
    setDraft(buildDraftFromTeams(teams, engineConfig));
    setDirty(false);
  }

  function applySeeding(mode) {
    setDraft(applySeedingDraft(teams, engineConfig, mode));
    setDirty(true);
  }

  async function handleSave() {
    if (!canSave || !onSave) return;
    setIsSaving(true);
    try {
      await onSave(
        draft.map((entry) => ({
          teamId: entry.teamId,
          groupKey: entry.groupKey,
        })),
      );
      setDirty(false);
      if (bracketGenerated) setExpanded(false);
    } finally {
      setIsSaving(false);
    }
  }

  function groupSummary() {
    return plan.groupKeys
      .map((key) => {
        const names = draft.filter((entry) => entry.groupKey === key).map((entry) => entry.abbr || entry.name);
        return `Group ${key}: ${names.length ? names.join(", ") : "—"}`;
      })
      .join(" · ");
  }

  function renderGroup(groupKey) {
    const entries = draft.filter((entry) => entry.groupKey === groupKey);
    const targetSize = plan.groupSizes[plan.groupKeys.indexOf(groupKey)] || 0;
    const countOk = entries.length === targetSize;
    const otherGroups = plan.groupKeys.filter((key) => key !== groupKey);

    return (
      <div key={groupKey} className="group-assignment-column">
        <div className="group-assignment-column-head">
          <h3 className="group-assignment-column-title">Group {groupKey}</h3>
          <span className={`group-assignment-count ${countOk ? "is-valid" : "is-invalid"}`}>
            {entries.length}/{targetSize}
          </span>
        </div>
        <ul className="group-assignment-list">
          {entries.map((entry) => (
            <li key={entry.teamId} className="group-assignment-item">
              <span className="group-assignment-team">
                {entry.seed ? <span className="group-assignment-abbr">#{entry.seed}</span> : null}
                {entry.abbr ? <span className="group-assignment-abbr">{entry.abbr}</span> : null}
                {entry.name}
              </span>
              <div className="group-assignment-move">
                {otherGroups.map((other) => (
                  <button
                    key={other}
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled={readOnly || isSaving}
                    onClick={() => moveTeam(entry.teamId, other)}
                    title={`Move to Group ${other}`}
                  >
                    → {other}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const seedingLabel = SEEDING_MODES.find((mode) => mode.id === plan.seedingMode)?.label || plan.seedingMode;

  let statusHint = null;
  if (!draftValid) {
    statusHint = (
      <p className="group-assignment-hint text-destructive">
        Adjust teams until each group matches: {plan.groupKeys.map((key, index) => `${key}=${plan.groupSizes[index]}`).join(", ")}.
      </p>
    );
  } else if (readOnly) {
    statusHint = (
      <p className="group-assignment-hint text-muted-foreground">
        Bracket is live — deactivate it in Public bracket mode before changing group assignments.
      </p>
    );
  } else if (!savedValid && !dirty) {
    statusHint = (
      <p className="group-assignment-hint text-destructive">
        Groups look valid — save to persist before generating the bracket.
      </p>
    );
  } else if (dirty) {
    statusHint = <p className="group-assignment-hint text-secondary">Unsaved changes — save before generating the bracket.</p>;
  } else {
    statusHint = <p className="group-assignment-hint text-secondary">Group assignment saved.</p>;
  }

  return (
    <section className={`group-assignment-panel${expanded ? "" : " group-assignment-panel--collapsed"}`}>
      <div className="group-assignment-header">
        <button
          type="button"
          className="group-assignment-toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="group-assignment-toggle-icon" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="group-assignment-toggle-text">
            <span className="group-assignment-toggle-title">Group assignment</span>
            {!expanded ? (
              <span className="group-assignment-toggle-summary">{groupSummary()}</span>
            ) : (
              <span className="group-assignment-toggle-summary group-assignment-toggle-summary--inline">
                {plan.groupCount} groups · {plan.groupSizes.join(" / ")} teams · Engine seeding: <strong>{seedingLabel}</strong>
                {plan.seedingMode === "manual"
                  ? " — assign teams below, then save before generating."
                  : " — adjust if needed, then save."}
              </span>
            )}
          </span>
        </button>
        {expanded ? (
          <div className="group-assignment-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={readOnly || isSaving} onClick={() => applySeeding("seed_order")}>
              Seed order
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={readOnly || isSaving} onClick={() => applySeeding("snake")}>
              Snake
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={readOnly || isSaving} onClick={() => applySeeding("random")}>
              Random draw
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={readOnly || isSaving || !dirty} onClick={resetToSaved}>
              Reset
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={readOnly || isSaving || !canSave}
              onClick={handleSave}
            >
              {isSaving ? "Saving…" : "Save groups"}
            </button>
          </div>
        ) : savedValid ? (
          <span className="group-assignment-saved-badge">Saved</span>
        ) : canSave ? (
          <span className="group-assignment-saved-badge group-assignment-saved-badge--pending">Needs save</span>
        ) : null}
      </div>
      {expanded ? (
        <>
          <div className={`group-assignment-grid group-assignment-grid--${Math.min(plan.groupCount, 4)}`}>
            {plan.groupKeys.map((groupKey) => renderGroup(groupKey))}
          </div>
          {statusHint}
        </>
      ) : null}
    </section>
  );
}
