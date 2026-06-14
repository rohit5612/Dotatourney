import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import "../../styles/admin-user-mgmt.css";

export function AdminEditModal({ open, title, description, children, onClose, footer }) {
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

  return createPortal(
    <div className="user-mgmt-modal" role="presentation">
      <button type="button" className="user-mgmt-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="user-mgmt-modal__panel" role="dialog" aria-modal="true" aria-labelledby="admin-edit-modal-title">
        <div className="user-mgmt-modal__head">
          <h3 id="admin-edit-modal-title" className="user-mgmt-modal__title">
            {title}
          </h3>
          {description ? <p className="user-mgmt-modal__lead">{description}</p> : null}
        </div>
        <div className="user-mgmt-modal__body">{children}</div>
        {footer ? <div className="user-mgmt-modal__actions">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
