import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoMdNotificationsOutline } from "react-icons/io";
import { Link, useLocation } from "react-router-dom";
import { useFloatingDropdownPosition } from "../../hooks/useFloatingDropdownPosition.js";
import { getPlayerToken, playerApi } from "../../lib/playerApi";

function formatNoteTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationMenu({ enabled = false }) {
  const menuId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const panelStyle = useFloatingDropdownPosition(triggerRef, open);

  const refreshUnread = useCallback(() => {
    if (!enabled || !getPlayerToken()) {
      setUnreadCount(0);
      return;
    }
    playerApi
      .notificationUnreadCount()
      .then((r) => setUnreadCount(r.count ?? 0))
      .catch(() => setUnreadCount(0));
  }, [enabled]);

  const loadPanel = useCallback(() => {
    if (!enabled || !getPlayerToken()) {
      setItems([]);
      return;
    }
    setLoading(true);
    playerApi
      .notifications({ limit: 8 })
      .then((data) => setItems(data.notifications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread, location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    loadPanel();

    function onPointerDown(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loadPanel]);

  async function markRead(id) {
    await playerApi.markNotificationRead(id);
    refreshUnread();
    loadPanel();
  }

  if (!enabled) return null;

  const badgeLabel = unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : String(unreadCount);

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        id={menuId}
        className="player-notification-menu__panel player-nav-dropdown-shell player-nav-dropdown-shell--portal"
        style={panelStyle || undefined}
        role="menu"
      >
        <div className="player-notification-menu__head">
          <p className="player-notification-menu__title">Notifications</p>
          {unreadCount > 0 ? (
            <span className="player-notification-menu__count">{unreadCount} unread</span>
          ) : null}
        </div>

        {loading ? (
          <p className="player-notification-menu__empty">Loading…</p>
        ) : items.length ? (
          <ul className="player-notification-menu__list">
            {items.map((note) => (
              <li
                key={note.id}
                className={`player-notification-menu__item${note.readAt ? " is-read" : ""}`}
                role="none"
              >
                <div className="player-notification-menu__item-copy" role="menuitem">
                  <p className="player-notification-menu__item-title">{note.title}</p>
                  {note.body ? <p className="player-notification-menu__item-body">{note.body}</p> : null}
                  <p className="player-notification-menu__item-time">{formatNoteTime(note.createdAt)}</p>
                </div>
                {!note.readAt ? (
                  <button type="button" className="player-notification-menu__mark" onClick={() => markRead(note.id)}>
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="player-notification-menu__empty">You&apos;re all caught up.</p>
        )}

        <Link
          to="/dashboard/notifications"
          className="player-notification-menu__footer"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          View all notifications
        </Link>
      </div>,
      document.body,
    );

  return (
    <>
      <div className={`player-notification-menu${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="player-notification-bell"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          <IoMdNotificationsOutline className="player-notification-bell__icon" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="player-notification-bell__badge" aria-hidden="true">
              {badgeLabel}
            </span>
          ) : null}
        </button>
      </div>
      {panel}
    </>
  );
}
