import { useState } from "react";
import { ConfirmDialog } from "../users/ConfirmDialog.jsx";
import { AdminEditModal } from "./AdminEditModal.jsx";
import {
  SPONSOR_SOCIAL_FIELDS,
  SPONSOR_TIERS,
  createEmptySponsor,
  sponsorTierLabel,
} from "../../utils/seasonContentSchema.js";

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

export function SeasonSponsorsEditor({ value, onChange, disabled = false }) {
  const section = value?.section || {};
  const sponsors = Array.isArray(value?.sponsors) ? value.sponsors : [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);

  function updateSection(patch) {
    onChange({ ...value, section: { ...section, ...patch } });
  }

  function openCreate() {
    setDraft(createEmptySponsor());
    setEditingIndex("new");
  }

  function openEdit(index) {
    setDraft({
      ...sponsors[index],
      socials: { ...(sponsors[index]?.socials || {}) },
    });
    setEditingIndex(index);
  }

  function closeModal() {
    setEditingIndex(null);
    setDraft(null);
  }

  function saveModal() {
    if (!draft) return;
    if (editingIndex === "new") {
      onChange({ ...value, sponsors: [...sponsors, draft] });
    } else if (typeof editingIndex === "number") {
      onChange({
        ...value,
        sponsors: sponsors.map((sponsor, i) => (i === editingIndex ? draft : sponsor)),
      });
    }
    closeModal();
  }

  function confirmDelete() {
    if (typeof deleteIndex !== "number") return;
    onChange({ ...value, sponsors: sponsors.filter((_, i) => i !== deleteIndex) });
    setDeleteIndex(null);
  }

  function updateDraftSocial(key, url) {
    setDraft((prev) => ({
      ...prev,
      socials: { ...(prev?.socials || {}), [key]: url },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Eyebrow">
          <input
            className={inputClassName()}
            value={section.eyebrow || ""}
            disabled={disabled}
            onChange={(e) => updateSection({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClassName()}
            value={section.title || ""}
            disabled={disabled}
            onChange={(e) => updateSection({ title: e.target.value })}
          />
        </Field>
        <Field label="Subtitle">
          <input
            className={inputClassName()}
            value={section.subtitle || ""}
            disabled={disabled}
            onChange={(e) => updateSection({ subtitle: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
          disabled={disabled}
          onClick={openCreate}
        >
          Add sponsor
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Sponsor</th>
              <th className="px-3 py-2.5 font-medium">Tier</th>
              <th className="px-3 py-2.5 font-medium">Links</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!sponsors.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No sponsors configured for this season.
                </td>
              </tr>
            ) : (
              sponsors.map((sponsor, index) => {
                const linkCount = SPONSOR_SOCIAL_FIELDS.filter(({ key }) =>
                  String(sponsor.socials?.[key] || "").trim(),
                ).length;
                return (
                  <tr key={sponsor.id || index} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {sponsor.logoUrl ? (
                          <img
                            src={sponsor.logoUrl}
                            alt=""
                            className="size-10 rounded-lg border border-border bg-background object-contain p-1"
                          />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted/40 text-xs">
                            ?
                          </span>
                        )}
                        <div>
                          <p className="font-medium">{sponsor.name || "—"}</p>
                          {sponsor.tagline ? (
                            <p className="text-xs text-muted-foreground">{sponsor.tagline}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                        {sponsorTierLabel(sponsor)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {linkCount ? `${linkCount} link${linkCount === 1 ? "" : "s"}` : "No links"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          disabled={disabled}
                          onClick={() => openEdit(index)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-destructive hover:underline"
                          disabled={disabled}
                          onClick={() => setDeleteIndex(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminEditModal
        open={editingIndex != null && draft != null}
        title={editingIndex === "new" ? "Add sponsor" : "Edit sponsor"}
        description="Logo and links appear on the season detail sponsors tab."
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-outline" disabled={disabled} onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled} onClick={saveModal}>
              Save sponsor
            </button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClassName()}
                value={draft.name || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Tagline">
              <input
                className={inputClassName()}
                value={draft.tagline || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              />
            </Field>
            <Field label="Tier">
              <select
                className={inputClassName()}
                value={draft.tier || "partner"}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
              >
                {Object.entries(SPONSOR_TIERS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Display order">
              <input
                type="number"
                className={inputClassName()}
                value={draft.order ?? 0}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Logo URL">
              <input
                className={`${inputClassName()} sm:col-span-2`}
                value={draft.logoUrl || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                placeholder="/images/sponsors/logo.png or https://…"
              />
            </Field>
            {draft.logoUrl ? (
              <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <img
                  src={draft.logoUrl}
                  alt=""
                  className="h-14 w-24 rounded-lg border border-border bg-background object-contain p-1"
                />
                <span className="text-xs text-muted-foreground">Logo preview</span>
              </div>
            ) : null}
            <div className="sm:col-span-2 border-t border-border/60 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SPONSOR_SOCIAL_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <input
                      className={inputClassName()}
                      value={draft.socials?.[key] || ""}
                      disabled={disabled}
                      onChange={(e) => updateDraftSocial(key, e.target.value)}
                      placeholder={`${label} URL`}
                    />
                  </Field>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </AdminEditModal>

      <ConfirmDialog
        open={deleteIndex != null}
        title="Remove sponsor?"
        description="This sponsor will be removed from the season detail page."
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setDeleteIndex(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
