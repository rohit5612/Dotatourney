import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onCancel?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="user-mgmt-modal" role="presentation">
      <button type="button" className="user-mgmt-modal__backdrop" aria-label="Close dialog" onClick={onCancel} />
      <div className="user-mgmt-modal__panel user-mgmt-modal__panel--sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title" className="user-mgmt-modal__title">
          {title}
        </h3>
        {description ? <p className="user-mgmt-modal__lead">{description}</p> : null}
        <div className="user-mgmt-modal__actions">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === "danger" ? "btn-destructive" : "btn-primary"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
