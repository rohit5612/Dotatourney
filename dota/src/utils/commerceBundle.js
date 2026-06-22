import { cardTierDisplayLabel } from "../constants/cardTierPreviews.js";

const TIER_DEFAULTS = {
  default: { registrationCostRupees: 300, cardCostRupees: 0, bundledPriceRupees: 0 },
  player: { registrationCostRupees: 300, cardCostRupees: 240, bundledPriceRupees: 240 },
  gold: { registrationCostRupees: 240, cardCostRupees: 300, bundledPriceRupees: 400 },
  holo: { registrationCostRupees: 300, cardCostRupees: 600, bundledPriceRupees: 600 },
};

export function normalizeTierConfig(tier = {}, tierKey = "default", standardRegistrationRupees = 300) {
  const base = TIER_DEFAULTS[tierKey] || {};
  const merged = { ...base, ...tier };
  const standard = Number(standardRegistrationRupees) || 300;

  if (merged.registrationCostRupees == null && merged.cardCostRupees == null) {
    if (tierKey === "default") {
      merged.registrationCostRupees = standard;
      merged.cardCostRupees = 0;
    } else {
      merged.registrationCostRupees = standard;
      merged.cardCostRupees = Number(merged.bundledPriceRupees) || 0;
    }
  }

  merged.registrationCostRupees = Math.max(0, Number(merged.registrationCostRupees) || 0);
  merged.cardCostRupees = Math.max(0, Number(merged.cardCostRupees) || 0);
  merged.discountPercent = normalizeDiscountPercent(merged.discountPercent);
  merged.bundleTotalRupees = merged.registrationCostRupees + merged.cardCostRupees;
  return merged;
}

export function parseDiscountPercent(value) {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function normalizeDiscountPercent(value) {
  return parseDiscountPercent(value);
}

export function formatDiscountLabel(value) {
  const n = parseDiscountPercent(value);
  if (n <= 0) return null;
  const text = Number.isInteger(n) ? String(n) : String(n);
  return `${text}% off`;
}

export function bundleTotalForTier(tier, tierKey, standardRegistrationRupees = 300) {
  return normalizeTierConfig(tier, tierKey, standardRegistrationRupees).bundleTotalRupees;
}

const CARD_TIER_KEYS = ["default", "player", "gold", "holo"];

export function tierRank(tier) {
  const idx = CARD_TIER_KEYS.indexOf(tier);
  return idx === -1 ? CARD_TIER_KEYS.length : idx;
}

export function isTierEnabled(tierConfig, tierKey) {
  if (tierKey === "default") return true;
  return tierConfig?.enabled !== false;
}

export function getHighestEnabledTier(commerce) {
  const standard = commerce?.registrationFeeRupees ?? 300;
  const tiers = {};
  for (const key of CARD_TIER_KEYS) {
    tiers[key] = normalizeTierConfig(commerce?.cardTiers?.[key], key, standard);
  }
  let highest = "default";
  for (const key of CARD_TIER_KEYS) {
    if (isTierEnabled(tiers[key], key)) highest = key;
  }
  return highest;
}

export function computeUpgradeDelta(commerce, fromTier, toTier) {
  const standard = commerce?.registrationFeeRupees ?? 300;
  const fromKey = CARD_TIER_KEYS.includes(fromTier) ? fromTier : "default";
  const toKey = CARD_TIER_KEYS.includes(toTier) ? toTier : "default";
  if (tierRank(toKey) <= tierRank(fromKey)) return 0;
  const fromTotal = bundleTotalForTier(commerce?.cardTiers?.[fromKey], fromKey, standard);
  const toTotal = bundleTotalForTier(commerce?.cardTiers?.[toKey], toKey, standard);
  return Math.max(0, toTotal - fromTotal);
}

export function getUpgradeableTiers(commerce, currentTier) {
  const standard = commerce?.registrationFeeRupees ?? 300;
  const fromKey = CARD_TIER_KEYS.includes(currentTier) ? currentTier : "default";
  const fromRank = tierRank(fromKey);
  const options = [];

  for (const key of CARD_TIER_KEYS) {
    if (tierRank(key) <= fromRank) continue;
    const tierConfig = normalizeTierConfig(commerce?.cardTiers?.[key], key, standard);
    if (!isTierEnabled(tierConfig, key)) continue;
    const delta = computeUpgradeDelta(commerce, fromKey, key);
    if (delta <= 0) continue;
    options.push({
      tier: key,
      label: tierConfig.label || cardTierDisplayLabel(key),
      description: tierConfig.description || "",
      upgradeDeltaRupees: delta,
      bundleTotalRupees: tierConfig.bundleTotalRupees,
    });
  }
  return options;
}
