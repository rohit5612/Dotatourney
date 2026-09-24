import { useEffect, useState } from "react";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { api } from "../../lib/api";
import { clearCache } from "../../lib/requestCache.js";
import { useAdminAccess } from "../context/AdminAccessContext.jsx";
import {
  createEmptyVersionHistoryEntry,
  formatWebsiteVersion,
  normalizeVersionHistory,
  normalizeWebsiteVersion,
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
  const [savingVersion, setSavingVersion] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  function load() {
    setLoading(true);
    api
      .getAdminSiteVersionContent()
      .then((data) => {
        setWebsiteVersion(normalizeWebsiteVersion(data?.websiteVersion));
        setEntries(normalizeVersionHistory(data?.versionHistory || {}).entries);
        setMessage("");
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

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

  function updateEntry(index, patch) {
    setEntries((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeEntry(index) {
    setEntries((list) => list.filter((_, i) => i !== index));
  }

  function addEntry() {
    setEntries((list) => [createEmptyVersionHistoryEntry(), ...list]);
  }

  function moveEntry(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= entries.length) return;
    setEntries((list) => {
      const copy = [...list];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  }

  async function saveVersionHistory() {
    setSavingHistory(true);
    setMessage("");
    try {
      const { versionHistory } = await api.updateAdminVersionHistory({ entries });
      setEntries(normalizeVersionHistory(versionHistory).entries);
      clearCache("public:site-content");
      setMessage("Saved version history.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingHistory(false);
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
            <h2 className="text-lg font-semibold">Version history</h2>
            <p className="text-sm text-muted-foreground">
              Internal changelog for major releases. Entries are sorted by version on save (newest first).
            </p>
          </div>
          {canEdit ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={addEntry}>
              Add entry
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changelog entries yet.</p>
          ) : (
            entries.map((entry, index) => (
              <div
                key={entry.id || `${entry.version}-${index}`}
                className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium">v{entry.version || "0.0.0"}</span>
                  {canEdit ? (
                    <div className="flex gap-1">
                      <button type="button" className="btn btn-outline btn-xs" onClick={() => moveEntry(index, -1)} aria-label="Move up">
                        ↑
                      </button>
                      <button type="button" className="btn btn-outline btn-xs" onClick={() => moveEntry(index, 1)} aria-label="Move down">
                        ↓
                      </button>
                      <button type="button" className="btn btn-outline btn-xs text-destructive" onClick={() => removeEntry(index)}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Version (x.y.z)">
                    <input
                      className={inputClassName()}
                      value={entry.version}
                      disabled={!canEdit}
                      onChange={(e) => updateEntry(index, { version: e.target.value })}
                    />
                  </Field>
                  <Field label="Season label">
                    <input
                      className={inputClassName()}
                      value={entry.seasonLabel || ""}
                      disabled={!canEdit}
                      onChange={(e) => updateEntry(index, { seasonLabel: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <textarea
                    className={`${inputClassName()} min-h-[4rem]`}
                    value={entry.summary}
                    disabled={!canEdit}
                    onChange={(e) => updateEntry(index, { summary: e.target.value })}
                  />
                </Field>
                <Field label="Notes (optional)">
                  <textarea
                    className={`${inputClassName()} min-h-[5rem]`}
                    value={entry.notes || ""}
                    disabled={!canEdit}
                    onChange={(e) => updateEntry(index, { notes: e.target.value })}
                  />
                </Field>
              </div>
            ))
          )}
        </div>

        {canEdit ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={savingHistory} onClick={() => void saveVersionHistory()}>
            {savingHistory ? "Saving…" : "Save changelog"}
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
