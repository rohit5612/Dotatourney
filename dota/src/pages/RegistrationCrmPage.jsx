import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { sortRolesByDefault } from "../utils/teamPage.js";

function draftFromRegistration(registration) {
  return {
    paymentStatus: registration.paymentStatus,
    registrationStatus: registration.registrationStatus,
    adminNotes: registration.adminNotes || "",
    displayName: registration.displayName || registration.steamName || registration.name || "",
  };
}

function isDraftDirty(registration, draft) {
  return (
    draft.paymentStatus !== registration.paymentStatus ||
    draft.registrationStatus !== registration.registrationStatus ||
    (draft.adminNotes || "") !== (registration.adminNotes || "") ||
    (draft.displayName || "").trim() !== (registration.displayName || registration.steamName || registration.name || "").trim()
  );
}

export function RegistrationCrmPage({ tournamentId, registrations, refreshRegistrations }) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [minMmr, setMinMmr] = useState("");
  const [maxMmr, setMaxMmr] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortMode, setSortMode] = useState("date-desc");
  const [archiveDraft, setArchiveDraft] = useState(null);
  const [actionMenuId, setActionMenuId] = useState("");
  const [editDrafts, setEditDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [savingId, setSavingId] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState("");
  const [lightboxName, setLightboxName] = useState("");
  const [crmSheetSyncPending, setCrmSheetSyncPending] = useState(false);

  const filtered = useMemo(() => {
    const list = (registrations || [])
      .filter((registration) => (showArchived ? Boolean(registration.archivedAt) : !registration.archivedAt))
      .filter((registration) => !roleFilter || registration.roles?.includes(roleFilter))
      .filter((registration) => !statusFilter || registration.registrationStatus === statusFilter)
      .filter((registration) => !paymentFilter || registration.paymentStatus === paymentFilter)
      .filter((registration) => !minMmr || (Number(registration.mmr) || 0) >= Number(minMmr))
      .filter((registration) => !maxMmr || (Number(registration.mmr) || 0) <= Number(maxMmr))
      .filter((registration) => {
        const haystack = [
          registration.email,
          registration.publicCode,
          registration.name,
          registration.displayName,
          registration.phoneNumber,
          registration.discordHandle,
          registration.steamName,
          registration.steamProfile,
          registration.location,
        ]
          .join(" ")
          .toLowerCase();
        return !search || haystack.includes(search.toLowerCase());
      });

    return [...list].sort((a, b) => {
      if (sortMode === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortMode === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortMode === "updated-desc") return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      if (sortMode === "mmr-desc") return (Number(b.mmr) || 0) - (Number(a.mmr) || 0);
      return 0;
    });
  }, [registrations, roleFilter, statusFilter, paymentFilter, minMmr, maxMmr, search, showArchived, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter, paymentFilter, minMmr, maxMmr, search, showArchived, pageSize, sortMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function persistRegistration(registrationId, payload) {
    try {
      await api.updateRegistration(tournamentId, registrationId, payload);
      await refreshRegistrations();
    } catch (error) {
      setMessage(error.message);
      throw error;
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

  function updateDraft(registration, patch) {
    setEditDrafts((prev) => {
      const cur = prev[registration.id] ?? draftFromRegistration(registration);
      return { ...prev, [registration.id]: { ...cur, ...patch } };
    });
  }

  async function saveRegistration(registration) {
    const draft = editDrafts[registration.id] ?? draftFromRegistration(registration);
    setSavingId(registration.id);
    setMessage("");
    try {
      await persistRegistration(registration.id, draft);
      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[registration.id];
        return next;
      });
    } finally {
      setSavingId("");
    }
  }

  function openScreenshot(src, playerName) {
    if (!src?.trim()) {
      setMessage("No payment proof available for this registration.");
      return;
    }
    const trimmed = src.trim();
    if (trimmed.startsWith("data:image") || /^https?:\/\//i.test(trimmed)) {
      setLightboxSrc(trimmed);
      setLightboxName(playerName || "");
      return;
    }
    setMessage("Unsupported screenshot format — contact support if this persists.");
  }

  function getStoredSpreadsheetId() {
    if (!tournamentId) return "";
    try {
      return window.localStorage.getItem(`bpcl-google-sheet:${tournamentId}`)?.trim() || "";
    } catch {
      return "";
    }
  }

  function getStoredSheetTabName() {
    if (!tournamentId) return "";
    try {
      return window.localStorage.getItem(`bpcl-google-sheet-tab:${tournamentId}`)?.trim() || "";
    } catch {
      return "";
    }
  }

  async function syncCrmToGoogleSheet() {
    if (!tournamentId) return;
    const spreadsheetId = getStoredSpreadsheetId();
    if (!spreadsheetId) {
      setMessage("Set the spreadsheet ID under Admin → Setup → Google Sheets, then try again.");
      return;
    }
    const sheetTab = getStoredSheetTabName();
    const n = filtered.length;
    const tabHint = sheetTab ? `the “${sheetTab}” tab` : "the first worksheet tab";
    const confirmed = window.confirm(
      `Sync ${n} registration row(s) to Google Sheets?\n\n` +
        `${tabHint} will be cleared from C5 through K2004, then filled from row 5:\n` +
        "C name · D Steam name · E MMR · F roles · G Discord · H phone · I Steam profile link · J status · K notes",
    );
    if (!confirmed) return;
    setMessage("");
    setCrmSheetSyncPending(true);
    try {
      const payload = {
        spreadsheetId,
        registrationIds: filtered.map((r) => r.id),
      };
      if (sheetTab) payload.sheetName = sheetTab;
      const result = await api.syncGoogleSheetsRegistrations(tournamentId, payload);
      setMessage(
        `Google Sheet updated — tab “${result.sheetTitle}”, ${result.rowsWritten} row(s) written (${result.range}).`,
      );
    } catch (error) {
      setMessage(error.message || "Google Sheets sync failed.");
    } finally {
      setCrmSheetSyncPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-serif text-lg">Registration CRM</h2>
            <p className="text-sm text-muted-foreground">
              Review payment and player details, then click <span className="font-medium text-foreground">Save</span> to apply changes. Status emails (paid /
              unpaid / refunded and approved / rejected / waitlisted) send when you save and payment or registration status has changed.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              className="btn btn-outline btn-sm shrink-0"
              onClick={syncCrmToGoogleSheet}
              disabled={!tournamentId || crmSheetSyncPending}
            >
              {crmSheetSyncPending ? "Syncing…" : "Sync to Google Sheet"}
            </button>
            <p className="max-w-md text-right text-xs text-muted-foreground">
              Uses spreadsheet ID + worksheet tab from Setup (per tournament). CRM writes <span className="font-mono text-foreground">C5:K…</span> on that tab; leave tab
              name empty in Setup to use the first tab.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              className="min-w-0 w-full rounded-md border border-input bg-background p-2 sm:w-56 sm:flex-1 md:max-w-xs lg:max-w-sm"
              placeholder="Search email, code, player, Steam, Discord"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="rounded-md border border-input bg-background p-2" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="date-desc">Date: newest first</option>
              <option value="date-asc">Date: oldest first</option>
              <option value="updated-desc">Last updated: newest</option>
              <option value="mmr-desc">MMR: high to low</option>
            </select>
            <select className="rounded-md border border-input bg-background p-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">All roles</option>
              {[...new Set((registrations || []).flatMap((registration) => registration.roles || []))].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
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
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
        <div className="text-muted-foreground">
          Showing {filtered.length ? pageStart + 1 : 0}-{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length} registrations
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground">
            Per page
            <select className="rounded-md border border-input bg-background p-2 text-foreground" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(1)} disabled={currentPage === 1}>
            First
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span className="rounded-md border border-border px-3 py-2 text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
            Next
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>
            Last
          </button>
        </div>
      </section>
      <div className="grid gap-3">
        {paginated.map((registration) => {
          const archived = Boolean(registration.archivedAt);
          const draft = editDrafts[registration.id] ?? draftFromRegistration(registration);
          const dirty = !archived && isDraftDirty(registration, draft);

          return (
            <div key={registration.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg">{registration.displayName || registration.steamName || registration.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Legal name: {registration.name} · {sortRolesByDefault(registration.roles).join(", ") || "No roles"} - {registration.mmr || "MMR TBA"} MMR - {registration.location || "No location"}
                  </p>
                  <p className="text-sm text-muted-foreground">Phone: {registration.phoneNumber || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">
                    Steam: {registration.steamName} ({registration.steamProfile})
                  </p>
                  <p className="text-sm text-muted-foreground">Discord: {registration.discordHandle || "N/A"} - Submitted: {new Date(registration.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    Email: {registration.email || "N/A"}
                    {registration.playerBpcId || registration.publicCode ? (
                      <>
                        {" "}
                        — ID:{" "}
                        <span className="font-mono text-foreground">
                          {registration.playerBpcId || registration.publicCode}
                        </span>
                      </>
                    ) : null}
                    {registration.playerSlug ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={`/player/${registration.playerSlug}`}
                          className="text-primary underline hover:no-underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Profile
                        </a>
                      </>
                    ) : null}
                    {registration.registrationFlowStage ? ` — Flow: ${registration.registrationFlowStage}` : null}
                  </p>
                  {registration.paymentScreenshot ? (
                    <button
                      type="button"
                      className="mt-2 text-sm text-primary underline hover:no-underline"
                      onClick={() => openScreenshot(registration.paymentScreenshot, registration.name)}
                    >
                      View payment screenshot
                    </button>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Payment screenshot: not uploaded or not available</p>
                  )}
                  {registration.playerAccountId ? (
                    <button
                      type="button"
                      className="mt-2 text-sm text-accent underline hover:no-underline"
                      onClick={async () => {
                        const raw = window.prompt("Grant BPC coins (use negative to deduct):", "10");
                        if (raw == null) return;
                        const delta = Number(raw);
                        if (!Number.isFinite(delta) || delta === 0) return;
                        try {
                          await api.grantPlayerCoins(registration.playerAccountId, { delta, reason: "CRM grant" });
                          window.alert(`Granted ${delta} coins.`);
                        } catch (err) {
                          window.alert(err.message);
                        }
                      }}
                    >
                      Grant BPC coins
                    </button>
                  ) : null}
                  {registration.notes ? <p className="mt-2 text-sm text-muted-foreground">Player notes: {registration.notes}</p> : null}
                  {registration.archivedAt ? <p className="mt-2 text-sm text-secondary">Archived: {registration.archivedReason || "No reason recorded"}</p> : null}
                </div>
                <div className="text-sm">
                  <div>
                    Payment: <span className="capitalize text-secondary">{registration.paymentStatus}</span>
                  </div>
                  <div>
                    Status: <span className="capitalize text-secondary">{registration.registrationStatus}</span>
                  </div>
                  {dirty ? <div className="mt-1 text-xs text-amber-600 dark:text-amber-500">Unsaved changes</div> : null}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end">
                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr]">
                  <input
                    className="rounded-md border border-input bg-background p-2 disabled:opacity-60 sm:col-span-2 lg:col-span-1"
                    placeholder="Display name (shown on teams)"
                    value={draft.displayName}
                    disabled={archived}
                    onChange={(event) => updateDraft(registration, { displayName: event.target.value })}
                  />
                  <select
                    className="rounded-md border border-input bg-background p-2 disabled:opacity-60"
                    value={draft.paymentStatus}
                    disabled={archived}
                    onChange={(event) => updateDraft(registration, { paymentStatus: event.target.value })}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <select
                    className="rounded-md border border-input bg-background p-2 disabled:opacity-60"
                    value={draft.registrationStatus}
                    disabled={archived}
                    onChange={(event) => updateDraft(registration, { registrationStatus: event.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="waitlisted">Waitlisted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <input
                    className="rounded-md border border-input bg-background p-2 disabled:opacity-60 sm:col-span-2 lg:col-span-1"
                    placeholder="Admin notes"
                    value={draft.adminNotes}
                    disabled={archived}
                    onChange={(event) => updateDraft(registration, { adminNotes: event.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={archived || !dirty || savingId === registration.id}
                    onClick={() => saveRegistration(registration)}
                  >
                    {savingId === registration.id ? "Saving…" : "Save"}
                  </button>
                  <div className="relative">
                    <button type="button" className="btn btn-outline btn-block min-w-28" onClick={() => setActionMenuId((prev) => (prev === registration.id ? "" : registration.id))}>
                      Actions
                    </button>
                    {actionMenuId === registration.id ? (
                      <div className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-border bg-card p-1 shadow-xl">
                        <button
                          type="button"
                          className="btn-menu text-destructive hover:text-destructive"
                          disabled={archived}
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
              </div>
            </div>
          );
        })}
        {!paginated.length ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">No registrations match the current filters.</div>
        ) : null}
      </div>
      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxName ? `Payment screenshot — ${lightboxName}` : "Payment screenshot"}
          onClick={() => setLightboxSrc("")}
        >
          <div className="relative max-h-[92vh] max-w-[min(96vw,1100px)] overflow-auto rounded-lg border border-border bg-card p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">{lightboxName ? `${lightboxName} — payment proof` : "Payment proof"}</span>
              <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setLightboxSrc("")}>
                Close
              </button>
            </div>
            <img src={lightboxSrc} alt="Payment proof" className="mx-auto max-h-[80vh] w-auto object-contain" />
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
