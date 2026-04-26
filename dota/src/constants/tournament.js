export const pages = ["setup", "teams", "bracket", "standings", "schedule"];

export const roles = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];

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
};

export const seriesOptions = ["bo1", "bo2", "bo3", "bo5"];

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

export function buildDefaultSeriesRules(format, fallback = "bo3") {
  const template = seriesRuleTemplates[format] || [];
  return template.reduce((acc, item) => {
    acc[item.key] = item.defaultSeries || fallback;
    return acc;
  }, {});
}
