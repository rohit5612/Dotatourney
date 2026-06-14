import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { sortRolesByDefault } from "../../utils/teamPage.js";
import "../../styles/player-crm.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMatchLabel(request) {
  const parts = [];
  if (request.stage_key) parts.push(request.stage_key);
  if (request.round_index != null) parts.push(`R${Number(request.round_index) + 1}`);
  if (request.match_index != null) parts.push(`M${Number(request.match_index) + 1}`);
  const stage = parts.join(" · ");
  const teams = request.team1 && request.team2 ? `${request.team1} vs ${request.team2}` : "";
  const time = request.match_start_at ? new Date(request.match_start_at).toLocaleString() : "";
  return [stage, teams, time].filter(Boolean).join(" — ");
}

function statusBadgeClass(status) {
  if (status === "approved") return "player-crm__badge--approved";
  if (status === "pending") return "player-crm__badge--pending";
  if (status === "waitlisted") return "player-crm__badge--waitlisted";
  if (status === "rejected") return "player-crm__badge--rejected";
  return "";
}

function StatusBadge({ status }) {
  return (
    <span className={`player-crm__badge ${statusBadgeClass(status)}`}>
      {status || "pending"}
    </span>
  );
}

function DetailField({ label, value, mono = false }) {
  if (value == null || value === "") return null;
  return (
    <div className="player-crm__field">
      <span className="player-crm__field-label">{label}</span>
      <span className={`player-crm__field-value${mono ? " font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function SubstituteDetailModal({
  entry,
  canWrite,
  adminNotes,
  registrationStatus,
  onAdminNotesChange,
  onRegistrationStatusChange,
  onClose,
  onSave,
  saving,
}) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="substitute-crm-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="substitute-crm-modal-title" className="truncate font-serif text-xl">
              {entry.displayName || entry.steamName || entry.name || "Substitute pool entry"}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {entry.playerBpcId || "—"}
              {entry.playerSlug ? ` · /player/${entry.playerSlug}` : ""}
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="player-crm__modal-grid">
            <section className="player-crm__modal-section">
              <h4 className="player-crm__section-title">Player</h4>
              <div className="player-crm__field-grid">
                <DetailField label="Email" value={entry.email} />
                <DetailField label="Phone" value={entry.phoneNumber} />
                <DetailField label="MMR" value={entry.mmr != null ? String(entry.mmr) : null} />
                <DetailField
                  label="Roles"
                  value={entry.roles?.length ? sortRolesByDefault(entry.roles).join(", ") : null}
                />
                <DetailField label="Location" value={entry.location} />
                <DetailField label="Steam" value={entry.steamName} />
                <DetailField label="Discord" value={entry.discordHandle} />
                <DetailField label="Joined pool" value={formatDate(entry.createdAt)} />
              </div>
              {entry.playerSlug ? (
                <a
                  className="btn btn-outline btn-sm mt-3"
                  href={`/player/${entry.playerSlug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Public profile
                </a>
              ) : null}
            </section>

            {entry.notes ? (
              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">Player notes</h4>
                <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
              </section>
            ) : null}

            <section className="player-crm__modal-section player-crm__modal-section--notes">
              <h4 className="player-crm__section-title">Pool review</h4>
              <p className="mb-3 text-xs text-muted-foreground">Internal only — no emails are sent to the player.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="player-crm__field-label">Status</span>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={registrationStatus}
                    disabled={!canWrite}
                    onChange={(event) => onRegistrationStatusChange(event.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="waitlisted">Waitlisted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="player-crm__field-label">Admin notes</span>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
                    value={adminNotes}
                    disabled={!canWrite}
                    placeholder="Internal context for other admins…"
                    onChange={(event) => onAdminNotesChange(event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn btn-primary btn-sm" disabled={!canWrite || saving} onClick={onSave}>
                  {saving ? "Saving…" : "Save review"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignSubstitutePickerModal({ open, eligible, selectedId, onSelect, onClose }) {
  const [tab, setTab] = useState("active");

  const activePlayers = (eligible || []).filter((player) => !player.substituteFlag);
  const substitutePool = (eligible || []).filter((player) => player.substituteFlag);
  const list = tab === "active" ? activePlayers : substitutePool;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-sub-picker-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <h3 id="assign-sub-picker-title" className="font-serif text-lg">
            Select substitute
          </h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="flex gap-2 border-b border-border/60 px-4 py-2">
          <button
            type="button"
            className={`btn btn-sm${tab === "active" ? " btn-primary" : " btn-outline"}`}
            onClick={() => setTab("active")}
          >
            Active players ({activePlayers.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm${tab === "substitute" ? " btn-primary" : " btn-outline"}`}
            onClick={() => setTab("substitute")}
          >
            Substitute pool ({substitutePool.length})
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {list.length ? (
            <ul className="space-y-2">
              {list.map((player) => (
                <li key={player.registrationId}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors${
                      selectedId === player.registrationId
                        ? " border-primary bg-primary/10"
                        : " border-border hover:bg-muted/40"
                    }`}
                    onClick={() => {
                      onSelect(player.registrationId);
                      onClose();
                    }}
                  >
                    <span className="font-medium">{player.displayName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[player.bpcId, player.mmr != null ? `${player.mmr} MMR` : null].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {tab === "active" ? "No active roster players available." : "No substitute pool players available."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestRow({ request, eligible, tournamentId, canWrite, onDone, setMessage }) {
  const [assigneeId, setAssigneeId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [busy, setBusy] = useState(false);

  const selectedPlayer = (eligible || []).find((player) => player.registrationId === assigneeId) || null;

  async function assign() {
    if (!assigneeId) {
      setMessage?.("Select a substitute from the pool.");
      return;
    }
    setBusy(true);
    try {
      await api.assignSubstitutionRequest(tournamentId, request.id, {
        substituteRegistrationId: assigneeId,
        adminNotes: adminNotes.trim() || undefined,
      });
      await onDone();
    } catch (e) {
      setMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.patchSubstitutionRequest(tournamentId, request.id, {
        status: "rejected",
        adminNotes: adminNotes.trim(),
      });
      await onDone();
    } catch (e) {
      setMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="player-crm__request-card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">
            {request.requester_name || request.requester_bpc_id || "Player"}
            {request.team_name ? ` · ${request.team_name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{formatMatchLabel(request)}</p>
          {request.reason ? <p className="text-sm mt-1">Reason: {request.reason}</p> : null}
          {request.preferred_substitute_name ? (
            <p className="text-xs text-muted-foreground mt-1">
              Preferred: {request.preferred_substitute_name}
            </p>
          ) : null}
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.status === "pending" && canWrite ? (
        <div className="space-y-2 pt-1">
          <div className="block text-xs text-muted-foreground">
            <span>Assign substitute</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
                {selectedPlayer ? "Change selection" : "Select player…"}
              </button>
              {selectedPlayer ? (
                <span className="text-sm text-foreground">
                  {selectedPlayer.displayName}
                  {selectedPlayer.mmr != null ? ` · ${selectedPlayer.mmr} MMR` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <AssignSubstitutePickerModal
            open={pickerOpen}
            eligible={eligible}
            selectedId={assigneeId}
            onSelect={setAssigneeId}
            onClose={() => setPickerOpen(false)}
          />
          <label className="block text-xs text-muted-foreground">
            Admin notes
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </label>
          <div className="player-crm__inline-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={assign} disabled={busy}>
              Approve & assign
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reject} disabled={busy}>
              Reject
            </button>
          </div>
        </div>
      ) : request.admin_notes ? (
        <p className="text-xs text-muted-foreground">Notes: {request.admin_notes}</p>
      ) : null}
    </div>
  );
}

export function SubstituteCrmPage({ tournamentId, setMessage, canWrite = true }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [substitutes, setSubstitutes] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ pending: 0, approved: 0 });
  const [requests, setRequests] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, tournamentId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + substitutes.length, total);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function loadPool(pageOverride = currentPage) {
    if (!tournamentId) return;
    setLoadingPool(true);
    try {
      const safePage = Math.max(1, pageOverride);
      const data = await api.getSubstitutes(tournamentId, {
        search: debouncedSearch,
        limit: pageSize,
        offset: (safePage - 1) * pageSize,
      });
      setSubstitutes(data.substitutes || []);
      setTotal(data.total || 0);
      setSummary(data.summary || { pending: 0, approved: 0 });
      setRequests(data.requests || []);
      setEligible(data.eligible || []);
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setLoadingPool(false);
      setLoadingRequests(false);
    }
  }

  useEffect(() => {
    if (!tournamentId) return;
    setLoadingRequests(true);
    loadPool(page).catch(() => {});
  }, [tournamentId, debouncedSearch, page, pageSize]);

  function openDetail(entry) {
    setSelectedEntry(entry);
    setRegistrationStatus(entry.registrationStatus || "pending");
    setAdminNotes(entry.adminNotes || "");
  }

  function closeDetail() {
    setSelectedEntry(null);
    setAdminNotes("");
  }

  async function saveDetail() {
    if (!selectedEntry) return;
    setSaving(true);
    setMessage?.("");
    try {
      await api.updateSubstitutePoolEntry(tournamentId, selectedEntry.id, {
        registrationStatus,
        adminNotes,
      });
      setMessage?.("Substitute pool entry updated.");
      closeDetail();
      await loadPool(currentPage);
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!tournamentId) {
    return (
      <AdminGlassPanel>
        <p className="text-sm text-muted-foreground">Select a tournament in Setup.</p>
      </AdminGlassPanel>
    );
  }

  return (
    <div className="admin-page-stack player-crm">
      <AdminGlassPanel>
        <h2 className="admin-section-title">Substitution requests</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Match-day requests from rostered players — assign from the approved substitute pool below.
        </p>
        <div className="player-crm__request-panel">
          {(requests || []).map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              eligible={eligible}
              tournamentId={tournamentId}
              canWrite={canWrite}
              onDone={() => loadPool(currentPage)}
              setMessage={setMessage}
            />
          ))}
          {!loadingRequests && !requests?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No substitution requests.</p>
          ) : null}
        </div>
      </AdminGlassPanel>

      <AdminGlassPanel>
        <h2 className="admin-section-title">Substitute pool</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Review substitute signups — internal approval only, no player emails. Approved subs appear in match
          assignment dropdowns.
        </p>
        <input
          className="w-full max-w-md rounded border border-input bg-background/80 p-2 text-sm"
          placeholder="Search name, email, BPC ID, notes…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {loadingPool
            ? "Loading…"
            : `${summary.pending ?? 0} pending · ${summary.approved ?? 0} approved · Showing ${total ? pageStart + 1 : 0}-${pageEnd} of ${total}`}
        </p>

        <div className="player-crm__table-wrap mt-4">
          <table className="player-crm__table">
            <thead>
              <tr>
                <th>BPC ID</th>
                <th>Player</th>
                <th>Email</th>
                <th>Roles</th>
                <th>MMR</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {substitutes.map((entry) => (
                <tr key={entry.id}>
                  <td className="font-mono text-xs">{entry.playerBpcId || "—"}</td>
                  <td>
                    <div className="player-crm__name-cell">
                      <span>{entry.displayName || entry.steamName || entry.name || "—"}</span>
                    </div>
                  </td>
                  <td className="max-w-48 truncate text-xs">{entry.email}</td>
                  <td className="max-w-36 truncate text-xs">
                    {sortRolesByDefault(entry.roles).join(", ") || "—"}
                  </td>
                  <td>{entry.mmr ?? "—"}</td>
                  <td>
                    <StatusBadge status={entry.registrationStatus} />
                  </td>
                  <td>
                    <span className="player-crm__notes-preview" title={entry.notes || entry.adminNotes || ""}>
                      {entry.notes || entry.adminNotes || "—"}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">{formatDate(entry.createdAt).split(",")[0]}</td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openDetail(entry)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadingPool && !substitutes.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No substitute pool entries match your search.</p>
          ) : null}
        </div>
      </AdminGlassPanel>

      <AdminGlassPanel subtle className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          {loadingPool
            ? "Loading pool…"
            : `Showing ${total ? pageStart + 1 : 0}-${pageEnd} of ${total} pool entries`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground">
            Per page
            <select
              className="rounded-md border border-input bg-background p-2 text-foreground"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(1)} disabled={currentPage === 1 || loadingPool}>
            First
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loadingPool}
          >
            Previous
          </button>
          <span className="rounded-md border border-border px-3 py-2 text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || loadingPool}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage(totalPages)}
            disabled={currentPage === totalPages || loadingPool}
          >
            Last
          </button>
        </div>
      </AdminGlassPanel>

      {selectedEntry ? (
        <SubstituteDetailModal
          entry={selectedEntry}
          canWrite={canWrite}
          adminNotes={adminNotes}
          registrationStatus={registrationStatus}
          onAdminNotesChange={setAdminNotes}
          onRegistrationStatusChange={setRegistrationStatus}
          onClose={closeDetail}
          onSave={saveDetail}
          saving={saving}
        />
      ) : null}
    </div>
  );
}
