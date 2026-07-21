import { useCallback, useEffect, useMemo, useState } from "react";
import { SeasonArchiveEmbedsEditor } from "../admin/seasons/SeasonArchiveEmbedsEditor.jsx";
import {
  buildStageTabLabels,
  formatMatchRoundSummary,
  getSchedulePhase,
  SCHEDULE_PHASE_GROUPS,
  SCHEDULE_PHASE_PLAYOFFS,
  SCHEDULE_PHASE_QUALIFIERS,
  stageRoundStructure,
} from "../components/bracket/bracketLayout.js";
import { SchedulePhaseTabs } from "../components/navigation/TournamentTabs.jsx";
import { api } from "../lib/api";
import { createId } from "../utils/client";
import { normalizeArchiveEmbeds } from "../utils/seasonContentSchema.js";
import { datetimeLocalToIso, toDatetimeLocalValue } from "../utils/datetime.js";
import { isValidScheduleInstant, resolveScheduleStatus } from "../utils/schedule.js";
import { resolveDisplayTeamName } from "../utils/playoffPresentation.js";

const PHASE_TABS = [
  { id: SCHEDULE_PHASE_GROUPS, label: "Groups", shortLabel: "Groups" },
  { id: SCHEDULE_PHASE_QUALIFIERS, label: "Last chance & play-ins", shortLabel: "Last chance" },
  { id: SCHEDULE_PHASE_PLAYOFFS, label: "Playoffs", shortLabel: "Playoffs" },
];

const DEFAULT_SECTION_PAGE_SIZE = 10;
const SECTION_KEYS = ["live", "scheduled", "finished", "unscheduled"];

const SECTION_FILTER_OPTIONS = [
  { value: "all", label: "All sections" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "finished", label: "Finished" },
  { value: "unscheduled", label: "Not yet scheduled" },
];

function compareMatchesBracketOrder(matchA, matchB) {
  if (!matchA || !matchB) return 0;
  const sk = String(matchA.stageKey || "").localeCompare(String(matchB.stageKey || ""));
  if (sk !== 0) return sk;
  const rd = (matchA.roundIndex ?? 0) - (matchB.roundIndex ?? 0);
  if (rd !== 0) return rd;
  return (matchA.matchIndex ?? 0) - (matchB.matchIndex ?? 0);
}

