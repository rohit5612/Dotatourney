import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export function ProfileSavedModal({ open, onClose }) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="player-modal" role="presentation">
      <button type="button" className="player-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="player-modal__panel player-modal__panel--saved"
        role="dialog"
        aria-labelledby="profile-saved-title"
        aria-describedby="profile-saved-body"
      >
        <div className="player-modal__saved-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 id="profile-saved-title" className="player-modal__title">
          Profile saved
        </h2>
        <p id="profile-saved-body" className="player-modal__lead">
          Your profile changes have been saved.
        </p>
        <div className="player-modal__actions player-modal__actions--center">
          <button
            type="button"
            className="player-dash__action player-dash__action--tournaments player-dash__action--compact"
            onClick={onClose}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
