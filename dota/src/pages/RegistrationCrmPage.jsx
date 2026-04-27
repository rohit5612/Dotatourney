import { useMemo, useState } from "react";
import { api } from "../lib/api";

export function RegistrationCrmPage({ tournamentId, registrations, refreshRegistrations }) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [minMmr, setMinMmr] = useState("");
  const [maxMmr, setMaxMmr] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDraft, setArchiveDraft] = useState(null);
  const [confirmReady, setConfirmReady] = useState(null);
  const [actionMenuId, setActionMenuId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDrafts, setEditDrafts] = useState({});
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    return (registrations || [])
      .filter((registration) => (showArchived ? Boolean(registration.archivedAt) : !registration.archivedAt))
      .filter((registration) => !roleFilter || registration.roles?.includes(roleFilter))
      .filter((registration) => !statusFilter || registration.registrationStatus === statusFilter)
      .filter((registration) => !paymentFilter || registration.paymentStatus === paymentFilter)
      .filter((registration) => !minMmr || (Number(registration.mmr) || 0) >= Number(minMmr))
      .filter((registration) => !maxMmr || (Number(registration.mmr) || 0) <= Number(maxMmr))
      .filter((registration) => {
        const haystack = [
          registration.name,
          registration.phoneNumber,
          registration.discordHandle,
          registration.steamName,
          registration.steamProfile,
          registration.location,
        ]
          .join(" ")
          .toLowerCase();
        return !search || haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => (Number(b.mmr) || 0) - (Number(a.mmr) || 0));
  }, [registrations, roleFilter, statusFilter, paymentFilter, minMmr, maxMmr, search, showArchived]);

  async function updateRegistration(registrationId, payload) {
    try {
      await api.updateRegistration(tournamentId, registrationId, payload);
      await refreshRegistrations();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function archiveRegistration() {
    if (!archiveDraft || archiveDraft.confirmName !== archiveDraft.registration.name || !archiveDraft.reason.trim()) return;
    try {
      await api.archiveRegistration(tournamentId, archiveDraft.registration.id, archiveDraft.reason.trim());
      setArchiveDraft(null);
      await refreshRegistrations();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function isReady(registration) {
    return registration.paymentStatus === "paid" && registration.registrationStatus === "approved";
  }

  function beginEdit(registration) {
    setEditingId(registration.id);
    setActionMenuId("");
    setEditDrafts((prev) => ({
      ...prev,
      [registration.id]: {
        paymentStatus: registration.paymentStatus,
        registrationStatus: registration.registrationStatus,
        adminNotes: registration.adminNotes || "",
      },
    }));
  }

  function updateDraft(registrationId, patch) {
    setEditDrafts((prev) => ({
      ...prev,
      [registrationId]: {
        ...(prev[registrationId] || {}),
        ...patch,
      },
    }));
  }

  async function saveEdit(registrationId) {
    const draft = editDrafts[registrationId];
    if (!draft) return;
    await updateRegistration(registrationId, draft);
    setEditingId("");
  }

  async function markReady() {
    if (!confirmReady) return;
    await updateRegistration(confirmReady.id, { paymentStatus: "paid", registrationStatus: "approved" });
    setConfirmReady(null);
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">Registration CRM</h2>
            <p className="text-sm text-muted-foreground">Mark Discord payments manually, approve players, and use role/MMR sorting for team assignment.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-md border border-input bg-background p-2"
              placeholder="Search player, Steam, Discord"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="rounded-md border border-input bg-background p-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">All roles</option>
              {[...new Set((registrations || []).flatMap((registration) => registration.roles || []))].map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select className="rounded-md border border-input bg-background p-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="rounded-md border border-input bg-background p-2" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="">All payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
            <input className="w-28 rounded-md border border-input bg-background p-2" type="number" placeholder="Min MMR" value={minMmr} onChange={(event) => setMinMmr(event.target.value)} />
            <input className="w-28 rounded-md border border-input bg-background p-2" type="number" placeholder="Max MMR" value={maxMmr} onChange={(event) => setMaxMmr(event.target.value)} />
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              Show archived
            </label>
          </div>
        </div>
      </section>
      <div className="grid gap-3">
        {filtered.map((registration) => {
          const ready = isReady(registration);
          const editing = editingId === registration.id;
          const locked = Boolean(registration.archivedAt) || (ready && !editing);
          const draft = editDrafts[registration.id] || {
            paymentStatus: registration.paymentStatus,
            registrationStatus: registration.registrationStatus,
            adminNotes: registration.adminNotes || "",
          };

          return (
          <div key={registration.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg">{registration.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {registration.roles?.join(", ") || "No roles"} - {registration.mmr || "MMR TBA"} MMR - {registration.location || "No location"}
                </p>
                <p className="text-sm text-muted-foreground">Phone: {registration.phoneNumber || "N/A"}</p>
                <p className="text-sm text-muted-foreground">Steam: {registration.steamName} ({registration.steamProfile})</p>
                <p className="text-sm text-muted-foreground">Discord: {registration.discordHandle || "N/A"} - Submitted: {new Date(registration.createdAt).toLocaleString()}</p>
                {registration.paymentScreenshot ? (
                  <a
                    className="mt-2 inline-flex text-sm text-primary underline"
                    href={registration.paymentScreenshot}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View payment screenshot
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Payment screenshot: not uploaded or not available</p>
                )}
                {registration.notes ? <p className="mt-2 text-sm text-muted-foreground">Player notes: {registration.notes}</p> : null}
                {registration.archivedAt ? <p className="mt-2 text-sm text-secondary">Archived: {registration.archivedReason || "No reason recorded"}</p> : null}
              </div>
              <div className="text-sm">
                <div>Payment: <span className="capitalize text-secondary">{registration.paymentStatus}</span></div>
                <div>Status: <span className="capitalize text-secondary">{registration.registrationStatus}</span></div>
                {ready ? <div className="mt-1 text-xs text-muted-foreground">Locked until edited</div> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
              <select
                className="rounded-md border border-input bg-background p-2 disabled:opacity-60"
                value={editing ? draft.paymentStatus : registration.paymentStatus}
                disabled={locked}
                onChange={(event) =>
                  editing
                    ? updateDraft(registration.id, { paymentStatus: event.target.value })
                    : updateRegistration(registration.id, { paymentStatus: event.target.value })
                }
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                className="rounded-md border border-input bg-background p-2 disabled:opacity-60"
                value={editing ? draft.registrationStatus : registration.registrationStatus}
                disabled={locked}
                onChange={(event) =>
                  editing
                    ? updateDraft(registration.id, { registrationStatus: event.target.value })
                    : updateRegistration(registration.id, { registrationStatus: event.target.value })
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="rejected">Rejected</option>
              </select>
              <input
                className="rounded-md border border-input bg-background p-2 disabled:opacity-60"
                placeholder="Admin notes"
                value={editing ? draft.adminNotes : undefined}
                defaultValue={editing ? undefined : registration.adminNotes}
                disabled={locked}
                onChange={(event) => editing && updateDraft(registration.id, { adminNotes: event.target.value })}
                onBlur={(event) => !editing && !locked && updateRegistration(registration.id, { adminNotes: event.target.value })}
              />
              <div className="relative">
                <button type="button" className="btn btn-outline btn-block" onClick={() => setActionMenuId((prev) => (prev === registration.id ? "" : registration.id))}>
                  Actions
                </button>
                {actionMenuId === registration.id ? (
                  <div className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-border bg-card p-1 shadow-xl">
                    <button
                      type="button"
                      className="btn-menu"
                      disabled={Boolean(registration.archivedAt) || ready}
                      onClick={() => {
                        setConfirmReady(registration);
                        setActionMenuId("");
                      }}
                    >
                      Mark ready
                    </button>
                    <button
                      type="button"
                      className="btn-menu"
                      disabled={Boolean(registration.archivedAt)}
                      onClick={() => beginEdit(registration)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-menu text-destructive hover:text-destructive"
                      disabled={Boolean(registration.archivedAt)}
                      onClick={() => {
                        setArchiveDraft({ registration, confirmName: "", reason: "" });
                        setActionMenuId("");
                      }}
                    >
                      Archive
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {editing ? (
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setEditingId("")}>
                  Cancel edit
                </button>
                <button type="button" className="btn btn-primary" onClick={() => saveEdit(registration.id)}>
                  Save changes
                </button>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
      {confirmReady ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-4 shadow-2xl">
            <h3 className="font-serif text-lg">Mark registration ready?</h3>
            <p className="text-sm text-muted-foreground">
              This will mark <span className="font-medium text-foreground">{confirmReady.name}</span> as paid and approved, then lock the row until edited again.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmReady(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={markReady}>
                Confirm ready
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {archiveDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-4 shadow-2xl">
            <h3 className="font-serif text-lg">Archive registration</h3>
            <p className="text-sm text-muted-foreground">
              This is a soft archive. Type <span className="font-medium text-foreground">{archiveDraft.registration.name}</span> to confirm.
            </p>
            <input
              className="w-full rounded-md border border-input bg-background p-2"
              placeholder="Type player name"
              value={archiveDraft.confirmName}
              onChange={(event) => setArchiveDraft((prev) => ({ ...prev, confirmName: event.target.value }))}
            />
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background p-2"
              placeholder="Archive reason"
              value={archiveDraft.reason}
              onChange={(event) => setArchiveDraft((prev) => ({ ...prev, reason: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setArchiveDraft(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-destructive"
                disabled={archiveDraft.confirmName !== archiveDraft.registration.name || !archiveDraft.reason.trim()}
                onClick={archiveRegistration}
              >
                Archive registration
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
