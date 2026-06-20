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
