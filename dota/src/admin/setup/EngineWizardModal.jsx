import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { EngineWizard } from "./EngineWizard.jsx";

export function EngineWizardModal({ open, onClose, setMessage, onTemplatesChanged }) {
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
      <div className="setup-modal__panel setup-modal__panel--engine" role="dialog" aria-modal="true" aria-labelledby="setup-engine-title">
        <header className="setup-modal__head">
          <div>
            <h2 id="setup-engine-title" className="setup-modal__title">
              Format engine
            </h2>
            <p className="setup-modal__lead">
              Create and maintain reusable bracket templates. Assign them to tournaments from Setup — not here.
            </p>
          </div>
          <button type="button" className="setup-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="setup-modal__body">
          <EngineWizard embedded setMessage={setMessage} onTemplatesChanged={onTemplatesChanged} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
