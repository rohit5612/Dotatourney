import "../../styles/card-tier-badge.css";
import { cardTierDisplayLabel } from "../../constants/cardTierPreviews.js";

export { cardTierDisplayLabel };

function tierBadgeClass(tier) {
  if (tier === "gold") return "player-profile__tier-badge player-profile__tier-badge--gold";
  if (tier === "holo") return "player-profile__tier-badge player-profile__tier-badge--holo-premium";
  if (tier === "player") return "player-profile__tier-badge player-profile__tier-badge--player";
  return "player-profile__tier-badge";
}

export function CardTierBadge({ tier = "default", className = "" }) {
  const label = cardTierDisplayLabel(tier);
  const extra = className ? ` ${className}` : "";

  if (tier === "holo") {
    return (
      <span className={`player-profile__tier-badge player-profile__tier-badge--holo-premium${extra}`}>
        <span className="player-profile__tier-badge-label">{label}</span>
      </span>
    );
  }

  return <span className={`${tierBadgeClass(tier)}${extra}`}>{label}</span>;
}
