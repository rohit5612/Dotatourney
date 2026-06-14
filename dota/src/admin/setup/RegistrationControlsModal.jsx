import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export function RegistrationControlsModal({
  open,
  onClose,
  tournamentName,
  isPublished,
  registrationsOpen,
  onOpenRegistrations,
  onCloseRegistrations,
}) {
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
    <div className="setup-modal" role="presentation">
      <button type="button" className="setup-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="setup-modal__panel" role="dialog" aria-modal="true" aria-labelledby="setup-reg-title">
        <header className="setup-modal__head">
          <div>
            <h2 id="setup-reg-title" className="setup-modal__title">
              Registration controls
            </h2>
            <p className="setup-modal__lead">
              {tournamentName ? (
                <>
                  Manage public checkout for <strong>{tournamentName}</strong>.
                </>
              ) : (
                "Select a tournament first."
              )}
            </p>
          </div>
          <button type="button" className="setup-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="setup-modal__body">
          <div className="setup-reg-status">
            <span className={`setup-reg-status__dot${registrationsOpen ? " setup-reg-status__dot--open" : ""}`} aria-hidden="true" />
            <div>
              <p className="setup-reg-status__label">{registrationsOpen ? "Registrations open" : "Registrations closed"}</p>
              <p className="setup-reg-status__hint">
                {registrationsOpen
                  ? "Players can complete checkout on the public registration page."
                  : "The registration form is hidden until you open again."}
              </p>
            </div>
          </div>

          {!isPublished ? (
            <p className="setup-callout setup-callout--warn">
              Publish this tournament before opening registrations. Draft and approved-only events stay hidden on the public site.
            </p>
          ) : null}

          <div className="setup-modal__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-outline" onClick={onCloseRegistrations}>
              Close registrations
            </button>
            <button type="button" className="btn btn-primary" disabled={!isPublished} onClick={onOpenRegistrations}>
              Open registrations
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
