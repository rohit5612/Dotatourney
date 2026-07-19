import { useEffect, useMemo, useState } from "react";
import { blastGroupStageFinished, buildQualifierAssignmentPayload } from "../utils/qualifierSeeding.js";

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
  matches = [],
  qualifierSeeding,
  teamNames = [],
  onSave,
  onRefresh,
  disabled,
}) {
  const groupsComplete = useMemo(() => blastGroupStageFinished(matches), [matches]);
  const slots = qualifierSeeding?.slots || [];
  const savedSignature = slots.map((slot) => `${slot.key}:${slot.team}:${slot.isOverridden}`).join("|");
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

  useEffect(() => {
    setDraft(buildDraftFromSlots(slots));
    setDirty(false);
  }, [savedSignature]);

  if (format !== "blast" || !groupsComplete || !slots.length) {
    return null;
  }

  const overrideCount = slots.filter((slot) => {
    const value = draft[slot.key] || "";
    return value && value !== (slot.autoTeam || "");
  }).length;

  function updateSlot(key, teamName) {
    setDraft((current) => ({ ...current, [key]: teamName }));
    setDirty(true);
  }

  function resetDraftToAuto() {
    const next = {};
    for (const slot of slots) {
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
    const ok = window.confirm("Reset all qualifier slots to automatic group standings?");
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

  const summary =
    overrideCount > 0
      ? `${overrideCount} manual override${overrideCount === 1 ? "" : "s"} · Last chance / Play-In / playoff slots`
      : "Automatic standings · adjust ranks before qualifier matches start";

  return (
    <section className={`group-assignment-panel ${expanded ? "" : "group-assignment-panel--collapsed"}`}>
      <div className="group-assignment-head">
        <button type="button" className="group-assignment-toggle" onClick={() => setExpanded((value) => !value)}>
          <span className="group-assignment-toggle-icon" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="group-assignment-toggle-text">
            <span className="group-assignment-toggle-title">Qualifier seeding</span>
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
          <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={resetDraftToAuto}>
            Use standings
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || isSaving}
            onClick={() => void handleResetSaved()}
          >
            Clear saved overrides
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || isSaving || !dirty}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : "Save qualifier order"}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <p className="group-assignment-copy">
            Group stage is complete. Reorder which team occupies each rank slot before Last chance, Play-In, and playoff
            matches begin. Finished qualifier matches are not changed.
          </p>
          <div className="group-assignment-grid">
            {slots.map((slot) => {
              const isOverride = draft[slot.key] && draft[slot.key] !== (slot.autoTeam || "");
              return (
                <label key={slot.key} className="group-assignment-slot">
                  <span className="group-assignment-item-label">
                    {slot.key}
                    {isOverride ? <span className="group-assignment-badge">Manual</span> : null}
                  </span>
                  <select
                    className="group-assignment-select"
                    value={draft[slot.key] || ""}
                    disabled={disabled}
                    onChange={(event) => updateSlot(slot.key, event.target.value)}
                  >
                    <option value="">—</option>
                    {teamOptions.map((name) => (
                      <option key={`${slot.key}-${name}`} value={name}>
                        {name}
                        {name === slot.autoTeam ? " (standings)" : ""}
                      </option>
                    ))}
                  </select>
                  {slot.autoTeam && draft[slot.key] !== slot.autoTeam ? (
                    <span className="group-assignment-hint">Standings: {slot.autoTeam}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
