export const CARD_TIER_KEYS = ["default", "player", "gold", "holo"];

const LEGACY_TIER_COSTS = {
  default: { registrationCostRupees: 300, cardCostRupees: 0, bundledPriceRupees: 0 },
  player: { registrationCostRupees: 300, cardCostRupees: 240, bundledPriceRupees: 240 },
  gold: { registrationCostRupees: 240, cardCostRupees: 300, bundledPriceRupees: 400 },
  holo: { registrationCostRupees: 300, cardCostRupees: 600, bundledPriceRupees: 600 },
};

export function normalizeTierConfig(tier = {}, tierKey = "default", standardRegistrationRupees = 300) {
  const legacy = LEGACY_TIER_COSTS[tierKey] || {};
  const merged = { ...legacy, ...tier };
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
  merged.discountPercent = parseDiscountPercent(merged.discountPercent);
  merged.bundleTotalRupees = merged.registrationCostRupees + merged.cardCostRupees;
  return merged;
}

export function parseDiscountPercent(value) {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function computeBundleTotal(tier, tierKey, standardRegistrationRupees = 300) {
  return normalizeTierConfig(tier, tierKey, standardRegistrationRupees).bundleTotalRupees;
}

export function enrichCardTiers(cardTiers, standardRegistrationRupees = 300, baseTiers = {}) {
  const stored = cardTiers && typeof cardTiers === "object" ? cardTiers : {};
  const out = {};
  for (const key of CARD_TIER_KEYS) {
    out[key] = normalizeTierConfig({ ...baseTiers[key], ...stored[key] }, key, standardRegistrationRupees);
  }
  return out;
}

export function resolveBundleLineItem(config, cardTier) {
  const standard = config?.registrationFeeRupees ?? 300;
  const tiers = enrichCardTiers(config?.cardTiers, standard);
  const tierKey = tiers[cardTier] ? cardTier : "default";
  const tierConfig = tiers[tierKey];
  if (tierConfig.enabled === false && tierKey !== "default") {
    return resolveBundleLineItem(config, "default");
  }
  return {
    key: `bundle_${tierKey}`,
    label: tierConfig.label || `${tierKey} bundle`,
    amount: tierConfig.bundleTotalRupees,
    tier: tierKey,
    bundleLabel: tierConfig.label || `${tierKey} bundle`,
  };
}

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
  const tiers = enrichCardTiers(commerce?.cardTiers, standard);
  let highest = "default";
  for (const key of CARD_TIER_KEYS) {
    if (isTierEnabled(tiers[key], key)) highest = key;
  }
  return highest;
}

export function computeUpgradeDelta(commerce, fromTier, toTier) {
  const standard = commerce?.registrationFeeRupees ?? 300;
  const tiers = enrichCardTiers(commerce?.cardTiers, standard);
  const fromKey = tiers[fromTier] ? fromTier : "default";
  const toKey = tiers[toTier] ? toTier : "default";
  if (tierRank(toKey) <= tierRank(fromKey)) return 0;
  const fromTotal = tiers[fromKey].bundleTotalRupees;
  const toTotal = tiers[toKey].bundleTotalRupees;
  return Math.max(0, toTotal - fromTotal);
}

export function getUpgradeableTiers(commerce, currentTier) {
  const standard = commerce?.registrationFeeRupees ?? 300;
  const tiers = enrichCardTiers(commerce?.cardTiers, standard);
  const fromKey = tiers[currentTier] ? currentTier : "default";
  const fromRank = tierRank(fromKey);
  const options = [];

  for (const key of CARD_TIER_KEYS) {
    if (tierRank(key) <= fromRank) continue;
    if (!isTierEnabled(tiers[key], key)) continue;
    const delta = computeUpgradeDelta(commerce, fromKey, key);
    if (delta <= 0) continue;
    options.push({
      tier: key,
      label: tiers[key].label || key,
      description: tiers[key].description || "",
      upgradeDeltaRupees: delta,
      bundleTotalRupees: tiers[key].bundleTotalRupees,
    });
  }
  return options;
}

export function resolveUpgradeLineItem(config, fromTier, toTier) {
  const standard = config?.registrationFeeRupees ?? 300;
  const tiers = enrichCardTiers(config?.cardTiers, standard);
  const fromKey = tiers[fromTier] ? fromTier : "default";
  const toKey = tiers[toTier] ? toTier : "default";
  const delta = computeUpgradeDelta(config, fromKey, toKey);
  const fromLabel = tiers[fromKey].label || fromKey;
  const toLabel = tiers[toKey].label || toKey;
  return {
    key: `upgrade_${fromKey}_to_${toKey}`,
    label: `Card upgrade: ${fromLabel} → ${toLabel}`,
    amount: delta,
    tier: toKey,
    fromTier: fromKey,
    toTier: toKey,
    bundleLabel: toLabel,
  };
}
