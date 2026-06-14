import { useMemo, useState } from "react";
import { ConfirmDialog } from "../users/ConfirmDialog.jsx";
import { AdminEditModal } from "./AdminEditModal.jsx";
import {
  ORG_ROSTER_TIER_META,
  ORG_ROSTER_TIERS,
  createEmptyOrgMember,
} from "../../utils/seasonContentSchema.js";

function tierLabel(tier) {
  return ORG_ROSTER_TIER_META[tier]?.label || tier;
}

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

export function OrgRosterEditor({ value, onChange, disabled = false }) {
  const section = value?.section || {};
  const members = Array.isArray(value?.members) ? value.members : [];
  const [tierFilter, setTierFilter] = useState("all");
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);

  const filteredMembers = useMemo(() => {
    const rows = members.map((member, index) => ({ member, index }));
    if (tierFilter === "all") return rows;
    return rows.filter(({ member }) => member.tier === tierFilter);
  }, [members, tierFilter]);

  function updateSection(patch) {
    onChange({ ...value, section: { ...section, ...patch } });
  }

  function openCreate(tier = "admin") {
    setDraft(createEmptyOrgMember(tier));
    setEditingIndex("new");
  }

  function openEdit(index) {
    setDraft({ ...members[index] });
    setEditingIndex(index);
  }

  function closeModal() {
    setEditingIndex(null);
    setDraft(null);
  }

  function saveModal() {
    if (!draft) return;
    if (editingIndex === "new") {
      onChange({ ...value, members: [...members, draft] });
    } else if (typeof editingIndex === "number") {
      onChange({
        ...value,
        members: members.map((member, i) => (i === editingIndex ? draft : member)),
      });
    }
    closeModal();
  }

  function confirmDelete() {
    if (typeof deleteIndex !== "number") return;
    onChange({ ...value, members: members.filter((_, i) => i !== deleteIndex) });
    setDeleteIndex(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Section eyebrow">
          <input
            className={inputClassName()}
            value={section.eyebrow || ""}
            disabled={disabled}
            onChange={(e) => updateSection({ eyebrow: e.target.value })}
          />
        </Field>
        <Field label="Section title">
          <input
            className={inputClassName()}
            value={section.title || ""}
            disabled={disabled}
            onChange={(e) => updateSection({ title: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tierFilter === "all" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
            disabled={disabled}
            onClick={() => setTierFilter("all")}
          >
            All ({members.length})
          </button>
          {ORG_ROSTER_TIERS.map((tier) => {
            const count = members.filter((m) => m.tier === tier).length;
            return (
              <button
                key={tier}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tierFilter === tier ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                disabled={disabled}
                onClick={() => setTierFilter(tier)}
              >
                {tierLabel(tier)} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {ORG_ROSTER_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40"
              disabled={disabled}
              onClick={() => openCreate(tier)}
            >
              Add {tierLabel(tier).slice(0, -1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Member</th>
              <th className="px-3 py-2.5 font-medium">Real name</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Tier</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!filteredMembers.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No members in this view.
                </td>
              </tr>
            ) : (
              filteredMembers.map(({ member, index }) => (
                <tr key={member.id || index} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="size-9 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full border border-border bg-muted/40 text-xs font-semibold">
                          ?
                        </span>
                      )}
                      <span className="font-medium">{member.gamerTag || "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{member.realName || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{member.role || "—"}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {tierLabel(member.tier)}
                    </span>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminEditModal
        open={editingIndex != null && draft != null}
        title={editingIndex === "new" ? "Add team member" : "Edit team member"}
        description="Shown on the public landing page under the member's tier group."
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-outline" disabled={disabled} onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled} onClick={saveModal}>
              Save member
            </button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gamer tag">
              <input
                className={inputClassName()}
                value={draft.gamerTag || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, gamerTag: e.target.value })}
              />
            </Field>
            <Field label="Real name">
              <input
                className={inputClassName()}
                value={draft.realName || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, realName: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <input
                className={inputClassName()}
                value={draft.role || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
            </Field>
            <Field label="Tier">
              <select
                className={inputClassName()}
                value={draft.tier || "admin"}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
              >
                {ORG_ROSTER_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tierLabel(tier)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Avatar URL">
              <input
                className={`${inputClassName()} sm:col-span-2`}
                value={draft.avatarUrl || ""}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
              />
            </Field>
            {draft.avatarUrl ? (
              <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <img src={draft.avatarUrl} alt="" className="size-14 rounded-full border border-border object-cover" />
                <span className="text-xs text-muted-foreground">Avatar preview</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminEditModal>

      <ConfirmDialog
        open={deleteIndex != null}
        title="Remove team member?"
        description="This member will be removed from the public org roster."
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setDeleteIndex(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
