import "./CardTierStyles.css";

const TIER_LABELS = {
  default: "BPC Player",
  player: "Player Card",
  gold: "Gold Card",
  holo: "Holo Card",
};

export function BpclCard({ manifest, size = "md", className = "" }) {
  if (!manifest) return null;
  const tier = manifest.tier || "default";
  const stats = manifest.stats || {};
  const role = stats.role || manifest.role || "";
  const mmr = stats.mmr ?? manifest.mmr;

  return (
    <article
      className={`bpcl-card bpcl-card--${tier} bpcl-card--${size} ${className}`.trim()}
      aria-label={`${manifest.displayName || "Player"} ${TIER_LABELS[tier] || "card"}`}
    >
      <div className="bpcl-card__frame">
        <div className="bpcl-card__header">
          <span className="bpcl-card__tier">{TIER_LABELS[tier]}</span>
          {manifest.seasonBadge ? <span className="bpcl-card__season">{manifest.seasonBadge}</span> : null}
        </div>
        <div className="bpcl-card__avatar-wrap">
          {manifest.customImage || manifest.steamAvatar ? (
            <img
              src={manifest.customImage || manifest.steamAvatar}
              alt=""
              className="bpcl-card__avatar"
            />
          ) : (
            <div className="bpcl-card__avatar bpcl-card__avatar--placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="bpcl-card__body">
          <p className="bpcl-card__name">{manifest.displayName || "Player"}</p>
          <p className="bpcl-card__id">{manifest.bpcId}</p>
          {tier !== "default" && (role || mmr != null) ? (
            <p className="bpcl-card__stats">
              {[role, mmr != null ? `${mmr} MMR` : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {manifest.tagline ? <p className="bpcl-card__tagline">{manifest.tagline}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function BpclCardMini({ manifest, className = "" }) {
  return <BpclCard manifest={manifest} size="sm" className={className} />;
}
