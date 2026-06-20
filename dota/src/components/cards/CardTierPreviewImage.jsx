import {
  CARD_TIER_PREVIEW_IMAGES,
  CARD_TIER_PREVIEW_LABELS,
} from "../../constants/cardTierPreviews.js";
import "./CardTierPreviewImage.css";

export function CardTierPreviewImage({ tier = "default", size = "md", className = "" }) {
  const src = CARD_TIER_PREVIEW_IMAGES[tier] || CARD_TIER_PREVIEW_IMAGES.default;
  const alt = CARD_TIER_PREVIEW_LABELS[tier] || "BPC card preview";
  const sizeClass = size === "sm" ? "card-tier-preview-img--sm" : "card-tier-preview-img--md";

  return (
    <img
      src={src}
      alt={alt}
      width={size === "sm" ? 160 : 224}
      height={size === "sm" ? 224 : 314}
      loading="lazy"
      decoding="async"
      className={`card-tier-preview-img ${sizeClass}${className ? ` ${className}` : ""}`.trim()}
    />
  );
}
