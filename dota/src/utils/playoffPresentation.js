/** Client helpers for legacy 1-based playoff round configs (presentation-only). */

export function resolveDisplayWinToken(match) {
  return match?.meta?.presentationWinToken || match?.meta?.winToken || null;
}

export function resolveDisplaySeriesRuleKey(match) {
  return match?.meta?.presentationSeriesRuleKey || match?.meta?.seriesRuleKey || null;
}
