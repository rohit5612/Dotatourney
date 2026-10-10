import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { PrimaryViewTabs } from "../../components/navigation/TournamentTabs.jsx";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { sortRolesByDefault } from "../../utils/teamPage.js";
import {
  buildSubstitutePoolSheetSyncConfirmMessage,
  getSubstitutePoolGoogleSheetPrefs,
  parseSpreadsheetId,
  setSubstitutePoolGoogleSheetPrefs,
  SUB_POOL_SHEET_COLUMN_HINT,
} from "../../utils/googleSheetPrefs.js";
import "../../styles/player-crm.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const SUB_CRM_TABS = [
  { id: "requests", label: "Requests" },
  { id: "pool", label: "Sub pool" },
];

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

function formatMatchNo(request) {
  const parts = [];
  if (request.stage_key) parts.push(request.stage_key);
  if (request.round_index != null) parts.push(`R${Number(request.round_index) + 1}`);
  if (request.match_index != null) parts.push(`M${Number(request.match_index) + 1}`);
  return parts.join(" · ") || "—";
}

function formatMatchDateTime(request) {
  if (!request.match_start_at) return "—";
  return new Date(request.match_start_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTeamsLabel(request) {
  if (request.team1 && request.team2) return `${request.team1} vs ${request.team2}`;
  return "—";
}

function formatMatchLabel(request) {
  return [formatMatchNo(request), formatTeamsLabel(request), formatMatchDateTime(request)]
    .filter((part) => part && part !== "—")
    .join(" — ");
}

function getAvailabilityText(entry) {
  const raw = String(entry?.notes || "").trim();
  if (!raw) return "";
  const availabilityParts = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^availability:/i.test(trimmed)) {
      availabilityParts.push(trimmed.replace(/^availability:\s*/i, ""));
    }
  }
  if (availabilityParts.length) return availabilityParts.join("; ");
  return raw;
}

