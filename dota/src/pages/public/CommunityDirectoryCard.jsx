import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BpclCardRenderer } from "../../components/cards/BpclCardRenderer.jsx";
import { CardRendererSkeleton } from "../../components/cards/CardRendererSkeleton.jsx";
import { premiumCardGlowClass, premiumShineTextClass } from "../../utils/cardTierEffects.js";

function honorBadgeClass(kind) {
  if (kind === "champion") return "community-page__honor-badge community-page__honor-badge--champion";
  if (kind === "mvp") return "community-page__honor-badge community-page__honor-badge--mvp";
  return "community-page__honor-badge";
}

function isHoloTier(player) {
  const card = player.card || {};
  const tier = player.cardTier || card.tier || card.renderTier || "default";
  return tier === "holo" || card.template === "holo" || card.cardPayload?.template === "holo";
}

export function CommunityDirectoryCard({ player }) {
  const cardSlotRef = useRef(null);
  const holo = isHoloTier(player);
  const [renderCard, setRenderCard] = useState(!holo);

  useEffect(() => {
    if (!holo) return undefined;
    const node = cardSlotRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRenderCard(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [holo]);

  const cardTier = player.cardTier || player.card?.tier || "default";
  const badges = player.badges || [];
  const cardGlowClass = premiumCardGlowClass(cardTier);
  const nameShineClass = premiumShineTextClass(cardTier);
  const idShineClass = premiumShineTextClass(cardTier, "id");

  return (
    <li className="community-page__grid-item">
      <Link to={`/player/${player.slug}`} className="community-page__card-entry">
        <div
          ref={cardSlotRef}
          className={`community-page__card-slot${cardGlowClass ? ` ${cardGlowClass}` : ""}${holo ? " community-page__card-slot--holo" : ""}`}
        >
          {renderCard ? (
            <BpclCardRenderer
              manifest={
                player.card || {
                  tier: cardTier,
                  displayName: player.displayName,
                  bpcId: player.bpcId,
                  steamAvatar: player.avatarUrl,
                }
              }
              size="md"
              interactive={false}
              showMeta={false}
              showAura={false}
            />
          ) : (
            <CardRendererSkeleton size="md" />
          )}
        </div>
        <div className="community-page__card-caption">
          <p className={`community-page__card-name${nameShineClass ? ` ${nameShineClass}` : ""}`}>
            {player.displayName}
          </p>
          <p className={`community-page__card-id${idShineClass ? ` ${idShineClass}` : ""}`}>{player.bpcId}</p>
        </div>
      </Link>
      <div
        className={`community-page__honor-badges${badges.length ? "" : " community-page__honor-badges--empty"}`}
        aria-label={badges.length ? "Season honors" : undefined}
      >
        {badges.map((badge) => (
          <span key={`${player.slug}-${badge.label}`} className={honorBadgeClass(badge.kind)}>
            {badge.label}
          </span>
        ))}
      </div>
    </li>
  );
}
