import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import "../../styles/admin-user-mgmt.css";

export function TeamsPanelModal({ open, onClose, title, description, children, size = "md" }) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panelClass =
    size === "xl"
      ? "user-mgmt-modal__panel user-mgmt-modal__panel--xl"
      : size === "lg"
        ? "user-mgmt-modal__panel user-mgmt-modal__panel--lg"
        : "user-mgmt-modal__panel";

  return createPortal(
    <div className="user-mgmt-modal" role="presentation">
      <button type="button" className="user-mgmt-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className={panelClass} role="dialog" aria-modal="true" aria-labelledby="teams-panel-modal-title">
        <header className="user-mgmt-modal__head">
          <div>
            <h3 id="teams-panel-modal-title" className="user-mgmt-modal__title">
              {title}
            </h3>
            {description ? <p className="user-mgmt-modal__lead">{description}</p> : null}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="user-mgmt-modal__content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