function rowMatchesSearch({ query, match, row, stageLabel, roundStructureAll, allMatches }) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const displayTeam1 = match ? resolveDisplayTeamName(match, 1, allMatches) : "";
  const displayTeam2 = match ? resolveDisplayTeamName(match, 2, allMatches) : "";
  const haystack = [
    match?.team1,
    match?.team2,
    displayTeam1,
    displayTeam2,
    stageLabel,
    match ? formatMatchRoundSummary(match, roundStructureAll) : "",
    row?.stream,
    row?.streamUrl,
    row?.notes,
    row?.status,
    match?.stageKey,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function buildScheduleTeamOptions({ approvedRoster, teamDraft, matches, phaseTab }) {
  const names = new Set();
  const addName = (name) => {
    const trimmed = String(name || "").trim();
    if (trimmed) names.add(trimmed);
  };
  for (const team of approvedRoster?.teams || []) addName(team.name);
  for (const team of teamDraft || []) addName(team.name);
  for (const match of matches || []) {
    if (phaseTab && getSchedulePhase(match.stageKey) !== phaseTab) continue;
    addName(match.team1);
    addName(match.team2);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function matchPassesScheduleFilters({
  match,
  row,
  stageLabel,
  roundStructureAll,
  searchQuery,
  bracketFilter,
  roundFilter,
  teamFilter,
  allMatches,
}) {
  if (!match) return false;

  if (bracketFilter && match.stageKey !== bracketFilter) return false;

  if (roundFilter) {
    const roundKey = `${match.stageKey}:${match.roundIndex ?? 0}`;
    if (roundKey !== roundFilter) return false;
  }

  if (teamFilter) {
    const needle = teamFilter.toLowerCase();
    const t1 = String(resolveDisplayTeamName(match, 1, allMatches) || match.team1 || "").toLowerCase();
    const t2 = String(resolveDisplayTeamName(match, 2, allMatches) || match.team2 || "").toLowerCase();
    if (t1 !== needle && t2 !== needle) return false;
  }

  return rowMatchesSearch({ query: searchQuery, match, row, stageLabel, roundStructureAll, allMatches });
}

function paginateIds(ids, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(ids.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { ids: ids.slice(start, start + pageSize), page: safePage, totalPages };
}

function localToIso(local) {
  const iso = datetimeLocalToIso(local);
  if (!iso || !isValidScheduleInstant(iso)) return null;
  return iso;
}

function slotToRow(slot, match) {
  return {
    id: slot.id,
    matchId: slot.matchId,
    startAt: isValidScheduleInstant(slot.startAt) ? toDatetimeLocalValue(slot.startAt) : "",
    stream: slot.stream || "Main",
    streamUrl: slot.streamUrl ? String(slot.streamUrl) : "",
    status: resolveScheduleStatus(slot, match),
    notes: slot.notes || "",
  };
}

function defaultUnscheduledRow(match) {
  return {
    id: match.id,
    matchId: match.id,
    startAt: "",
    stream: "Main",
    streamUrl: "",
    status: resolveScheduleStatus(null, match),
    notes: "",
  };
}

function rowsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.startAt === b.startAt &&
    a.stream === b.stream &&
    a.streamUrl === b.streamUrl &&
    a.status === b.status &&
    (a.notes || "") === (b.notes || "")
  );
}

function buildSchedulePayload(rows, { requiredMatchIds = null } = {}) {
  const missing = [];
  const payload = [];
  for (const row of rows) {
    const startAt = localToIso(row.startAt);
    const mustHave = requiredMatchIds === null || requiredMatchIds.includes(row.matchId);
    if (!startAt) {
      if (mustHave) missing.push(row);
      continue;
    }
    payload.push({
      id: row.id || createId(),
      matchId: row.matchId,
      startAt,
      stream: (row.stream || "Main").trim() || "Main",
      streamUrl: (row.streamUrl || "").trim() || undefined,
      status: row.status || "upcoming",
      notes: row.notes || "",
    });
  }
  return { payload, missing };
}

function sortRowsByTime(rows, resolveMatch) {
  return [...rows].sort((a, b) => {
    const isoA = localToIso(a.startAt);
    const isoB = localToIso(b.startAt);
    if (isoA && isoB && isoA !== isoB) return isoA.localeCompare(isoB);
    const matchA = resolveMatch(a.matchId);
    const matchB = resolveMatch(b.matchId);
    const sk = String(matchA?.stageKey || "").localeCompare(String(matchB?.stageKey || ""));
    if (sk !== 0) return sk;
    const rd = (matchA?.roundIndex ?? 0) - (matchB?.roundIndex ?? 0);
    if (rd !== 0) return rd;
    return (matchA?.matchIndex ?? 0) - (matchB?.matchIndex ?? 0);
  });
}

function ScheduleMatchRow({
  slot,
  match,
  stageLabel,
  roundStructureAll,
  allMatches,
  locked,
  dirty,
  saving,
  rowMessage,
  isNew,
  onUpdate,
  onEdit,
  onCancel,
  onSave,
}) {
  const readOnly = locked && !isNew;
  const displayTeam1 = match ? resolveDisplayTeamName(match, 1, allMatches) : "";
  const displayTeam2 = match ? resolveDisplayTeamName(match, 2, allMatches) : "";

  return (
    <article
      className={`rounded-lg border bg-background p-4 text-sm shadow-sm ${
        dirty ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bracket</div>
          <div className="mt-0.5 font-medium">{stageLabel}</div>
        </div>
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Round</div>
          <div className="mt-0.5 font-medium">{match ? formatMatchRoundSummary(match, roundStructureAll) : "—"}</div>
        </div>
        <div className="lg:col-span-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Teams</div>
          <p className="mt-0.5 font-medium leading-snug">{match ? `${displayTeam1} vs ${displayTeam2}` : slot.matchId}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Date & time</span>
            <input
              type="datetime-local"
              className={`w-full min-w-0 rounded-md border border-input bg-card p-2 ${readOnly ? "opacity-70" : ""}`}
              value={slot.startAt}
              disabled={readOnly}
              onChange={(event) => onUpdate({ startAt: event.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Stream label</span>
            <input
              className={`w-full min-w-0 rounded-md border border-input bg-card p-2 ${readOnly ? "opacity-70" : ""}`}
              value={slot.stream}
              disabled={readOnly}
              onChange={(event) => onUpdate({ stream: event.target.value })}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2 xl:col-span-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Stream URL</span>
            <input
              className={`w-full min-w-0 rounded-md border border-input bg-card p-2 ${readOnly ? "opacity-70" : ""}`}
              value={slot.streamUrl}
              disabled={readOnly}
              placeholder="https://youtube.com/…"
              onChange={(event) => onUpdate({ streamUrl: event.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
            <select
              className={`w-full min-w-0 rounded-md border border-input bg-card p-2 capitalize ${readOnly ? "opacity-70" : ""}`}
              value={slot.status}
              disabled={readOnly}
              onChange={(event) => onUpdate({ status: event.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Notes</span>
            <input
              className={`w-full min-w-0 rounded-md border border-input bg-card p-2 ${readOnly ? "opacity-70" : ""}`}
              value={slot.notes}
              disabled={readOnly}
              placeholder="Optional notes"
              onChange={(event) => onUpdate({ notes: event.target.value })}
            />
          </label>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {rowMessage ? <p className="mr-auto text-xs text-secondary">{rowMessage}</p> : null}
        {readOnly ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>
            Edit
          </button>
        ) : (
          <>
            {!isNew ? (
              <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={onCancel}>
                Cancel
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || (!isNew && !dirty)} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function ScheduleListSection({
  title,
  subtitle,
  totalCount,
  filteredCount,
  page,
  totalPages,
  pageSize,
  searchQuery,
  onPageChange,
  onPageSizeChange,
  className = "",
  children,
}) {
  if (!totalCount) return null;

  const pageStart = filteredCount ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = filteredCount ? Math.min(page * pageSize, filteredCount) : 0;

  return (
    <section className={`space-y-3 rounded-lg border border-border bg-background/50 p-4 ${className}`.trim()}>
      <div>
        <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {filteredCount === 0 ? (
        <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          No matches match &ldquo;{searchQuery.trim()}&rdquo; in this section.
        </p>
      ) : (
        <>
          <div className="space-y-3">{children}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              Showing {pageStart}&ndash;{pageEnd} of {filteredCount}
              {searchQuery.trim() ? ` (filtered from ${totalCount})` : ""}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-muted-foreground">
                Per page
                <select
                  className="rounded-md border border-input bg-card p-1.5 text-foreground"
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function SchedulePage({
  state,
  saveCustomSchedule,
  teamDraft = [],
  approvedRoster = null,
  liveYoutubeUrl = "",
  onSaveLiveYoutubeUrl,
}) {
  const [liveStreamDraft, setLiveStreamDraft] = useState(() => String(liveYoutubeUrl || "").trim());
  const [savingLiveStream, setSavingLiveStream] = useState(false);
  const [liveStreamMessage, setLiveStreamMessage] = useState("");
  const [linkedSeasonId, setLinkedSeasonId] = useState("");
  const [archiveEmbedsDraft, setArchiveEmbedsDraft] = useState([]);
  const [savingArchiveEmbeds, setSavingArchiveEmbeds] = useState(false);
  const [archiveEmbedsMessage, setArchiveEmbedsMessage] = useState("");
  const [loadingArchiveEmbeds, setLoadingArchiveEmbeds] = useState(false);

  const tournamentId = state?.tournament?.id || "";

  useEffect(() => {
    if (!tournamentId) {
      setLinkedSeasonId("");
      setArchiveEmbedsDraft([]);
      return;
    }
    let active = true;
    setLoadingArchiveEmbeds(true);
    api
      .getAdminSeasons()
      .then((data) => {
        if (!active) return;
        const season = (data.seasons || []).find((entry) => entry.tournamentId === tournamentId);
        if (!season) {
          setLinkedSeasonId("");
          setArchiveEmbedsDraft([]);
          return;
        }
        setLinkedSeasonId(season.id);
        setArchiveEmbedsDraft(normalizeArchiveEmbeds(season.archiveEmbeds || []));
      })
      .catch(() => {
        if (!active) return;
        setLinkedSeasonId("");
        setArchiveEmbedsDraft([]);
      })
      .finally(() => {
        if (active) setLoadingArchiveEmbeds(false);
      });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  useEffect(() => {
    setLiveStreamDraft(String(liveYoutubeUrl || "").trim());
  }, [liveYoutubeUrl]);

  async function handleSaveArchiveEmbeds() {
    if (!linkedSeasonId) return;
    setSavingArchiveEmbeds(true);
    setArchiveEmbedsMessage("");
    try {
      const { season } = await api.updateAdminSeasonContent(linkedSeasonId, {
        archiveEmbeds: archiveEmbedsDraft,
      });
      setArchiveEmbedsDraft(normalizeArchiveEmbeds(season.archiveEmbeds || []));
      setArchiveEmbedsMessage("Saved.");
    } catch (error) {
      setArchiveEmbedsMessage(error?.message || "Could not save archive embeds.");
    } finally {
      setSavingArchiveEmbeds(false);
    }
  }

  async function handleSaveLiveStream() {
    if (!onSaveLiveYoutubeUrl) return;
    setSavingLiveStream(true);
    setLiveStreamMessage("");
    try {
      await onSaveLiveYoutubeUrl(liveStreamDraft.trim());
      setLiveStreamMessage("Saved.");
    } catch (error) {
      setLiveStreamMessage(error?.message || "Could not save live stream link.");
    } finally {
      setSavingLiveStream(false);
    }
  }
  const [draft, setDraft] = useState({});
  const [phaseTab, setPhaseTab] = useState(SCHEDULE_PHASE_GROUPS);
  const [validationHint, setValidationHint] = useState("");
  const [rowMessages, setRowMessages] = useState({});
  const [editingMatchIds, setEditingMatchIds] = useState(() => new Set());
  const [savingMatchId, setSavingMatchId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [bracketFilter, setBracketFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [sectionPageSize, setSectionPageSize] = useState(DEFAULT_SECTION_PAGE_SIZE);
  const [sectionPages, setSectionPages] = useState(() =>
    Object.fromEntries(SECTION_KEYS.map((key) => [key, 1])),
  );


  const savedSlots = useMemo(
    () => (state?.schedule || []).filter((slot) => isValidScheduleInstant(slot.startAt)),
    [state?.schedule],
  );

  const resolveMatch = useCallback((matchId) => state?.matches?.find((m) => m.id === matchId), [state?.matches]);

  const liveCount = savedSlots.filter((slot) => resolveScheduleStatus(slot, resolveMatch(slot.matchId)) === "live").length;
  const upcomingCount = savedSlots.filter((slot) => resolveScheduleStatus(slot, resolveMatch(slot.matchId)) === "upcoming").length;
  const finishedCount = savedSlots.filter((slot) => resolveScheduleStatus(slot, resolveMatch(slot.matchId)) === "finished").length;

  const baseRowsByMatchId = useMemo(() => {
    const map = new Map();
    for (const slot of savedSlots) {
      const match = resolveMatch(slot.matchId);
      if (!match) continue;
      map.set(slot.matchId, slotToRow(slot, match));
    }
    return map;
  }, [savedSlots, resolveMatch]);

  const getRow = useCallback(
    (matchId) => {
      const base = baseRowsByMatchId.get(matchId);
      const patch = draft[matchId];
      if (!base && !patch) return null;
      if (!base) return patch;
      return patch ? { ...base, ...patch } : base;
    },
    [baseRowsByMatchId, draft],
  );

  const stageLabels = useMemo(
    () => buildStageTabLabels(state?.tournament?.format, state?.tabs || []),
    [state?.tournament?.format, state?.tabs],
  );
  const roundStructureAll = useMemo(() => stageRoundStructure(state?.matches || []), [state?.matches]);

  const isRowDirty = useCallback(
    (matchId) => {
      const merged = getRow(matchId);
      const base = baseRowsByMatchId.get(matchId);
      if (!merged) return false;
      if (!base) {
        const match = resolveMatch(matchId);
        if (!match) return false;
        return !rowsEqual(merged, defaultUnscheduledRow(match));
      }
      return !rowsEqual(merged, base);
    },
    [getRow, baseRowsByMatchId, resolveMatch],
  );

  const anyDirty = useMemo(() => {
    const ids = new Set([...baseRowsByMatchId.keys(), ...Object.keys(draft)]);
    for (const id of ids) {
      if (isRowDirty(id)) return true;
    }
    return false;
  }, [baseRowsByMatchId, draft, isRowDirty]);

  const savedRowsInPhase = useMemo(() => {
    const rows = [];
    for (const slot of savedSlots) {
      const match = resolveMatch(slot.matchId);
      if (!match || getSchedulePhase(match.stageKey) !== phaseTab) continue;
      const row = baseRowsByMatchId.get(slot.matchId);
      if (row) rows.push(row);
    }
    return rows;
  }, [savedSlots, phaseTab, resolveMatch, baseRowsByMatchId]);

  const unscheduledMatchIdsInPhase = useMemo(() => {
    const scheduledIds = new Set(savedSlots.map((s) => s.matchId));
    return (state?.matches || [])
      .filter((match) => {
        if (scheduledIds.has(match.id)) return false;
        return getSchedulePhase(match.stageKey) === phaseTab;
      })
      .sort(compareMatchesBracketOrder)
      .map((match) => match.id);
  }, [state?.matches, savedSlots, phaseTab]);

  const phaseGrouped = useMemo(() => {
    const sort = (rows) => sortRowsByTime(rows, resolveMatch);
    return {
      live: sort(savedRowsInPhase.filter((r) => r.status === "live")),
      scheduled: sort(savedRowsInPhase.filter((r) => r.status === "upcoming")),
      finished: sort(savedRowsInPhase.filter((r) => r.status === "finished")),
    };
  }, [savedRowsInPhase, resolveMatch]);

  const phaseMatchCount = phaseGrouped.live.length + phaseGrouped.scheduled.length + phaseGrouped.finished.length;

  useEffect(() => {
    setBracketFilter("");
    setRoundFilter("");
    setTeamFilter("");
  }, [phaseTab]);

  useEffect(() => {
    setSectionPages(Object.fromEntries(SECTION_KEYS.map((key) => [key, 1])));
  }, [phaseTab, searchQuery, sectionFilter, bracketFilter, roundFilter, teamFilter]);

  const bracketOptions = useMemo(() => {
    const keys = new Set();
    for (const match of state?.matches || []) {
      if (getSchedulePhase(match.stageKey) !== phaseTab) continue;
      keys.add(match.stageKey);
    }
    return [...keys]
      .map((stageKey) => ({
        value: stageKey,
        label: stageLabels[stageKey] || stageKey,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [state?.matches, phaseTab, stageLabels]);

  const roundOptions = useMemo(() => {
    const seen = new Map();
    for (const match of state?.matches || []) {
      if (getSchedulePhase(match.stageKey) !== phaseTab) continue;
      const value = `${match.stageKey}:${match.roundIndex ?? 0}`;
      if (seen.has(value)) continue;
      seen.set(value, {
        value,
        label: formatMatchRoundSummary(match, roundStructureAll),
        stageKey: match.stageKey,
        roundIndex: match.roundIndex ?? 0,
      });
    }
    return [...seen.values()].sort((a, b) => {
      const sk = a.stageKey.localeCompare(b.stageKey);
      if (sk !== 0) return sk;
      return a.roundIndex - b.roundIndex;
    });
  }, [state?.matches, phaseTab, roundStructureAll]);

  const teamOptions = useMemo(
    () =>
      buildScheduleTeamOptions({
        approvedRoster,
        teamDraft,
        matches: state?.matches,
        phaseTab,
      }),
    [approvedRoster, teamDraft, state?.matches, phaseTab],
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() || sectionFilter !== "all" || bracketFilter || roundFilter || teamFilter,
  );

  const showLiveSection = sectionFilter === "all" || sectionFilter === "live";
  const showScheduledSection = sectionFilter === "all" || sectionFilter === "scheduled";
  const showFinishedSection = sectionFilter === "all" || sectionFilter === "finished";
  const showUnscheduledSection = sectionFilter === "all" || sectionFilter === "unscheduled";

  function clearScheduleFilters() {
    setSearchQuery("");
    setSectionFilter("all");
    setBracketFilter("");
    setRoundFilter("");
    setTeamFilter("");
  }

  const filterMatchId = useCallback(
    (matchId) => {
      const match = resolveMatch(matchId);
      if (!match) return false;
      const row = getRow(matchId) || baseRowsByMatchId.get(matchId) || defaultUnscheduledRow(match);
      const stageLabel = stageLabels[match.stageKey] || match.stageKey || "Bracket";
      return matchPassesScheduleFilters({
        match,
        row,
        stageLabel,
        roundStructureAll,
        searchQuery,
        bracketFilter,
        roundFilter,
        teamFilter,
        allMatches: state?.matches || [],
      });
    },
    [
      searchQuery,
      bracketFilter,
      roundFilter,
      teamFilter,
      resolveMatch,
      getRow,
      baseRowsByMatchId,
      stageLabels,
      roundStructureAll,
      state?.matches,
    ],
  );

  const buildSectionSlice = useCallback(
    (matchIds) => {
      const totalCount = matchIds.length;
      const filteredIds = matchIds.filter(filterMatchId);
      const filteredCount = filteredIds.length;
      const totalPages = Math.max(1, Math.ceil(filteredCount / sectionPageSize) || 1);
      return { totalCount, filteredIds, filteredCount, totalPages };
    },
    [filterMatchId, sectionPageSize],
  );

  const liveSection = useMemo(
    () => buildSectionSlice(phaseGrouped.live.map((row) => row.matchId)),
    [phaseGrouped.live, buildSectionSlice],
  );
  const scheduledSection = useMemo(
    () => buildSectionSlice(phaseGrouped.scheduled.map((row) => row.matchId)),
    [phaseGrouped.scheduled, buildSectionSlice],
  );
  const finishedSection = useMemo(
    () => buildSectionSlice(phaseGrouped.finished.map((row) => row.matchId)),
    [phaseGrouped.finished, buildSectionSlice],
  );
  const unscheduledSection = useMemo(
    () => buildSectionSlice(unscheduledMatchIdsInPhase),
    [unscheduledMatchIdsInPhase, buildSectionSlice],
  );

  const paginatedLiveIds = useMemo(() => {
    const page = Math.min(sectionPages.live, liveSection.totalPages);
    return paginateIds(liveSection.filteredIds, page, sectionPageSize).ids;
  }, [liveSection, sectionPages.live, sectionPageSize]);

  const paginatedScheduledIds = useMemo(() => {
    const page = Math.min(sectionPages.scheduled, scheduledSection.totalPages);
    return paginateIds(scheduledSection.filteredIds, page, sectionPageSize).ids;
  }, [scheduledSection, sectionPages.scheduled, sectionPageSize]);

  const paginatedFinishedIds = useMemo(() => {
    const page = Math.min(sectionPages.finished, finishedSection.totalPages);
    return paginateIds(finishedSection.filteredIds, page, sectionPageSize).ids;
  }, [finishedSection, sectionPages.finished, sectionPageSize]);

  const paginatedUnscheduledIds = useMemo(() => {
    const page = Math.min(sectionPages.unscheduled, unscheduledSection.totalPages);
    return paginateIds(unscheduledSection.filteredIds, page, sectionPageSize).ids;
  }, [unscheduledSection, sectionPages.unscheduled, sectionPageSize]);

  function setSectionPage(key, nextPage) {
    setSectionPages((prev) => ({ ...prev, [key]: Math.max(1, nextPage) }));
  }

  function handleSectionPageSizeChange(size) {
    setSectionPageSize(size);
    setSectionPages(Object.fromEntries(SECTION_KEYS.map((key) => [key, 1])));
  }

  function updateSlot(matchId, patch) {
    setRowMessages((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setDraft((prev) => {
      const base = baseRowsByMatchId.get(matchId);
      let current = base ? { ...base, ...prev[matchId] } : prev[matchId];
      if (!current) {
        const match = resolveMatch(matchId);
        if (!match) return prev;
        current = defaultUnscheduledRow(match);
      }
      return { ...prev, [matchId]: { ...current, ...patch } };
    });
  }

  function startEditing(matchId) {
    setEditingMatchIds((prev) => new Set(prev).add(matchId));
    setRowMessages((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }

  function cancelEditing(matchId) {
    setEditingMatchIds((prev) => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
    setDraft((prev) => {
      if (!prev[matchId]) return prev;
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setRowMessages((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }

  function allRowsForPersist() {
    const byId = new Map();
    for (const [matchId, row] of baseRowsByMatchId) {
      byId.set(matchId, getRow(matchId) || row);
    }
    for (const matchId of Object.keys(draft)) {
      const row = getRow(matchId);
      if (row) byId.set(matchId, row);
    }
    return [...byId.values()];
  }

  async function handleSaveRow(matchId) {
    setValidationHint("");
    setRowMessages((prev) => ({ ...prev, [matchId]: "" }));
    const row = getRow(matchId);
    if (!row) return;

    const rows = allRowsForPersist();
    const existing = rows.filter((r) => r.matchId !== matchId);
    const nextRows = [...existing, row];

    const { payload, missing } = buildSchedulePayload(nextRows, { requiredMatchIds: [matchId] });
    if (missing.length) {
      setRowMessages((prev) => ({
        ...prev,
        [matchId]: "Set a date and time before saving this match.",
      }));
      return;
    }

    setSavingMatchId(matchId);
    try {
      await saveCustomSchedule(payload);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setEditingMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      setRowMessages((prev) => ({ ...prev, [matchId]: "Saved." }));
    } catch (e) {
      setRowMessages((prev) => ({
        ...prev,
        [matchId]: e?.message || "Failed to save.",
      }));
    } finally {
      setSavingMatchId(null);
    }
  }

  async function handleSaveAll() {
    setValidationHint("");
    const rows = allRowsForPersist();
    const { payload, missing } = buildSchedulePayload(rows, { requiredMatchIds: null });

    if (missing.length) {
      setValidationHint(
        `Every scheduled match needs a date and time (${missing.length} missing). Use Edit on each row or finish unscheduled matches below.`,
      );
      return;
    }

    setSavingAll(true);
    try {
      await saveCustomSchedule(payload);
      setDraft({});
      setEditingMatchIds(new Set());
      setRowMessages({});
    } catch (e) {
      setValidationHint(e?.message || "Failed to save schedule.");
    } finally {
      setSavingAll(false);
    }
  }

  function renderRow(matchId, { isNew = false } = {}) {
    const match = resolveMatch(matchId);
    const slot =
      getRow(matchId) || (match ? defaultUnscheduledRow(match) : { matchId, startAt: "", stream: "Main", streamUrl: "", status: "upcoming", notes: "" });
    const stageLabel = stageLabels[match?.stageKey] || match?.stageKey || "Bracket";
    const isSaved = baseRowsByMatchId.has(matchId);
    const locked = isSaved && !editingMatchIds.has(matchId);

    return (
      <ScheduleMatchRow
        key={matchId}
        slot={slot}
        match={match}
        stageLabel={stageLabel}
        roundStructureAll={roundStructureAll}
        allMatches={state?.matches || []}
        locked={locked}
        dirty={isRowDirty(matchId)}
        saving={savingMatchId === matchId}
        rowMessage={rowMessages[matchId]}
        isNew={isNew}
        onUpdate={(patch) => updateSlot(matchId, patch)}
        onEdit={() => startEditing(matchId)}
        onCancel={() => cancelEditing(matchId)}
        onSave={() => handleSaveRow(matchId)}
      />
    );
  }

  return (
    <div className="w-full space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <section className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div>
          <h3 className="font-serif text-lg">Off-air YouTube embeds</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown on the home page and tournament hub below the countdown when the event is not in its live window.
            Configure highlights, trailers, or past broadcasts here.
          </p>
        </div>
        {loadingArchiveEmbeds ? (
          <p className="text-sm text-muted-foreground">Loading season archive settings…</p>
        ) : linkedSeasonId ? (
          <>
            <SeasonArchiveEmbedsEditor value={archiveEmbedsDraft} onChange={setArchiveEmbedsDraft} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm shrink-0"
                disabled={savingArchiveEmbeds}
                onClick={() => void handleSaveArchiveEmbeds()}
              >
                {savingArchiveEmbeds ? "Saving…" : "Save archive embeds"}
              </button>
              {archiveEmbedsMessage ? <span className="text-sm text-secondary">{archiveEmbedsMessage}</span> : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No season is linked to this tournament yet. Create or link a season in Setup / Seasons to configure archive
            embeds.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div>
          <h3 className="font-serif text-lg">Live YouTube stream</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tournament-wide broadcast embed for the public site during the live event window. Does not change per-match
            stream links below.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Live YouTube stream URL</span>
          <input
            type="url"
            className="w-full rounded-md border border-input bg-background p-2"
            placeholder="https://youtube.com/watch?v=… or https://youtu.be/…"
            value={liveStreamDraft}
            onChange={(event) => setLiveStreamDraft(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            disabled={savingLiveStream || !onSaveLiveYoutubeUrl}
            onClick={() => void handleSaveLiveStream()}
          >
            {savingLiveStream ? "Saving…" : "Save stream link"}
          </button>
          {liveStreamMessage ? <span className="text-sm text-secondary">{liveStreamMessage}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Home page: embed appears below the status card when live. Tournament page: live embed replaces the hero status
          card during the live window. Archive embeds above are used when off-air. Clear the URL to fall back to the timer
          / live status panel.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Only saved matches appear in Live, Scheduled, and Finished. Set a date and time, then save — list order updates after
            save. Use the filters (section, bracket, round, team) and pagination below each list.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          disabled={savingAll || savingMatchId !== null || !anyDirty}
          onClick={() => void handleSaveAll()}
        >
          {savingAll ? "Saving all…" : "Save all changes"}
        </button>
      </div>

      {validationHint ? <p className="rounded-md border border-border bg-background p-2 text-sm text-secondary">{validationHint}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Live</div>
          <div className="mt-1 text-lg font-serif">{liveCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming</div>
          <div className="mt-1 text-lg font-serif">{upcomingCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Finished</div>
          <div className="mt-1 text-lg font-serif">{finishedCount}</div>
        </div>
      </div>

      <SchedulePhaseTabs value={phaseTab} onChange={setPhaseTab} tabs={PHASE_TABS} />


      <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filter this phase</span>
          {hasActiveFilters ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={clearScheduleFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="block space-y-1 sm:col-span-2 lg:col-span-3 xl:col-span-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Search</span>
            <input
              type="search"
              className="w-full rounded-md border border-input bg-background p-2"
              placeholder="Stream, notes, teams…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Section</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2"
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
            >
              {SECTION_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Bracket</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2"
              value={bracketFilter}
              onChange={(event) => setBracketFilter(event.target.value)}
            >
              <option value="">All brackets</option>
              {bracketOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Round</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2"
              value={roundFilter}
              onChange={(event) => setRoundFilter(event.target.value)}
            >
              <option value="">All rounds</option>
              {roundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Team</span>
            <select
              className="w-full rounded-md border border-input bg-background p-2"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
            >
              <option value="">All teams</option>
              {teamOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {approvedRoster?.teams?.length ? (
          <p className="text-xs text-muted-foreground">Team list includes approved roster teams.</p>
        ) : teamDraft.length ? (
          <p className="text-xs text-muted-foreground">Team list includes saved draft teams and bracket placeholders.</p>
        ) : null}
      </div>

      <div className="space-y-8">
        {showLiveSection ? (
        <ScheduleListSection
          title="Live"
          subtitle="Matches marked live. Start-time order updates after you save."
          totalCount={liveSection.totalCount}
          filteredCount={liveSection.filteredCount}
          page={Math.min(sectionPages.live, liveSection.totalPages)}
          totalPages={liveSection.totalPages}
          pageSize={sectionPageSize}
          searchQuery={searchQuery}
          onPageChange={(nextPage) => setSectionPage("live", nextPage)}
          onPageSizeChange={handleSectionPageSizeChange}
        >
          {paginatedLiveIds.map((matchId) => renderRow(matchId))}
        </ScheduleListSection>
        ) : null}

        {showScheduledSection ? (
        <ScheduleListSection
          title="Scheduled"
          subtitle="Upcoming saved matches. Date order updates after you save."
          totalCount={scheduledSection.totalCount}
          filteredCount={scheduledSection.filteredCount}
          page={Math.min(sectionPages.scheduled, scheduledSection.totalPages)}
          totalPages={scheduledSection.totalPages}
          pageSize={sectionPageSize}
          searchQuery={searchQuery}
          onPageChange={(nextPage) => setSectionPage("scheduled", nextPage)}
          onPageSizeChange={handleSectionPageSizeChange}
        >
          {paginatedScheduledIds.map((matchId) => renderRow(matchId))}
        </ScheduleListSection>
        ) : null}

        {showFinishedSection ? (
        <ScheduleListSection
          title="Finished"
          subtitle="Completed saved matches. Date order updates after you save."
          totalCount={finishedSection.totalCount}
          filteredCount={finishedSection.filteredCount}
          page={Math.min(sectionPages.finished, finishedSection.totalPages)}
          totalPages={finishedSection.totalPages}
          pageSize={sectionPageSize}
          searchQuery={searchQuery}
          onPageChange={(nextPage) => setSectionPage("finished", nextPage)}
          onPageSizeChange={handleSectionPageSizeChange}
        >
          {paginatedFinishedIds.map((matchId) => renderRow(matchId))}
        </ScheduleListSection>
        ) : null}

        {!phaseMatchCount && !unscheduledSection.totalCount ? (
          <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
            No saved matches in this phase yet. Add one from the list below.
          </p>
        ) : null}

        {showUnscheduledSection ? (
        <ScheduleListSection
          title="Not yet scheduled"
          subtitle="Bracket matches not on the public schedule until you set a date and save."
          className="border-dashed"
          totalCount={unscheduledSection.totalCount}
          filteredCount={unscheduledSection.filteredCount}
          page={Math.min(sectionPages.unscheduled, unscheduledSection.totalPages)}
          totalPages={unscheduledSection.totalPages}
          pageSize={sectionPageSize}
          searchQuery={searchQuery}
          onPageChange={(nextPage) => setSectionPage("unscheduled", nextPage)}
          onPageSizeChange={handleSectionPageSizeChange}
        >
          {paginatedUnscheduledIds.map((matchId) => renderRow(matchId, { isNew: true }))}
        </ScheduleListSection>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {anyDirty ? "You have unsaved changes." : "All visible rows match the last saved schedule."}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={savingAll || savingMatchId !== null || !anyDirty}
          onClick={() => void handleSaveAll()}
        >
          {savingAll ? "Saving all…" : "Save all changes"}
        </button>
      </div>
    </div>
  );
}
