export const pages = ["setup", "teams", "bracket", "standings", "schedule"];

export const roles = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];

/**
 * Ready to paste into Setup → Rule book for a 10-team BLAST tournament.
 * Use the “Insert” control on Setup when format is BLAST and team count is 10.
 */
export const blastTenTeamRulebookOverview = `BLAST — 10 teams (short overview)

STRUCTURE
• Two groups of 5, BO1 round robin (everyone in-group plays everyone once).
• Order: Groups → Last Chance → Play-In → Main playoffs (QF → SF → Final).

WHO ADVANCES FROM GROUPS
• 1st in each group → Main semifinals (after quarterfinals finish).
• 2nd in each group → Main quarterfinals vs the two Play-In winners.
• 3rd–5th in each group → Side path only (see below).

SIDE PATH (6 TEAMS)
The six teams who are NOT 1st or 2nd in either group are ranked together using wins, then Neustadtl (quality of opponents you beat), then tie-breakers.
• Best 2 → seeded into Play-In.
• Other 4 → Last Chance (4-team single elimination → 2 winners).
Play-In: those 2 + the 2 group-side seeds = 4 teams, one knockout round → 2 winners → those 2 play the group 2nds in main quarterfinals.

MAIN PLAYOFFS
• Quarterfinals: Group A 2nd vs Play-In winner · Group B 2nd vs Play-In winner.
• Semifinals: Group A 1st vs one QF winner · Group B 1st vs the other QF winner.
• Final: semi winners.

NOTES
• Series length (BO3/BO5) follows the tournament series rules in admin.
• Bracket placeholders fill from standings once every group BO1 has a result.`;

export const formatDetails = {
  dse: {
    name: "Double Elimination",
    tag: "Most competitive",
    description:
      "Upper and lower brackets. Teams get a second life after their first loss, which creates deeper runs and stronger finals.",
    guidance:
      "Best when you want fairness and comeback stories. Recommended for serious 8-team tournaments.",
  },
  se: {
    name: "Single Elimination",
    tag: "Fast format",
    description:
      "Straight knockout bracket. Every match matters because one loss ends the run.",
    guidance:
      "Best for short events, one-day cups, or when stream time is limited.",
  },
  gsl: {
    name: "GSL Groups",
    tag: "Group stage classic",
    description:
      "Teams compete in mini double-elimination groups before advancing to playoffs.",
    guidance:
      "Great when you want structured group-stage drama before a final bracket.",
  },
  rr: {
    name: "Round Robin",
    tag: "Data-rich standings",
    description:
      "Everyone plays everyone. Standings are built from consistency over many matches.",
    guidance:
      "Best when you need reliable rankings and enough time for multiple rounds.",
  },
  swiss: {
    name: "Swiss System",
    tag: "Balanced pairings",
    description:
      "Teams face others with similar records each round. Progression reflects current form.",
    guidance:
      "Best for qualifiers and large pools where you want strong pairing quality.",
  },
  hybrid: {
    name: "Group + Playoffs",
    tag: "Pro circuit style",
    description:
      "A standings-driven group phase feeds into a high-stakes playoff bracket.",
    guidance:
      "Best for premium events where both consistency and elimination pressure matter.",
  },
  blast: {
    name: "BLAST-style slam",
    tag: "Groups → Last Chance → Play-In → playoffs",
    description:
      "Two BO1 round-robin groups, Last chance elimination, Play-In layers, then main playoffs. Field sizes scale with team count (minimum 10). At 10 teams: #1 wait in semis, #2 enters QF vs Play-In finalists, #3 + two LC survivors fill a 4-slot Play-In, #4–#5 begin Last chance. At 12 teams: #1 wait in semis; #3/#4 fight a middle knockout (A3↔B4, B3↔A4); #5/#6 Last chance; each #2 meets a LC finalist in crossover; four QF winners feed cross-seeded semis vs the BO1 champions.",
    guidance:
      "Requires at least ten teams. Larger events add depth to the Last chance bracket; Play-In stays on a 4-slot (n=10) or 8-slot mini-bracket with seeds and byes from standings. Group winners still enter the main path at semis (or QF at 10 teams) per the generator rules.",
  },
};

