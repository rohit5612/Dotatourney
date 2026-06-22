import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BpclCardRenderer } from "./BpclCardRenderer.jsx";
import { premiumCardGlowClass } from "../../utils/cardTierEffects.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import "./GoldCardStyles.css";
import "./PlayerCardStyles.css";

/** Lightweight card — no holo SVG aura, foil loop, or interactive canvas RAF. */
function ProfileCardPreview({ manifest, size = "md", className = "" }) {
  return (
    <BpclCardRenderer
      manifest={manifest}
      size={size}
      className={className}
      interactive={false}
      showMeta={false}
      showAura={false}
    />
  );
}

export function PlayerProfileCard({
  manifest,
  className = "",
  cardTier = "default",
  variant = "profile",
}) {
  const [expanded, setExpanded] = useState(false);
  const isPedestal = variant === "pedestal";
  const cardGlowClass = isPedestal ? "" : premiumCardGlowClass(cardTier);

  useBodyScrollLock(expanded);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (!manifest) return null;

  const thumbnail = isPedestal ? (
    <ProfileCardPreview manifest={manifest} className="bpcl-card--pedestal" />
  ) : (
    <ProfileCardPreview manifest={manifest} size="md" />
  );

  const lightbox =
    expanded &&
    createPortal(
      <div
        className="player-profile__card-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Player card enlarged"
        onClick={() => setExpanded(false)}
      >
        <button
          type="button"
          className="player-profile__card-lightbox-close"
          onClick={() => setExpanded(false)}
          aria-label="Close enlarged card"
        >
          Close
        </button>
        <div className="player-profile__card-lightbox-inner" onClick={(event) => event.stopPropagation()}>
          <ProfileCardPreview manifest={manifest} size="xl" />
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        className={`player-profile__card-tap${isPedestal ? " player-profile__card-tap--pedestal player-profile__card-display--pedestal" : ""}${className ? ` ${className}` : ""}`}
        onClick={() => setExpanded(true)}
        aria-label="Enlarge player card"
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        {cardGlowClass ? <div className={cardGlowClass}>{thumbnail}</div> : thumbnail}
        <span className="player-profile__card-tap-hint">Tap to enlarge</span>
      </button>
      {lightbox}
    </>
  );
}
