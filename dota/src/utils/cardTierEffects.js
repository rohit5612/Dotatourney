/** Gold and holo tiers receive directory / profile visual effects. */
export const PREMIUM_CARD_TIER_FX = ["gold", "holo"];

export function hasPremiumCardTierFx(tier) {
  return tier === "gold" || tier === "holo";
}

export function isGoldTierFx(tier) {
  return tier === "gold";
}

export function isHoloTierFx(tier) {
  return tier === "holo";
}

export function premiumTierPanelClass(tier, className = "") {
  if (isGoldTierFx(tier)) return `${className} bpcl-tier-fx__panel`.trim();
  if (isHoloTierFx(tier)) return `${className} bpcl-tier-fx-holo__panel`.trim();
  return className;
}

/** @deprecated Use premiumTierPanelClass */
export function goldTierPanelClass(tier, className = "") {
  return premiumTierPanelClass(tier, className);
}

export function premiumLayoutClass(tier) {
  if (isGoldTierFx(tier)) return "player-profile-layout--gold-fx";
  if (isHoloTierFx(tier)) return "player-profile-layout--holo-fx";
  return "";
}

export function premiumHeroBandClass(tier) {
  if (isGoldTierFx(tier)) return "bpcl-tier-fx__hero-band";
  if (isHoloTierFx(tier)) return "bpcl-tier-fx-holo__hero-band";
  return "";
}

export function premiumAboutClass(tier) {
  if (isGoldTierFx(tier)) return "bpcl-tier-fx__about";
  if (isHoloTierFx(tier)) return "bpcl-tier-fx-holo__about";
  return "";
}

export function premiumShineTextClass(tier, variant = "") {
  const suffix =
    variant === "hero"
      ? " bpcl-tier-fx__shine-text--hero"
      : variant === "id"
        ? " bpcl-tier-fx__shine-text--id"
        : "";
  const holoSuffix =
    variant === "hero"
      ? " bpcl-tier-fx-holo__shine-text--hero"
      : variant === "id"
        ? " bpcl-tier-fx-holo__shine-text--id"
        : "";

  if (isGoldTierFx(tier)) return `bpcl-tier-fx__shine-text${suffix}`.trim();
  if (isHoloTierFx(tier)) return `bpcl-tier-fx-holo__shine-text${holoSuffix}`.trim();
  return "";
}

export function premiumCardGlowClass(tier) {
  if (isGoldTierFx(tier)) return "bpcl-tier-fx__card-glow";
  if (isHoloTierFx(tier)) return "";
  return "";
}
