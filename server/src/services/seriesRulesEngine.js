/**
 * Resolve series type for a rule key from tournament config.
 * @param {Record<string, string>|null|undefined} seriesRules
 * @param {string} key
 * @param {string} [fallback]
 */
export function resolveSeries(seriesRules, key, fallback = "bo3") {
  return seriesRules?.[key] || fallback;
}

function isEligibleForSeriesUpdate(match) {
  if (match.winner) return false;
  return match.status === "upcoming";
}

/**
 * Apply tournament series_rules to eligible matches without changing bracket structure.
 * @param {Array<{ id: string, status?: string, winner?: string|null, meta?: Record<string, unknown> }>} matches
 * @param {Record<string, string>} seriesRules
 * @param {{ fallbackSeriesType?: string }} [options]
 */
export function applySeriesRulesToMatches(matches, seriesRules, options = {}) {
  const fallbackSeriesType = options.fallbackSeriesType || "bo3";
  let updatedCount = 0;
  let skippedCount = 0;

  const nextMatches = matches.map((match) => {
    if (!isEligibleForSeriesUpdate(match)) {
      skippedCount += 1;
      return match;
    }

    const ruleKey = match.meta?.seriesRuleKey;
    if (!ruleKey || typeof ruleKey !== "string") {
      skippedCount += 1;
      return match;
    }

    const nextType = resolveSeries(seriesRules, ruleKey, fallbackSeriesType);
    if (match.meta?.seriesType === nextType) {
      skippedCount += 1;
      return match;
    }

    updatedCount += 1;
    return {
      ...match,
      meta: {
        ...(match.meta || {}),
        seriesType: nextType,
      },
    };
  });

  return { matches: nextMatches, updatedCount, skippedCount };
}
