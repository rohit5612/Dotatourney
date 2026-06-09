import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatAnnouncementPostedAt } from "../../lib/announcementEntries.js";

export function AnnouncementsPublicPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPublicAnnouncements()
      .then((payload) => setItems(payload?.announcements || []))
      .catch(async (err) => {
        try {
          const tournament = await api.getPublicTournamentFresh();
          const list = tournament?.tournament?.announcements || [];
          setItems(
            list.map((entry, index) => ({
              id: String(index),
              title: entry.title || "Announcement",
              body: entry.body || "",
              postedAt: entry.postedAt || entry.posted_at,
              category: entry.category || "general",
            })),
          );
        } catch {
          setError(err.message);
        }
      });
  }, []);

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-3xl">News &amp; announcements</h1>
      <p className="mt-2 text-muted-foreground">Updates from BPC League and the active season.</p>
      {error ? <p className="mt-6 text-destructive">{error}</p> : null}
      <ul className="mt-8 space-y-4">
        {items.length === 0 && !error ? (
          <li className="rounded-lg border border-border bg-card p-6 text-muted-foreground">No announcements yet.</li>
        ) : null}
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-foreground">{item.title}</h2>
              {item.postedAt ? (
                <time className="text-xs text-muted-foreground">{formatAnnouncementPostedAt(item.postedAt)}</time>
              ) : null}
            </div>
            {item.category ? (
              <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {item.category}
              </span>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
