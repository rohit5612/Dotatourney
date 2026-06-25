import { PortraitFrameEditor } from "./PortraitFrameEditor.jsx";
import { defaultPortraitCropMap } from "../../utils/portraitCropStyle.js";

export function PortraitFrameModal({
  open,
  imageUrl,
  cropsRef,
  baseManifest,
  playerName = "",
  onCancel,
  onApply,
  applying = false,
  disabled = false,
}) {
  if (!open || !imageUrl) return null;

  return (
    <div
      className="portrait-frame-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-frame-modal-title"
    >
      <button
        type="button"
        className="portrait-frame-modal__backdrop"
        aria-label="Cancel portrait positioning"
        onClick={onCancel}
      />
      <div className="portrait-frame-modal__panel">
        <header className="portrait-frame-modal__header">
          <div className="min-w-0">
            <h3 id="portrait-frame-modal-title" className="portrait-frame-modal__title">
              Position portrait
            </h3>
            <p className="portrait-frame-modal__subtitle">
              {playerName
                ? `Adjust how the image appears on ${playerName}'s cards.`
                : "Adjust how the image appears on player, gold, and holo cards."}
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={onCancel}>
            Cancel
          </button>
        </header>

        <div className="portrait-frame-modal__body">
          <PortraitFrameEditor
            variant="modal"
            imageUrl={imageUrl}
            crops={defaultPortraitCropMap()}
            cropsRef={cropsRef}
            baseManifest={baseManifest}
            disabled={disabled || applying}
          />
        </div>

        <footer className="portrait-frame-modal__footer">
          <button type="button" className="btn btn-outline" disabled={applying} onClick={onCancel}>
            Discard
          </button>
          <button type="button" className="btn btn-primary" disabled={disabled || applying} onClick={onApply}>
            {applying ? "Applying…" : "Use this portrait"}
          </button>
        </footer>
      </div>
    </div>
  );
}
