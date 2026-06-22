import { CardTierBadge, cardTierDisplayLabel } from "../cards/CardTierBadge.jsx";
import { CardTierPreviewImage } from "../cards/CardTierPreviewImage.jsx";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export function CardUpgradeSuccessModal({ open, targetTier, tournamentName, onClose }) {
  useBodyScrollLock(open);

  if (!open || !targetTier) return null;

  const tierLabel = cardTierDisplayLabel(targetTier);
  const isPremiumCard = targetTier !== "default";

  return (
    <div className="player-modal" role="presentation">
      <button type="button" className="player-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="player-modal__panel player-modal__panel--upgrade-success"
        role="dialog"
        aria-labelledby="upgrade-success-title"
      >
        <div className="player-reg__success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4 12 14.01l-3-3" />
          </svg>
        </div>
        <h2 id="upgrade-success-title" className="player-modal__title player-reg__success-title">
          Card upgraded
        </h2>
        <p className="player-modal__lead">
          Payment confirmed. Your card tier is now <CardTierBadge tier={targetTier} /> for{" "}
          <strong>{tournamentName || "this season"}</strong>.
        </p>
        <p className="player-modal__hint">
          Your profile and the community directory now show your <strong>{tierLabel}</strong> tier.
        </p>
        {isPremiumCard ? (
          <p className="player-modal__hint">
            Our admins will process and upload your custom card within <strong>48 hours</strong>. Until then, your
            default season card appears on your profile.
          </p>
        ) : null}
        <div className="player-reg__success-card player-modal__upgrade-preview">
          <CardTierPreviewImage tier={targetTier} size="sm" />
        </div>
        <div className="player-modal__actions player-modal__actions--center">
          <button
            type="button"
            className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
            onClick={onClose}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
