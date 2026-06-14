import { getBlastPhaseSizes } from "./formatGenerator.js";

const BLAST_GROUP = { key: "blast-group-bo1", label: "Group stage (BO1 pools)", defaultSeries: "bo1" };

const BLAST_LC = [
  { key: "blast-lc-quarterfinal", label: "Last Chance — round of 8", defaultSeries: "bo3" },
  { key: "blast-lc-semifinal", label: "Last Chance — semifinals", defaultSeries: "bo3" },
  { key: "blast-lc-final", label: "Last Chance — final pair", defaultSeries: "bo3" },
  { key: "blast-lc-round", label: "Last Chance — mid rounds", defaultSeries: "bo3" },
];

const BLAST_PLAYOFFS = [
  { key: "blast-po-quarterfinal", label: "Playoffs — quarterfinals", defaultSeries: "bo3" },
  { key: "blast-po-semifinal", label: "Playoffs — semifinals", defaultSeries: "bo3" },
  { key: "blast-po-final", label: "Playoffs — grand final", defaultSeries: "bo5" },
];

const BLAST_PLAYIN_TEN = {
  key: "blast-playin-semifinal",
  label: "Play-In — one round (#3 + LC advancers)",
  defaultSeries: "bo3",
};

const BLAST_PLAYIN_TIERED = [
  { key: "blast-mp-semifinal", label: "Play-In — middle (#3/#4)", defaultSeries: "bo3" },
  { key: "blast-playin-cross", label: "Play-In — crossover (#2 vs LC)", defaultSeries: "bo3" },
];

export function getBlastSeriesRuleTemplates(teamCount) {
  const n = Math.max(10, Number(teamCount) || 10);
  const sizes = getBlastPhaseSizes(n);
  if (!sizes) return [BLAST_GROUP, ...BLAST_LC, ...BLAST_PLAYOFFS];
  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    return [BLAST_GROUP, ...BLAST_LC, BLAST_PLAYIN_TEN, ...BLAST_PLAYOFFS];
  }
  return [BLAST_GROUP, ...BLAST_LC, ...BLAST_PLAYIN_TIERED, ...BLAST_PLAYOFFS];
}

export function buildBlastSeriesRules(teamCount, seriesTypeFallback = "bo3", existing = {}) {
  const merged = { ...(existing && typeof existing === "object" ? existing : {}) };
  for (const rule of getBlastSeriesRuleTemplates(teamCount)) {
    if (merged[rule.key] == null || merged[rule.key] === "") {
      merged[rule.key] = rule.defaultSeries || seriesTypeFallback;
    }
  }
  return merged;
}