export const seriesOptions = ["bo1", "bo2", "bo3", "bo5"];

/** Mirrors server `getBlastPhaseSizes` for setup / series templates — keep sync with `formatGenerator.js`. */
export function getBlastPhaseSizesUi(n) {
  const x = Math.max(0, Number(n) || 0);
  if (x < 10) return null;
  const lcEntrants = Math.max(4, x - 8);

  if (x === 10) {
    const sidePoolExcluded = 4;
    const remainder = x - sidePoolExcluded;
    const playInFromGroups = remainder - lcEntrants;
    if (playInFromGroups < 0) return null;
    return {
      lcEntrants,
      playInFromGroups,
      remainder,
      piBracketSlots: 4,
      middleBracketEntrants: null,
      /** @type {"ten_qf_seconds"} */
      mainPlayoffPath: "ten_qf_seconds",
    };
  }

  const middleBracketEntrants = x - 4 - lcEntrants;
  if (middleBracketEntrants < 1) return null;

  return {
    lcEntrants,
    playInFromGroups: null,
    remainder: null,
    piBracketSlots: null,
    middleBracketEntrants,
    /** @type {"tiered_merged_standings"} */
    mainPlayoffPath: "tiered_merged_standings",
  };
}

/** n=10 / n=12: bracket slots use Group A/B #n only — not merged global ranks. */
export function blastBracketUsesGroupRanksOnly(teamCount) {
  const sizes = getBlastPhaseSizesUi(teamCount);
  if (!sizes) return false;
  if (sizes.mainPlayoffPath === "ten_qf_seconds") return true;
  if (sizes.mainPlayoffPath === "tiered_merged_standings" && teamCount === 12) return true;
  return false;
}

/** Last chance series keys (depth depends on entrant count; generator picks among these). */
const blastLcSeriesTemplates = [
  { key: "blast-lc-quarterfinal", label: "Last Chance — bracket round of 8 (if used)", defaultSeries: "bo3" },
  { key: "blast-lc-semifinal", label: "Last Chance — bracket round of 4 (semis / first LC round)", defaultSeries: "bo3" },
  { key: "blast-lc-final", label: "Last Chance — bracket final pair (if used)", defaultSeries: "bo3" },
  { key: "blast-lc-round", label: "Last Chance — oversized field mid rounds", defaultSeries: "bo3" },
];

const blastPlayoffSeriesTemplates = [
  { key: "blast-po-quarterfinal", label: "Playoffs — quarterfinals", defaultSeries: "bo3" },
  { key: "blast-po-semifinal", label: "Playoffs — semifinals", defaultSeries: "bo3" },
  { key: "blast-po-final", label: "Playoffs — grand final", defaultSeries: "bo5" },
];

/** Group-phase rule key emitted by generator (`blast-group-bo1`). */
const blastGroupTemplate = [{ key: "blast-group-bo1", label: "Group stage (BO1 pools)", defaultSeries: "bo1" }];

/**
 * Series-rule rows for Setup that match bracket `seriesRuleKey` strings from `formatGenerator.js`.
 * @param {number} teamCount — BLAST bracket size (minimum 10 for valid layout).
 */
