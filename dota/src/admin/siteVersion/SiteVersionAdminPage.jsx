import { useEffect, useMemo, useState } from "react";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { api } from "../../lib/api";
import { clearCache } from "../../lib/requestCache.js";
import { useAdminAccess } from "../context/AdminAccessContext.jsx";
import { MajorReleaseEntryModal } from "./MajorReleaseEntryModal.jsx";
import {
  createEmptyVersionChangeLogLine,
  createEmptyVersionHistoryEntry,
  formatReleaseDate,
  formatWebsiteVersion,
  normalizeVersionChangeLog,
  normalizeVersionHistory,
  normalizeWebsiteVersion,
  truncateText,
} from "../../utils/websiteVersionSchema.js";

function inputClassName() {
  return "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
}

function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  );
}

export function SiteVersionAdminPage() {
  const access = useAdminAccess();
  const canEdit = access.canWritePage("siteVersion");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [websiteVersion, setWebsiteVersion] = useState({ major: 3, minor: 0, patch: 0 });
  const [entries, setEntries] = useState([]);
  const [changelogLines, setChangelogLines] = useState([]);
  const [savingVersion, setSavingVersion] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [savingChangelog, setSavingChangelog] = useState(false);
  const [releaseModal, setReleaseModal] = useState({ open: false, mode: "create", index: -1 });

  function load() {
    setLoading(true);
    api
      .getAdminSiteVersionContent()
      .then((data) => {
        setWebsiteVersion(normalizeWebsiteVersion(data?.websiteVersion));
        setEntries(normalizeVersionHistory(data?.versionHistory || {}).entries);
        setChangelogLines(normalizeVersionChangeLog(data?.versionChangeLog || {}).lines);
        setMessage("");
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const releaseModalEntry = useMemo(() => {
    if (releaseModal.mode === "edit" && releaseModal.index >= 0) {
      return entries[releaseModal.index] || null;
    }
    return createEmptyVersionHistoryEntry();
  }, [releaseModal, entries]);

  function bumpField(field, delta) {
    setWebsiteVersion((prev) => ({
      ...prev,
      [field]: Math.max(0, (Number(prev[field]) || 0) + delta),
    }));
  }

  function setVersionField(field, raw) {
    const parsed = Number.parseInt(raw, 10);
    setWebsiteVersion((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  }

  async function saveWebsiteVersion() {
    setSavingVersion(true);
    setMessage("");
    try {
      const { websiteVersion: saved } = await api.updateAdminWebsiteVersion(websiteVersion);
      setWebsiteVersion(normalizeWebsiteVersion(saved));
      clearCache("public:site-content");
      setMessage(`Saved live site version v${formatWebsiteVersion(saved)}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingVersion(false);
    }
  }

  async function persistMajorReleases(nextEntries) {
    setSavingHistory(true);
    setMessage("");
    try {
      const { versionHistory } = await api.updateAdminVersionHistory({ entries: nextEntries });
      const normalized = normalizeVersionHistory(versionHistory).entries;
      setEntries(normalized);
      clearCache("public:site-content");
      setMessage("Saved major releases.");
      setReleaseModal({ open: false, mode: "create", index: -1 });
      return normalized;
    } catch (err) {
      setMessage(err.message);
      throw err;
    } finally {
      setSavingHistory(false);
    }
  }

  async function handleReleaseModalSave(draft) {
    const row = {
      ...draft,
      id: draft.id || `vh-${Date.now()}`,
      releasedAt: draft.releasedAt?.trim() || undefined,
      seasonLabel: draft.seasonLabel?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    };
    let next;
    if (releaseModal.mode === "create") {
      next = [row, ...entries];
    } else {
      next = entries.map((entry, i) => (i === releaseModal.index ? row : entry));
    }
    await persistMajorReleases(next);
  }

  async function handleReleaseModalDelete() {
    if (releaseModal.mode !== "edit" || releaseModal.index < 0) return;
    const next = entries.filter((_, i) => i !== releaseModal.index);
    await persistMajorReleases(next);
  }

  function openCreateRelease() {
    setReleaseModal({ open: true, mode: "create", index: -1 });
  }

  function openEditRelease(index) {
    setReleaseModal({ open: true, mode: "edit", index });
  }

  function updateChangelogLine(index, patch) {
    setChangelogLines((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeChangelogLine(index) {
    setChangelogLines((list) => list.filter((_, i) => i !== index));
  }

  function addChangelogLine() {
    setChangelogLines((list) => [createEmptyVersionChangeLogLine(), ...list]);
  }

  async function saveVersionChangeLog() {
    setSavingChangelog(true);
    setMessage("");
    try {
      const { versionChangeLog } = await api.updateAdminVersionChangeLog({ lines: changelogLines });
      setChangelogLines(normalizeVersionChangeLog(versionChangeLog).lines);
      clearCache("public:site-content");
      setMessage("Saved text changelog.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingChangelog(false);
    }
  }

  if (loading) {
    return <PageLoadingSpinner label="Loading site version…" />;
  }

  const preview = formatWebsiteVersion(websiteVersion);

  return (
    <div className="space-y-4">
      <AdminGlassPanel className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Live site version</h2>
          <p className="text-sm text-muted-foreground">
            Shown in the footer on every page as <span className="font-mono">v{preview}</span>. Use{" "}
            <strong>x</strong> for major season-era releases, <strong>y</strong> for notable features,{" "}
            <strong>z</strong> for bug fixes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="x — Major" hint="Season-era / platform generation (currently 3)">
            <input
              type="number"
              min={0}
              className={inputClassName()}
              value={websiteVersion.major}
              disabled={!canEdit || savingVersion}
              onChange={(e) => setVersionField("major", e.target.value)}
            />
          </Field>
          <Field label="y — Features" hint="Important product changes">
            <input
              type="number"
              min={0}
              className={inputClassName()}
              value={websiteVersion.minor}
              disabled={!canEdit || savingVersion}
              onChange={(e) => setVersionField("minor", e.target.value)}
            />
          </Field>
          <Field label="z — Fixes" hint="Bug fix increments">
            <input
              type="number"
              min={0}
              className={inputClassName()}
              value={websiteVersion.patch}
              disabled={!canEdit || savingVersion}
              onChange={(e) => setVersionField("patch", e.target.value)}
            />
          </Field>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={savingVersion} onClick={() => bumpField("patch", 1)}>
              +1 patch
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={savingVersion} onClick={() => void saveWebsiteVersion()}>
              {savingVersion ? "Saving…" : "Save version"}
            </button>
          </div>
        ) : null}
      </AdminGlassPanel>

      <AdminGlassPanel className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Major releases</h2>
            <p className="text-sm text-muted-foreground">
              x.0.0 entries for the public What&apos;s New page. Edit a row or add a new release.
            </p>
          </div>
          {canEdit ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={openCreateRelease}>
              Add release
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border/70 bg-background/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                {canEdit ? <th className="px-3 py-2 font-medium text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">
                    No major releases yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => (
                  <tr key={entry.id || entry.version} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold whitespace-nowrap">v{entry.version}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{entry.seasonLabel || "—"}</td>
                    <td className="px-3 py-2.5 max-w-[14rem] text-muted-foreground">{truncateText(entry.summary, 80)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatReleaseDate(entry.releasedAt)}</td>
                    <td className="px-3 py-2.5 max-w-[10rem] text-muted-foreground">{truncateText(entry.notes, 48) || "—"}</td>
                    {canEdit ? (
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" className="btn btn-outline btn-xs" onClick={() => openEditRelease(index)}>
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminGlassPanel>

      <MajorReleaseEntryModal
        open={releaseModal.open && canEdit}
        mode={releaseModal.mode}
        initialEntry={releaseModalEntry}
        saving={savingHistory}
        onClose={() => setReleaseModal({ open: false, mode: "create", index: -1 })}
        onSave={(draft) => void handleReleaseModalSave(draft)}
        onDelete={releaseModal.mode === "edit" ? () => void handleReleaseModalDelete() : undefined}
      />

      <AdminGlassPanel className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Text changelog (y / z and all versions)</h2>
            <p className="text-sm text-muted-foreground">
              One line per version for the public text sheet (last 50 shown). Add rows for{" "}
              <strong>3.0.1</strong>, <strong>3.1.0</strong>, etc. Major x.0.0 summaries are included automatically if
              not listed here.
            </p>
          </div>
          {canEdit ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={addChangelogLine}>
              Add line
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          {changelogLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changelog lines yet.</p>
          ) : (
            changelogLines.map((line, index) => (
              <div
                key={line.id || `${line.version}-${index}`}
                className="grid gap-2 rounded-lg border border-border/70 bg-background/40 p-3 sm:grid-cols-[7rem_1fr_auto]"
              >
                <input
                  className={inputClassName()}
                  value={line.version}
                  disabled={!canEdit}
                  aria-label="Version"
                  onChange={(e) => updateChangelogLine(index, { version: e.target.value })}
                />
                <input
                  className={inputClassName()}
                  value={line.text}
                  disabled={!canEdit}
                  aria-label="Changelog text"
                  placeholder="Short description of this release"
                  onChange={(e) => updateChangelogLine(index, { text: e.target.value })}
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs text-destructive shrink-0"
                    onClick={() => removeChangelogLine(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={savingChangelog}
            onClick={() => void saveVersionChangeLog()}
          >
            {savingChangelog ? "Saving…" : "Save text changelog"}
          </button>
        ) : null}
      </AdminGlassPanel>

      {message ? (
        <AdminGlassPanel subtle className="text-sm text-secondary">
          {message}
        </AdminGlassPanel>
      ) : null}
    </div>
  );
}
