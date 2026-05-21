import { useEffect, useMemo, useState } from "react";
import {
  defaultGroupKeyForIndex,
  expectedGroupSizes,
  formatUsesGroupAssignment,
  isGroupAssignmentValid,
} from "../utils/groupAssignment.js";
import "../styles/group-assignment.css";

function buildDraftFromTeams(teams) {
  return (teams || []).map((team, index) => ({
    teamId: team.id,
    name: team.name,
    abbr: team.abbr,
    groupKey: team.groupKey || defaultGroupKeyForIndex(index, teams.length),
  }));
}

export function GroupAssignmentPanel({ format, approvedRoster, bracketActive, onSave, disabled }) {
  const teams = approvedRoster?.teams || [];
  const savedSignature = teams.map((team) => `${team.id}:${team.groupKey || ""}`).join("|");
  const [draft, setDraft] = useState(() => buildDraftFromTeams(teams));
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sizes = useMemo(() => expectedGroupSizes(teams.length), [teams.length]);
  const groupA = draft.filter((entry) => entry.groupKey === "A");
  const groupB = draft.filter((entry) => entry.groupKey === "B");
  const draftValid = isGroupAssignmentValid(
    draft.map((entry) => ({ groupKey: entry.groupKey })),
  );
  const savedValid = isGroupAssignmentValid(teams);

  useEffect(() => {
    setDraft(buildDraftFromTeams(teams));
    setDirty(false);
  }, [approvedRoster?.id, savedSignature]);

  if (!formatUsesGroupAssignment(format) || !approvedRoster || bracketActive) {
    return null;
  }

  function moveTeam(teamId, nextGroup) {
    setDraft((current) =>
      current.map((entry) => (entry.teamId === teamId ? { ...entry, groupKey: nextGroup } : entry)),
    );
    setDirty(true);
  }

  function resetToSaved() {
    setDraft(buildDraftFromTeams(teams));
    setDirty(false);
  }

  function autoBalance() {
    setDraft((current) =>
      current.map((entry, index) => ({
        ...entry,
        groupKey: defaultGroupKeyForIndex(index, current.length),
      })),
    );
    setDirty(true);
  }

  async function handleSave() {
    if (!draftValid || !onSave) return;
    setIsSaving(true);
    try {
      await onSave(
        draft.map((entry) => ({
          teamId: entry.teamId,
          groupKey: entry.groupKey,
        })),
      );
      setDirty(false);
    } finally {
      setIsSaving(false);
    }
  }

  function renderGroup(label, entries, otherGroup) {
    const targetSize = label === "A" ? sizes.groupA : sizes.groupB;
    const countOk = entries.length === targetSize;

    return (
      <div className="group-assignment-column">
        <div className="group-assignment-column-head">
          <h3 className="group-assignment-column-title">Group {label}</h3>
          <span className={`group-assignment-count ${countOk ? "is-valid" : "is-invalid"}`}>
            {entries.length}/{targetSize}
          </span>
        </div>
        <ul className="group-assignment-list">
          {entries.map((entry) => (
            <li key={entry.teamId} className="group-assignment-item">
              <span className="group-assignment-team">
                {entry.abbr ? <span className="group-assignment-abbr">{entry.abbr}</span> : null}
                {entry.name}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={disabled || isSaving}
                onClick={() => moveTeam(entry.teamId, otherGroup)}
                title={`Move to Group ${otherGroup}`}
              >
                → {otherGroup}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="group-assignment-panel">
      <div className="group-assignment-header">
        <div>
          <h2 className="font-serif text-lg">Group assignment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign approved teams to Group A and Group B before generating the bracket. Group sizes must match the format
            ({sizes.groupA} in A, {sizes.groupB} in B).
          </p>
        </div>
        <div className="group-assignment-actions">
          <button type="button" className="btn btn-outline btn-sm" disabled={disabled || isSaving} onClick={autoBalance}>
            Auto-balance
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={disabled || isSaving || !dirty} onClick={resetToSaved}>
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || isSaving || !dirty || !draftValid}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Save groups"}
          </button>
        </div>
      </div>
      <div className="group-assignment-grid">
        {renderGroup("A", groupA, "B")}
        {renderGroup("B", groupB, "A")}
      </div>
      {!draftValid ? (
        <p className="group-assignment-hint text-destructive">
          Adjust teams until Group A has {sizes.groupA} and Group B has {sizes.groupB}.
        </p>
      ) : !savedValid && !dirty ? (
        <p className="group-assignment-hint text-destructive">Save group assignments before generating the bracket.</p>
      ) : dirty ? (
        <p className="group-assignment-hint text-secondary">Unsaved changes — save before generating the bracket.</p>
      ) : (
        <p className="group-assignment-hint text-secondary">Group assignment saved.</p>
      )}
    </section>
  );
}
