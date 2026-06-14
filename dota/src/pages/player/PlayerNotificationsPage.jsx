import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import { playerApi } from "../../lib/playerApi";
import "../../styles/player-notifications.css";

export function PlayerNotificationsPage() {
  const [data, setData] = useState({ notifications: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    playerApi
      .notifications({ limit: 50 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id) {
    await playerApi.markNotificationRead(id);
    load();
  }

  async function markAllRead() {
    await playerApi.markAllNotificationsRead();
    load();
  }

  return (
    <div className="player-dash__notifications-page">
      <header className="player-dash__hero player-dash__hero--compact">
        <div className="player-dash__hero-main">
          <div className="player-dash__page-hero-icon" aria-hidden="true">
            <DashboardNavIcon name="notifications" />
          </div>
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Inbox</p>
            <h1 className="player-dash__hero-title">Notifications</h1>
            <p className="player-dash__hero-desc">Substitutions, lineup updates, and important announcements.</p>
          </div>
        </div>
        {data.notifications.some((n) => !n.readAt) ? (
          <button type="button" className="player-dash__action player-dash__action--edit" onClick={markAllRead}>
            Mark all read
          </button>
        ) : null}
      </header>

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {loading ? (
        <div className="player-dash__loading">
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Loading notifications…</p>
        </div>
      ) : data.notifications.length ? (
        <ul className="player-notifications-list">
          {data.notifications.map((note) => (
            <li
              key={note.id}
              className={`player-notifications-list__item${note.readAt ? " is-read" : ""}`}
            >
              <div className="player-notifications-list__copy">
                <p className="player-notifications-list__title">{note.title}</p>
                <p className="player-notifications-list__body">{note.body}</p>
                <p className="player-notifications-list__time">
                  {note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <div className="player-notifications-list__actions">
                {!note.readAt ? (
                  <button type="button" className="player-notifications-list__read" onClick={() => markRead(note.id)}>
                    Mark read
                  </button>
                ) : null}
                {note.payload?.matchId ? (
                  <Link to="/dashboard" className="player-dash__empty-link">
                    View dashboard
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="player-dash__card player-dash__section-card">
          <p className="player-dash__card-sub">You&apos;re all caught up — no notifications yet.</p>
        </section>
      )}
    </div>
  );
}