function truncateText(text, max = 120) {
  if (!text || text === "—") return "—";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function playerDisplayName(entry) {
  return entry.displayName || entry.steamName || entry.name || "—";
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
  readOnly = false,
  adminNotes,
  registrationStatus,
  onAdminNotesChange,
  onRegistrationStatusChange,
  onClose,
  onSave,
  saving,
}) {
  if (!entry) return null;
  const canEditReview = canWrite && !readOnly;

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
              {readOnly ? "Substitute details" : "Review substitute"} — {playerDisplayName(entry)}
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

            {getAvailabilityText(entry) ? (
              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">Availability notes</h4>
                <p className="text-sm whitespace-pre-wrap">{getAvailabilityText(entry)}</p>
              </section>
            ) : null}

            {entry.notes && getAvailabilityText(entry) !== entry.notes ? (
              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">Player notes</h4>
                <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
              </section>
            ) : null}

            <section className="player-crm__modal-section player-crm__modal-section--notes">
              <h4 className="player-crm__section-title">Pool review</h4>
              <p className="mb-3 text-xs text-muted-foreground">Internal only — no emails are sent to the player.</p>
              {readOnly ? (
                <div className="player-crm__field-grid">
                  <DetailField label="Status" value={entry.registrationStatus || "pending"} />
                  <DetailField label="Admin notes" value={entry.adminNotes} />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="player-crm__field-label">Status</span>
                      <select
                        className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                        value={registrationStatus}
                        disabled={!canEditReview}
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
                        disabled={!canEditReview}
                        placeholder="Internal context for other admins…"
                        onChange={(event) => onAdminNotesChange(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!canEditReview || saving}
                      onClick={onSave}
                    >
                      {saving ? "Saving…" : "Save review"}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTargetMatchLabel(match, teamName = "") {
  const parts = [];
  if (match.stageKey) parts.push(match.stageKey);
  if (match.roundIndex != null) parts.push(`R${Number(match.roundIndex) + 1}`);
  if (match.matchIndex != null) parts.push(`M${Number(match.matchIndex) + 1}`);
  const stage = parts.join(" · ");
  const opponent =
    teamName && match.team1?.toLowerCase() === teamName.toLowerCase()
      ? match.team2
      : teamName && match.team2?.toLowerCase() === teamName.toLowerCase()
        ? match.team1
        : null;
  const teams =
    opponent && teamName
      ? `vs ${opponent}`
      : match.team1 && match.team2
        ? `${match.team1} vs ${match.team2}`
        : "";
  const time = match.startAt ? new Date(match.startAt).toLocaleString() : "";
  return [stage, teams, time].filter(Boolean).join(" — ");
}

function collectTeamNames(matches) {
  const names = new Set();
  for (const match of matches || []) {
    if (match.team1?.trim()) names.add(match.team1.trim());
    if (match.team2?.trim()) names.add(match.team2.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function matchIncludesTeam(match, teamName) {
  const normalized = teamName.toLowerCase();
  return match.team1?.toLowerCase() === normalized || match.team2?.toLowerCase() === normalized;
}

function getLineupForTeam(match, teamName) {
  if (!match || !teamName) return [];
  if (match.team1?.toLowerCase() === teamName.toLowerCase()) return match.lineups?.team1 || [];
  if (match.team2?.toLowerCase() === teamName.toLowerCase()) return match.lineups?.team2 || [];
  return [];
}

function playerMatchesSearch(player, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [player.displayName, player.bpcId].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

function ManualAssignSubModal({
  open,
  tournamentId,
  eligible,
  canWrite,
  onClose,
  onDone,
  setMessage,
}) {
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [replacedPlayerAccountId, setReplacedPlayerAccountId] = useState("");
  const [substituteRegistrationId, setSubstituteRegistrationId] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  useEffect(() => {
    if (!open || !tournamentId) return;
    setLoadingTargets(true);
    api
      .getSubstitutionTargets(tournamentId)
      .then((data) => setTargets(data.matches || []))
      .catch((error) => setMessage?.(error.message))
      .finally(() => setLoadingTargets(false));
  }, [open, tournamentId, setMessage]);

  useEffect(() => {
    if (!open) {
      setSelectedTeamName("");
      setMatchId("");
      setReplacedPlayerAccountId("");
      setSubstituteRegistrationId("");
      setAdminNotes("");
      setMatchSearch("");
      setPlayerSearch("");
    }
  }, [open]);

  const teamOptions = collectTeamNames(targets);
  const selectedMatch = (targets || []).find((match) => match.id === matchId) || null;
  const teamMatches = (targets || []).filter((match) => matchIncludesTeam(match, selectedTeamName));
  const filteredMatches = teamMatches.filter((match) => {
    const q = matchSearch.trim().toLowerCase();
    if (!q) return true;
    return formatTargetMatchLabel(match, selectedTeamName).toLowerCase().includes(q);
  });
  const lineupPlayers = getLineupForTeam(selectedMatch, selectedTeamName);
  const replaceablePlayers = lineupPlayers
    .filter((player) => !player.isSubstitute)
    .filter((player) => playerMatchesSearch(player, playerSearch));
  const selectedSubstitute =
    (eligible || []).find((player) => player.registrationId === substituteRegistrationId) || null;

  const canAssign =
    canWrite && selectedTeamName && matchId && replacedPlayerAccountId && substituteRegistrationId && !busy;

  async function assign() {
    if (!canAssign) return;
    setBusy(true);
    setMessage?.("");
    try {
      await api.manualAssignSubstitute(tournamentId, {
        matchId,
        replacedPlayerAccountId,
        substituteRegistrationId,
        adminNotes: adminNotes.trim() || undefined,
      });
      setMessage?.("Substitute assigned.");
      onClose();
      await onDone();
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-assign-sub-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="manual-assign-sub-title" className="font-serif text-xl">
              Manual substitute assignment
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a sub without a player request — for Discord or other off-platform requests.
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <label className="block text-sm">
            <span className="player-crm__field-label">Team</span>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
              value={selectedTeamName}
              disabled={loadingTargets || !canWrite}
              onChange={(event) => {
                setSelectedTeamName(event.target.value);
                setMatchId("");
                setReplacedPlayerAccountId("");
                setMatchSearch("");
                setPlayerSearch("");
              }}
            >
              <option value="">{loadingTargets ? "Loading teams…" : "Select team"}</option>
              {teamOptions.map((teamName) => (
                <option key={teamName} value={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
          </label>

          {selectedTeamName ? (
            <label className="block text-sm">
              <span className="player-crm__field-label">Match</span>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Search matches…"
                value={matchSearch}
                onChange={(event) => setMatchSearch(event.target.value)}
              />
              <select
                className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
                value={matchId}
                disabled={!canWrite}
                onChange={(event) => {
                  setMatchId(event.target.value);
                  setReplacedPlayerAccountId("");
                  setPlayerSearch("");
                }}
              >
                <option value="">
                  {teamMatches.length ? "Select a match" : "No upcoming matches for this team"}
                </option>
                {filteredMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {formatTargetMatchLabel(match, selectedTeamName)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedMatch ? (
            <label className="block text-sm">
              <span className="player-crm__field-label">Player to replace</span>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Search by name or BPC ID…"
                value={playerSearch}
                disabled={!canWrite}
                onChange={(event) => setPlayerSearch(event.target.value)}
              />
              <select
                className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
                value={replacedPlayerAccountId}
                disabled={!canWrite}
                onChange={(event) => setReplacedPlayerAccountId(event.target.value)}
              >
                <option value="">Select player</option>
                {replaceablePlayers.map((player) => (
                  <option key={player.playerAccountId} value={player.playerAccountId}>
                    {[player.displayName, player.bpcId].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
              {!lineupPlayers.filter((player) => !player.isSubstitute).length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No rostered players available to replace on this team.
                </p>
              ) : replaceablePlayers.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No players match your search.</p>
              ) : null}
            </label>
          ) : null}

          <div className="block text-sm">
            <span className="player-crm__field-label">Substitute</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!canWrite}
                onClick={() => setPickerOpen(true)}
              >
                {selectedSubstitute ? "Change selection" : "Select player…"}
              </button>
              {selectedSubstitute ? (
                <span className="text-sm text-foreground">
                  {selectedSubstitute.displayName}
                  {selectedSubstitute.mmr != null ? ` · ${selectedSubstitute.mmr} MMR` : ""}
                </span>
              ) : null}
            </div>
          </div>

          <AssignSubstitutePickerModal
            open={pickerOpen}
            eligible={eligible}
            selectedId={substituteRegistrationId}
            onSelect={setSubstituteRegistrationId}
            onClose={() => setPickerOpen(false)}
          />

          <label className="block text-sm">
            <span className="player-crm__field-label">Admin notes</span>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
              value={adminNotes}
              disabled={!canWrite}
              placeholder="Optional — e.g. Discord request context"
              onChange={(event) => setAdminNotes(event.target.value)}
            />
          </label>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-4 py-4 sm:px-5">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={assign} disabled={!canAssign}>
            {busy ? "Assigning…" : "Assign substitute"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function AssignSubstitutePickerModal({ open, eligible, selectedId, onSelect, onClose }) {
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const activePlayers = (eligible || []).filter((player) => !player.substituteFlag);
  const substitutePool = (eligible || []).filter((player) => player.substituteFlag);
  const baseList = tab === "active" ? activePlayers : substitutePool;
  const list = baseList.filter((player) => playerMatchesSearch(player, search));

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

        <div className="border-b border-border/60 px-4 py-2">
          <input
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
            placeholder="Search by name or BPC ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
              {search.trim()
                ? "No players match your search."
                : tab === "active"
                  ? "No active roster players available."
                  : "No substitute pool players available."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPlayerLabel(name, bpcId) {
  const parts = [name, bpcId].filter(Boolean);
  return parts.join(" · ") || "Player";
}

function SubstitutionPlayersLine({ request }) {
  const outLabel = formatPlayerLabel(request.requester_name, request.requester_bpc_id);
  const inLabel = request.substitute_name
    ? formatPlayerLabel(request.substitute_name, request.substitute_bpc_id)
    : null;

  return (
    <p className="text-sm mt-1">
      <span className="text-muted-foreground">Out:</span> {outLabel}
      {inLabel ? (
        <>
          {" "}
          <span className="text-muted-foreground">→ In:</span> {inLabel}
        </>
      ) : request.status === "pending" ? (
        <span className="text-muted-foreground"> (awaiting substitute)</span>
      ) : null}
    </p>
  );
}

function RequestViewModal({ request, onClose }) {
  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="substitution-request-view-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="substitution-request-view-title" className="font-serif text-xl">Substitution request</h3>
            <p className="mt-1 text-sm text-muted-foreground">{formatMatchLabel(request)}</p>
          </div>
          <StatusBadge status={request.status} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="player-crm__field-grid">
            <DetailField label="Player requesting sub" value={formatPlayerLabel(request.requester_name, request.requester_bpc_id)} />
            <DetailField label="Team" value={request.team_name} />
            <DetailField label="Match no." value={formatMatchNo(request)} />
            <DetailField label="Match time" value={formatMatchDateTime(request)} />
            <DetailField label="Teams" value={formatTeamsLabel(request)} />
            <DetailField label="Reason" value={request.reason} />
            <DetailField label="Preferred substitute" value={request.preferred_substitute_name} />
            <DetailField
              label="Assigned substitute"
              value={
                request.substitute_name
                  ? formatPlayerLabel(request.substitute_name, request.substitute_bpc_id)
                  : null
              }
            />
            <DetailField label="Admin notes" value={request.admin_notes} />
            <DetailField label="Requested" value={formatDate(request.created_at)} />
            <DetailField label="Updated" value={formatDate(request.updated_at)} />
          </div>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-border/60 px-4 py-4 sm:px-5">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

function RequestEditModal({ request, eligible, tournamentId, canWrite, onClose, onDone, setMessage }) {
  const [assigneeId, setAssigneeId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request?.admin_notes || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request) setAdminNotes(request.admin_notes || "");
    setAssigneeId("");
  }, [request?.id]);

  if (!request) return null;

  const selectedPlayer = (eligible || []).find((player) => player.registrationId === assigneeId) || null;
  const canCancel = canWrite && (request.status === "pending" || request.status === "approved");
  const canAssignPending = canWrite && request.status === "pending";

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
      onClose();
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
      onClose();
      await onDone();
    } catch (e) {
      setMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel this substitution? Lineups and notifications will be updated.")) return;
    setBusy(true);
    try {
      await api.patchSubstitutionRequest(tournamentId, request.id, {
        status: "cancelled",
        adminNotes: adminNotes.trim() || undefined,
      });
      setMessage?.("Substitution cancelled.");
      onClose();
      await onDone();
    } catch (e) {
      setMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="substitution-request-edit-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="substitution-request-edit-title" className="font-serif text-xl">Manage request</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPlayerLabel(request.requester_name, request.requester_bpc_id)} · {formatMatchNo(request)}
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <SubstitutionPlayersLine request={request} />
          {request.reason ? <p className="text-sm text-muted-foreground">Reason: {request.reason}</p> : null}

          {canAssignPending ? (
            <div className="player-crm__modal-section">
              <h4 className="player-crm__section-title">Assign substitute</h4>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
                  {selectedPlayer ? "Change selection" : "Select player…"}
                </button>
                {selectedPlayer ? (
                  <span className="text-sm">
                    {selectedPlayer.displayName}
                    {selectedPlayer.mmr != null ? ` · ${selectedPlayer.mmr} MMR` : ""}
                  </span>
                ) : null}
              </div>
              <AssignSubstitutePickerModal
                open={pickerOpen}
                eligible={eligible}
                selectedId={assigneeId}
                onSelect={setAssigneeId}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          ) : null}

          {(canAssignPending || canCancel) && canWrite ? (
            <label className="block text-sm">
              <span className="player-crm__field-label">Admin notes</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
                value={adminNotes}
                disabled={!canWrite || busy}
                placeholder="Optional internal notes"
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </label>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 px-4 py-4 sm:px-5">
          {canAssignPending ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={assign} disabled={busy}>
                {busy ? "Working…" : "Approve & assign"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reject} disabled={busy}>
                Reject
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={cancel} disabled={busy}>
                Cancel request
              </button>
            </>
          ) : canCancel ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancel} disabled={busy}>
              Cancel substitution
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Close
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export function SubstituteCrmPage({ tournamentId, setMessage, canWrite = true }) {
  const [crmTab, setCrmTab] = useState("requests");
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
  const [poolModalReadOnly, setPoolModalReadOnly] = useState(false);
  const [viewRequest, setViewRequest] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualAssignOpen, setManualAssignOpen] = useState(false);
  const [subSheetId, setSubSheetId] = useState("");
  const [subSheetTabName, setSubSheetTabName] = useState("");
  const [subSheetSyncPending, setSubSheetSyncPending] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setSubSheetId("");
      setSubSheetTabName("");
      return;
    }
    const prefs = getSubstitutePoolGoogleSheetPrefs(tournamentId);
    setSubSheetId(prefs.spreadsheetId);
    setSubSheetTabName(prefs.sheetTabName);
  }, [tournamentId]);

  function persistSubSheetPrefs() {
    if (!tournamentId) return;
    setSubstitutePoolGoogleSheetPrefs(tournamentId, {
      spreadsheetId: subSheetId,
      sheetTabName: subSheetTabName,
    });
    setMessage?.("Substitute pool sheet link saved for this season.");
  }

  async function syncSubPoolToGoogleSheet() {
    if (!tournamentId || subSheetSyncPending) return;
    const spreadsheetId = parseSpreadsheetId(subSheetId);
    if (!spreadsheetId) {
      setMessage?.("Enter a spreadsheet ID or full Google Sheets link, then try again.");
      return;
    }
    const sheetTab = subSheetTabName.trim();
    setSubstitutePoolGoogleSheetPrefs(tournamentId, {
      spreadsheetId: subSheetId,
      sheetTabName: subSheetTabName,
    });
    const confirmed = window.confirm(
      buildSubstitutePoolSheetSyncConfirmMessage({ rowCount: total, sheetTabName: sheetTab }),
    );
    if (!confirmed) return;
    setMessage?.("");
    setSubSheetSyncPending(true);
    try {
      const payload = { spreadsheetId };
      if (sheetTab) payload.sheetName = sheetTab;
      const result = await api.syncGoogleSheetsSubstitutePool(tournamentId, payload);
      setMessage?.(
        `Substitute pool sheet updated — tab “${result.sheetTitle}”, ${result.rowsWritten} row(s) written (${result.range}).`,
      );
    } catch (error) {
      setMessage?.(error.message || "Google Sheets sync failed.");
    } finally {
      setSubSheetSyncPending(false);
    }
  }

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

  function openPoolView(entry) {
    setPoolModalReadOnly(true);
    setSelectedEntry(entry);
    setRegistrationStatus(entry.registrationStatus || "pending");
    setAdminNotes(entry.adminNotes || "");
  }

  function openPoolEdit(entry) {
    setPoolModalReadOnly(false);
    setSelectedEntry(entry);
    setRegistrationStatus(entry.registrationStatus || "pending");
    setAdminNotes(entry.adminNotes || "");
  }

  function closeDetail() {
    setSelectedEntry(null);
    setPoolModalReadOnly(false);
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

  const pendingRequestCount = (requests || []).filter((r) => r.status === "pending").length;

  return (
    <div className="admin-page-stack player-crm">
      <AdminGlassPanel className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="admin-section-title">Substitutions</h2>
            <p className="text-sm text-muted-foreground">
              Match-day substitution requests and the substitute player pool for this season.
            </p>
          </div>
          {crmTab === "requests" && canWrite ? (
            <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => setManualAssignOpen(true)}>
              Manual assign
            </button>
          ) : null}
        </div>
        <PrimaryViewTabs
          value={crmTab}
          onChange={setCrmTab}
          tabs={SUB_CRM_TABS.map((tab) => ({
            id: tab.id,
            label: tab.id === "requests" && pendingRequestCount ? `${tab.label} (${pendingRequestCount})` : tab.label,
          }))}
          ariaLabel="Substitution CRM sections"
        />
      </AdminGlassPanel>

      {crmTab === "requests" ? (
        <AdminGlassPanel>
          <p className="mb-4 text-sm text-muted-foreground">
            Requests from rostered players who need a sub — use Edit to assign, reject, or cancel.
          </p>
          <div className="player-crm__table-wrap">
            <table className="player-crm__table player-crm__table--list">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Match time</th>
                  <th>Match no.</th>
                  <th>Teams</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {(requests || []).map((request) => (
                  <tr key={request.id}>
                    <td className="font-medium">{request.requester_name || request.requester_bpc_id || "—"}</td>
                    <td className="text-xs whitespace-nowrap">{formatMatchDateTime(request)}</td>
                    <td className="text-xs">{formatMatchNo(request)}</td>
                    <td className="max-w-[10rem] truncate text-xs" title={formatTeamsLabel(request)}>
                      {formatTeamsLabel(request)}
                    </td>
                    <td>
                      <span className="player-crm__notes-preview max-w-[12rem]" title={request.reason || ""}>
                        {truncateText(request.reason || "—", 80)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>
                      <div className="player-crm__actions-cell">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewRequest(request)}>
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditRequest(request)}
                          disabled={!canWrite}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loadingRequests && !requests?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No substitution requests.</p>
            ) : null}
          </div>
        </AdminGlassPanel>
      ) : null}

      {crmTab === "pool" ? (
        <>
          <AdminGlassPanel>
            <p className="mb-4 text-sm text-muted-foreground">
              Substitute signups — approve internally (no player emails). Approved players appear in assignment pickers.
            </p>

            <div className="player-crm__sheet-sync mb-4 rounded-lg border border-border/60 bg-muted/20 p-4">
              <h3 className="text-sm font-medium">Google Sheet export (this season)</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sync the full substitute pool to a worksheet — data from row 2: {SUB_POOL_SHEET_COLUMN_HINT}. Share the
                sheet with your Google service account as Editor (same as registration CRM).
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="player-crm__field-label">Spreadsheet link or ID</span>
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={subSheetId}
                    disabled={!canWrite}
                    onChange={(event) => setSubSheetId(event.target.value)}
                    onBlur={persistSubSheetPrefs}
                  />
                </label>
                <label className="block text-sm">
                  <span className="player-crm__field-label">Worksheet tab name</span>
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    placeholder="Sheet1"
                    value={subSheetTabName}
                    disabled={!canWrite}
                    onChange={(event) => setSubSheetTabName(event.target.value)}
                    onBlur={persistSubSheetPrefs}
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!canWrite || !tournamentId}
                    onClick={persistSubSheetPrefs}
                  >
                    Save link
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!canWrite || !tournamentId || subSheetSyncPending || !subSheetId.trim()}
                    onClick={() => void syncSubPoolToGoogleSheet()}
                  >
                    {subSheetSyncPending ? "Syncing…" : "Sync pool to sheet"}
                  </button>
                </div>
              </div>
            </div>

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
              <table className="player-crm__table player-crm__table--list">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Discord</th>
                    <th>MMR</th>
                    <th>Availability notes</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {substitutes.map((entry) => {
                    const availability = getAvailabilityText(entry);
                    return (
                      <tr key={entry.id}>
                        <td className="font-medium">{playerDisplayName(entry)}</td>
                        <td className="max-w-[8rem] truncate text-xs">{entry.discordHandle || "—"}</td>
                        <td>{entry.mmr ?? "—"}</td>
                        <td>
                          <span className="player-crm__notes-preview max-w-[14rem]" title={availability}>
                            {truncateText(availability || "—")}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={entry.registrationStatus} />
                        </td>
                        <td>
                          <div className="player-crm__actions-cell">
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => openPoolView(entry)}>
                              View
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => openPoolEdit(entry)}
                              disabled={!canWrite}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loadingPool && !substitutes.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No substitute pool entries match your search.
                </p>
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
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(1)}
                disabled={currentPage === 1 || loadingPool}
              >
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
        </>
      ) : null}

      {selectedEntry ? (
        <SubstituteDetailModal
          entry={selectedEntry}
          canWrite={canWrite}
          readOnly={poolModalReadOnly}
          adminNotes={adminNotes}
          registrationStatus={registrationStatus}
          onAdminNotesChange={setAdminNotes}
          onRegistrationStatusChange={setRegistrationStatus}
          onClose={closeDetail}
          onSave={saveDetail}
          saving={saving}
        />
      ) : null}

      {viewRequest ? (
        <RequestViewModal request={viewRequest} onClose={() => setViewRequest(null)} />
      ) : null}

      {editRequest ? (
        <RequestEditModal
          request={editRequest}
          eligible={eligible}
          tournamentId={tournamentId}
          canWrite={canWrite}
          onClose={() => setEditRequest(null)}
          onDone={() => loadPool(currentPage)}
          setMessage={setMessage}
        />
      ) : null}

      <ManualAssignSubModal
        open={manualAssignOpen}
        tournamentId={tournamentId}
        eligible={eligible}
        canWrite={canWrite}
        onClose={() => setManualAssignOpen(false)}
        onDone={() => loadPool(currentPage)}
        setMessage={setMessage}
      />
    </div>
  );
}
