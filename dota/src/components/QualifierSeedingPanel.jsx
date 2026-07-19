import { useEffect, useMemo, useState } from "react";
import { resolveGroupStageConfig } from "../lib/engineGroupConfig.js";
import {
  blastAnyGroupStageFinished,
  blastCompletedGroupLetters,
  blastGroupStageFinished,
  buildQualifierAssignmentPayload,
} from "../utils/qualifierSeeding.js";

function buildDraftFromSlots(slots) {
  /** @type {Record<string, string>} */
  const draft = {};
  for (const slot of slots || []) {
    draft[slot.key] = slot.team || slot.autoTeam || "";
  }
  return draft;
}

export function QualifierSeedingPanel({
  format,
  engineConfig,
  matches = [],
  qualifierSeeding,
  teamNames = [],
  onSave,
  onRefresh,
  disabled,
}) {
  const plan = useMemo(
    () => resolveGroupStageConfig(engineConfig || { teamCount: teamNames.length || 12, format: "blast" }),
    [engineConfig, teamNames.length],
  );
  const completedGroups = useMemo(
    () => qualifierSeeding?.completedGroups || blastCompletedGroupLetters(matches),
    [qualifierSeeding?.completedGroups, matches],
  );
  const groupsComplete = useMemo(
    () => qualifierSeeding?.groupsComplete ?? blastGroupStageFinished(matches),
    [qualifierSeeding?.groupsComplete, matches],
  );
  const anyGroupsComplete = useMemo(
    () => qualifierSeeding?.anyGroupsComplete ?? blastAnyGroupStageFinished(matches),
    [qualifierSeeding?.anyGroupsComplete, matches],
  );
  const slots = qualifierSeeding?.slots || [];
  const savedSignature = slots.map((slot) => `${slot.key}:${slot.team}:${slot.isOverridden}:${slot.editable}`).join("|");
  const [draft, setDraft] = useState(() => buildDraftFromSlots(slots));
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const teamOptions = useMemo(() => {
    const names = new Set(teamNames.map((name) => String(name || "").trim()).filter(Boolean));
    for (const slot of slots) {
      if (slot.autoTeam) names.add(slot.autoTeam);
      if (slot.team) names.add(slot.team);
    }
    for (const value of Object.values(draft)) {
      if (value) names.add(value);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [slots, draft, teamNames]);

  const slotsByGroup = useMemo(() => {
    const grouped = new Map(plan.groupKeys.map((key) => [key, []]));
    for (const slot of slots) {
      const groupKey = slot.groupKey || slot.key.match(/^Group ([A-H]) #/i)?.[1]?.toUpperCase();
      if (!groupKey || !grouped.has(groupKey)) continue;
      grouped.get(groupKey).push(slot);
    }
    return grouped;
  }, [slots, plan.groupKeys]);

  useEffect(() => {
    setDraft(buildDraftFromSlots(slots));
    setDirty(false);
  }, [savedSignature]);

  if (format !== "blast" || !anyGroupsComplete || !slots.length) {
    return null;
  }

  const editableSlots = slots.filter((slot) => slot.editable !== false);
  const overrideCount = editableSlots.filter((slot) => {
    const value = draft[slot.key] || "";
    return value && value !== (slot.autoTeam || "");
  }).length;

  function updateSlot(key, teamName) {
    setDraft((current) => ({ ...current, [key]: teamName }));
    setDirty(true);
  }

  function resetDraftToAuto() {
    const next = { ...draft };
    for (const slot of editableSlots) {
      next[slot.key] = slot.autoTeam || "";
    }
    setDraft(next);
    setDirty(true);
  }

  async function handleSave() {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(buildQualifierAssignmentPayload(slots, draft));
      setDirty(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetSaved() {
    if (!onSave) return;
    const ok = window.confirm(
      groupsComplete
        ? "Reset all manual group standings to automatic results?"
        : "Reset saved manual standings for completed groups?",
    );
    if (!ok) return;
    setIsSaving(true);
    try {
      await onSave(null, { reset: true });
      setDirty(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefresh() {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  const pendingGroups = plan.groupKeys.filter((letter) => !completedGroups.includes(letter));
  const summary =
    overrideCount > 0
      ? `${overrideCount} manual rank${overrideCount === 1 ? "" : "s"} · ${completedGroups.map((g) => `Group ${g}`).join(", ")}`
      : `${completedGroups.map((g) => `Group ${g}`).join(", ")} ready · set final group ranks`;

  return (
    <section className={`group-assignment-panel ${expanded ? "" : "group-assignment-panel--collapsed"}`}>
      <div className="group-assignment-head">
        <button type="button" className="group-assignment-toggle" onClick={() => setExpanded((value) => !value)}>
          <span className="group-assignment-toggle-icon" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="group-assignment-toggle-text">
            <span className="group-assignment-toggle-title">Manual group standings</span>
            <span className="group-assignment-toggle-summary">{summary}</span>
          </span>
        </button>
        <div className="group-assignment-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || isRefreshing}
            onClick={() => void handleRefresh()}
          >
            {isRefreshing ? "Refreshing…" : "Reload"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || !editableSlots.length}
            onClick={resetDraftToAuto}
          >
            Use match results
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || isSaving || !editableSlots.length}
            onClick={() => void handleResetSaved()}
          >
            Clear saved overrides
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || isSaving || !dirty || !editableSlots.length}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : "Save group standings"}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <p className="group-assignment-copy">
            {groupsComplete
              ? "All configured groups are complete. Adjust final ranks per group — bracket, schedule, and standings update together."
              : `Finished groups can be set now${pendingGroups.length ? ` (${pendingGroups.map((g) => `Group ${g}`).join(", ")} still playing)` : ""}.`}
            {" "}Only group tables are editable here; merged playoff seeding stays automatic.
          </p>
          <div className="group-assignment-grid">
            {plan.groupKeys.map((groupKey) => {
              const groupSlots = slotsByGroup.get(groupKey) || [];
              const groupComplete = completedGroups.includes(groupKey);
              const targetSize = plan.groupSizes[plan.groupKeys.indexOf(groupKey)] || groupSlots.length;
              return (
                <div key={groupKey} className="group-assignment-column">
                  <div className="group-assignment-column-head">
                    <h3 className="group-assignment-column-title">Group {groupKey}</h3>
                    <span className={`group-assignment-count ${groupComplete ? "is-valid" : "is-invalid"}`}>
                      {groupComplete ? "Complete" : "In progress"}
                    </span>
                  </div>
                  <div className="group-assignment-grid" style={{ gridTemplateColumns: "1fr" }}>
                    {groupSlots.map((slot) => {
                      const isOverride = draft[slot.key] && draft[slot.key] !== (slot.autoTeam || "");
                      const isEditable = slot.editable !== false;
                      return (
                        <label key={slot.key} className={`group-assignment-slot ${isEditable ? "" : "is-locked"}`}>
                          <span className="group-assignment-item-label">
                            #{slot.key.split("#")[1]}
                            {isOverride ? <span className="group-assignment-badge">Manual</span> : null}
                            {!isEditable ? <span className="group-assignment-badge is-muted">Locked</span> : null}
                          </span>
                          <select
                            className="group-assignment-select"
                            value={draft[slot.key] || ""}
                            disabled={disabled || !isEditable}
                            onChange={(event) => updateSlot(slot.key, event.target.value)}
                          >
                            <option value="">—</option>
                            {teamOptions.map((name) => (
                              <option key={`${slot.key}-${name}`} value={name}>
                                {name}
                                {name === slot.autoTeam ? " (results)" : ""}
                              </option>
                            ))}
                          </select>
                          {slot.autoTeam && draft[slot.key] !== slot.autoTeam ? (
                            <span className="group-assignment-hint">Results: {slot.autoTeam}</span>
                          ) : !isEditable ? (
                            <span className="group-assignment-hint">Unlocks when Group {groupKey} finishes</span>
                          ) : null}
                        </label>
                      );
                    })}
                    {!groupSlots.length ? (
                      <p className="group-assignment-hint">No rank slots configured ({targetSize} teams expected).</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
