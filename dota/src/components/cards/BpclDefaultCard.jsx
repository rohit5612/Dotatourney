import { ResponsiveCardName } from "./ResponsiveCardName.jsx";
import "./DefaultCardStyles.css";

const DEFAULT_LOGO = "/cards/defaultlogo.png";

export function BpclDefaultCard({ manifest, size = "md", className = "" }) {
  if (!manifest) return null;

  const playerName = manifest.displayName || "Player";

  return (
    <article
      className={`bpcl-default-card bpcl-default-card--${size} ${className}`.trim()}
      aria-label={`${playerName} default player card`}
    >
      <div className="bpcl-default-card__shell">
        <div className="bpcl-default-card__corner bpcl-default-card__corner--tl" aria-hidden="true" />
        <div className="bpcl-default-card__corner bpcl-default-card__corner--tr" aria-hidden="true" />
        <div className="bpcl-default-card__corner bpcl-default-card__corner--bl" aria-hidden="true" />
        <div className="bpcl-default-card__corner bpcl-default-card__corner--br" aria-hidden="true" />

        <div className="bpcl-default-card__content">
          <div className="bpcl-default-card__avatar-shell">
            <div className="bpcl-default-card__avatar">
              <img
                src={DEFAULT_LOGO}
                alt="Bharat Pro Circuit League"
                className="bpcl-default-card__logo"
                decoding="async"
              />
            </div>
          </div>

          <div className="bpcl-default-card__name-primary">
            <div className="bpcl-default-card__name-line bpcl-default-card__divider-line" aria-hidden="true" />
            <ResponsiveCardName className="bpcl-default-card__name">{playerName}</ResponsiveCardName>
          </div>

          <div className="bpcl-default-card__footer">
            <div className="bpcl-default-card__bpcl-zone">
              <div className="bpcl-default-card__bpcl-block">
                <p className="bpcl-default-card__bpcl-text engraved">BPCL</p>
                <div className="bpcl-default-card__bpcl-sub-wrap">
                  <div className="bpcl-default-card__divider-line" aria-hidden="true" />
                  <p className="bpcl-default-card__bpcl-sub engraved">Bharat Pro Circuit League</p>
                </div>
              </div>
            </div>
            <p className="bpcl-default-card__sub">Default Player Card</p>
          </div>
        </div>
      </div>
    </article>
  );
}
