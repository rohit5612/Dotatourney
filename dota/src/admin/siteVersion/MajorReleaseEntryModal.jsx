import { useEffect, useState } from "react";
import { AdminEditModal } from "../seasons/AdminEditModal.jsx";
import { createEmptyVersionHistoryEntry } from "../../utils/websiteVersionSchema.js";

function inputClassName() {
  return "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function MajorReleaseEntryModal({ open, mode, initialEntry, saving, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(createEmptyVersionHistoryEntry());

  useEffect(() => {
    if (!open) return;
    setDraft(initialEntry ? { ...initialEntry } : createEmptyVersionHistoryEntry());
  }, [open, initialEntry]);

  function patch(fields) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  const title = mode === "create" ? "Add major release" : `Edit v${draft.version || "—"}`;
  const description =
    mode === "create"
      ? "Major releases use version x.0.0 and appear on the public What’s New page."
      : "Update season label, summary, release date, or internal notes.";

  return (
    <AdminEditModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          {mode === "edit" && onDelete ? (
            <button type="button" className="btn btn-outline btn-sm text-destructive" disabled={saving} onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !draft.version?.trim() || !draft.summary?.trim()}
            onClick={() => onSave(draft)}
          >
            {saving ? "Saving…" : "Save release"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Version (x.0.0 only)">
            <input
              className={inputClassName()}
              value={draft.version}
              onChange={(e) => patch({ version: e.target.value })}
              placeholder="3.0.0"
              pattern="\\d+\\.0\\.0"
              title="Major releases must be x.0.0 — use Text changelog for 3.1.0, 3.0.1, etc."
            />
          </Field>
          <Field label="Label">
            <input
              className={inputClassName()}
              value={draft.seasonLabel || ""}
              onChange={(e) => patch({ seasonLabel: e.target.value })}
              placeholder="Season 3"
            />
          </Field>
        </div>
        <Field label="Release date">
          <input
            type="date"
            className={inputClassName()}
            value={draft.releasedAt || ""}
            onChange={(e) => patch({ releasedAt: e.target.value })}
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={`${inputClassName()} min-h-[5rem]`}
            value={draft.summary}
            onChange={(e) => patch({ summary: e.target.value })}
          />
        </Field>
        <Field label="Notes (internal)">
          <textarea
            className={`${inputClassName()} min-h-[5rem]`}
            value={draft.notes || ""}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
      </div>
    </AdminEditModal>
  );
}
