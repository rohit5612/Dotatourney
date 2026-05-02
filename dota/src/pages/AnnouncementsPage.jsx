import { useState } from "react";
import { toDatetimeLocalValue } from "../utils/datetime";

function ensureRows(announcements) {
  if (!Array.isArray(announcements)) return [];
  return announcements.map((item) =>
    item && typeof item === "object" && "body" in item
      ? { body: String(item.body ?? ""), postedAt: String(item.postedAt ?? "") }
      : { body: String(item ?? ""), postedAt: "" },
  );
}

export function AnnouncementsPage({ setup, setSetup, saveTournament }) {
  const [isSaving, setIsSaving] = useState(false);
  const announcements = ensureRows(setup.announcements);

  function updateAnnouncement(index, patch) {
    setSetup((prev) => {
      const next = ensureRows(prev.announcements);
      next[index] = { ...next[index], ...patch };
      return { ...prev, announcements: next };
    });
  }

  function addAnnouncement() {
    setSetup((prev) => ({
      ...prev,
      announcements: [
        ...ensureRows(prev.announcements),
        { body: "", postedAt: toDatetimeLocalValue(new Date()) },
      ],
    }));
  }

  function removeAnnouncement(index) {
    const confirmed = window.confirm("Remove this announcement?");
    if (!confirmed) return;
    setSetup((prev) => ({
      ...prev,
      announcements: ensureRows(prev.announcements).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveAnnouncements() {
    setIsSaving(true);
    try {
      await saveTournament?.();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg tracking-wide">Announcements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add, edit, and remove tournament updates. Set date and time for each post (shown on the public Tournament page).
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={addAnnouncement}>
            Add announcement
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {announcements.length ? (
          announcements.map((item, index) => (
            <article key={index} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-secondary">Post {index + 1}</p>
                  <h3 className="font-serif text-xl">Announcement</h3>
                </div>
                <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => removeAnnouncement(index)}>
                  Remove
                </button>
              </div>
              <label className="block text-sm">
                <span className="text-muted-foreground">Posted (date &amp; time)</span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full max-w-md rounded-md border border-input bg-background p-2 text-sm"
                  value={item.postedAt}
                  onChange={(event) => updateAnnouncement(index, { postedAt: event.target.value })}
                />
              </label>
              <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm leading-6"
                value={item.body}
                onChange={(event) => updateAnnouncement(index, { body: event.target.value })}
                placeholder="Write the announcement update..."
              />
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No announcements yet. Add one to publish a tournament update.
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={addAnnouncement}>
            Add another
          </button>
          <button type="button" className="btn btn-primary" onClick={saveAnnouncements} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save announcements"}
          </button>
        </div>
      </section>
    </div>
  );
}