export function getBlastSeriesRuleTemplates(teamCount) {
  const n = Math.max(10, Number(teamCount) || 10);
  const sizes = getBlastPhaseSizesUi(n);
  const playoffs = [...blastPlayoffSeriesTemplates];

  if (!sizes) {
    return [...blastGroupTemplate, ...blastLcSeriesTemplates, ...playoffs];
  }

  const lc = [...blastLcSeriesTemplates];

  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    return [
      ...blastGroupTemplate,
      ...lc,
      {
        key: "blast-playin-semifinal",
        label: "Play-In — one round (#3 ranks + LC advancers)",
        defaultSeries: "bo3",
      },
      ...playoffs,
    ];
  }

  return [
    ...blastGroupTemplate,
    ...lc,
    {
      key: "blast-mp-semifinal",
      label: "Play-In — middle (#3/#4)",
      defaultSeries: "bo3",
    },
    {
      key: "blast-playin-cross",
      label: "Play-In — crossover (group #2 vs LC finalist)",
      defaultSeries: "bo3",
    },
    ...playoffs,
  ];
}

/**
 * Fills defaults for BLAST-specific keys after team count crosses 10 ⇄ tiered paths.
 */
export function mergeBlastSeriesRules(seriesRules, teamCount, seriesTypeFallback = "bo3") {
  const prev = typeof seriesRules === "object" && seriesRules !== null ? seriesRules : {};
  const merged = { ...prev };
  for (const rule of getBlastSeriesRuleTemplates(teamCount)) {
    const v = merged[rule.key];
    if (v == null || v === "") {
      merged[rule.key] = rule.defaultSeries || seriesTypeFallback;
    }
  }
  return merged;
}

export const seriesRuleTemplates = {
  dse: [
    { key: "upper-r1", label: "Upper Bracket Round 1", defaultSeries: "bo3" },
    { key: "upper-r2", label: "Upper Bracket Round 2", defaultSeries: "bo3" },
    { key: "lower-all", label: "Lower Bracket Rounds", defaultSeries: "bo3" },
    { key: "grand-final", label: "Grand Final", defaultSeries: "bo5" },
  ],
  se: [
    { key: "quarterfinal", label: "Quarterfinals", defaultSeries: "bo3" },
    { key: "semifinal", label: "Semifinals", defaultSeries: "bo3" },
    { key: "final", label: "Final", defaultSeries: "bo5" },
  ],
  gsl: [
    { key: "groups-open", label: "Group Openers", defaultSeries: "bo2" },
    { key: "groups-decider", label: "Group Deciders", defaultSeries: "bo3" },
    { key: "playoffs", label: "Playoffs", defaultSeries: "bo3" },
    { key: "grand-final", label: "Grand Final", defaultSeries: "bo5" },
  ],
  rr: [
    { key: "league", label: "League Matches", defaultSeries: "bo2" },
    { key: "playoff-semi", label: "Playoff Semifinals", defaultSeries: "bo3" },
    { key: "playoff-final", label: "Playoff Final", defaultSeries: "bo5" },
  ],
  swiss: [
    { key: "swiss-r1", label: "Swiss Round 1", defaultSeries: "bo1" },
    { key: "swiss-r2", label: "Swiss Round 2", defaultSeries: "bo3" },
    { key: "swiss-r3", label: "Swiss Round 3", defaultSeries: "bo3" },
    { key: "qualifier-final", label: "Qualification Match", defaultSeries: "bo5" },
  ],
  hybrid: [
    { key: "group-stage", label: "Group Stage", defaultSeries: "bo2" },
    { key: "upper-playoff", label: "Upper Playoffs", defaultSeries: "bo3" },
    { key: "lower-playoff", label: "Lower Playoffs", defaultSeries: "bo3" },
    { key: "grand-final", label: "Grand Final", defaultSeries: "bo5" },
  ],
};

export function buildDefaultSeriesRules(format, fallback = "bo3", blastTeamCount) {
  if (format === "blast") {
    const n = blastTeamCount != null ? Math.max(10, Number(blastTeamCount) || 10) : 12;
    return getBlastSeriesRuleTemplates(n).reduce((acc, item) => {
      acc[item.key] = item.defaultSeries || fallback;
      return acc;
    }, {});
  }
  const template = seriesRuleTemplates[format] || [];
  return template.reduce((acc, item) => {
    acc[item.key] = item.defaultSeries || fallback;
    return acc;
  }, {});
}
