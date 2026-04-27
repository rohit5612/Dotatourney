import { randomUUID } from "node:crypto";

function resolveSeries(seriesRules, key, fallback = "bo3") {
  return seriesRules?.[key] || fallback;
}

function match(team1, team2, stageKey, roundIndex, matchIndex, meta = {}) {
  return {
    id: randomUUID(),
    stageKey,
    roundIndex,
    matchIndex,
    team1,
    team2,
    winner: null,
    status: "upcoming",
    stream: null,
    slotAt: null,
    meta,
  };
}

function teamAt(teams, index) {
  return teams[index] || `Team ${index + 1}`;
}

function nextPowerOfTwo(value) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function addMatch(result, teams, stageKey, roundIndex, matchIndex, team1, team2, seriesRules, seriesRuleKey, meta = {}) {
  result.push(
    match(team1, team2, stageKey, roundIndex, matchIndex, {
      ...meta,
      seriesRuleKey,
      seriesType: resolveSeries(seriesRules, seriesRuleKey),
    }),
  );
}

function roundRobinPairs(indices) {
  const list = indices.length % 2 === 0 ? [...indices] : [...indices, null];
  const rounds = [];
  const size = list.length;
  for (let round = 0; round < size - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < size / 2; index += 1) {
      const a = list[index];
      const b = list[size - 1 - index];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

function generateSingleElimination(teams, seriesRules, stageKey = "bracket", rulePrefix = "") {
  const result = [];
  const quarterKey = rulePrefix ? `${rulePrefix}quarterfinal` : "quarterfinal";
  const semiKey = rulePrefix ? `${rulePrefix}semifinal` : "semifinal";
  const finalKey = rulePrefix ? `${rulePrefix}final` : "final";
  const bracketSize = nextPowerOfTwo(Math.max(2, teams.length));
  let entrants = Array.from({ length: bracketSize }, (_, index) => (index < teams.length ? teamAt(teams, index) : "BYE"));
  let roundIndex = 0;

  while (entrants.length > 1) {
    const roundSize = entrants.length / 2;
    const ruleKey = entrants.length === 2 ? finalKey : entrants.length === 4 ? semiKey : quarterKey;
    const winners = [];
    for (let matchIndex = 0; matchIndex < roundSize; matchIndex += 1) {
      const team1 = entrants[matchIndex];
      const team2 = entrants[entrants.length - 1 - matchIndex];
      const winToken = entrants.length === 2 ? "CHAMPION" : `R${roundIndex + 1}M${matchIndex + 1}W`;
      if (team1 === "BYE") {
        winners.push(team2);
      } else if (team2 === "BYE") {
        winners.push(team1);
      } else {
        addMatch(result, teams, stageKey, roundIndex, matchIndex, team1, team2, seriesRules, ruleKey, { winToken });
        winners.push(winToken);
      }
    }
    entrants = winners;
    roundIndex += 1;
  }

  return result;
}

function generateDse(teams, seriesRules) {
  if (teams.length !== 8) {
    return generateSingleElimination(teams, seriesRules, "upper");
  }

  const result = [];
  const mappings = [
    ["upper", teamAt(teams, 0), teamAt(teams, 7), 0, 0, "UQF1W", "upper-r1"],
    ["upper", teamAt(teams, 3), teamAt(teams, 4), 0, 1, "UQF2W", "upper-r1"],
    ["upper", teamAt(teams, 1), teamAt(teams, 6), 1, 0, "UQF3W", "upper-r1"],
    ["upper", teamAt(teams, 2), teamAt(teams, 5), 1, 1, "UQF4W", "upper-r1"],
    ["upper", "UQF1W", "UQF2W", 2, 0, "USF1W", "upper-r2"],
    ["upper", "UQF3W", "UQF4W", 2, 1, "USF2W", "upper-r2"],
    ["upper", "USF1W", "USF2W", 3, 0, "UBW", "upper-r2"],
    ["lower", "UQF1L", "UQF2L", 0, 0, "LR1W1", "lower-all"],
    ["lower", "UQF3L", "UQF4L", 0, 1, "LR1W2", "lower-all"],
    ["lower", "LR1W1", "USF1L", 1, 0, "LR2W1", "lower-all"],
    ["lower", "LR1W2", "USF2L", 1, 1, "LR2W2", "lower-all"],
    ["lower", "LR2W1", "LR2W2", 2, 0, "LR3W", "lower-all"],
    ["lower", "LR3W", "UBL", 3, 0, "LBW", "lower-all"],
    ["grand", "UBW", "LBW", 0, 0, "CHAMPION", "grand-final"],
  ];
  mappings.forEach(([stageKey, team1, team2, roundIndex, matchIndex, winToken, ruleKey]) => {
    addMatch(result, teams, stageKey, roundIndex, matchIndex, team1, team2, seriesRules, ruleKey, { winToken });
  });
  return result;
}

function generateRoundRobin(teams, seriesRules, stageKey = "league", ruleKey = "league", indices = teams.map((_, index) => index), groupKey = null) {
  const result = [];
  roundRobinPairs(indices).forEach((round, roundIndex) => {
    round.forEach(([a, b], matchIndex) => {
      addMatch(result, teams, stageKey, roundIndex, matchIndex, teamAt(teams, a), teamAt(teams, b), seriesRules, ruleKey, {
        groupKey,
      });
    });
  });
  return result;
}

function generateRr(teams, seriesRules) {
  const result = generateRoundRobin(teams, seriesRules, "league", "league");
  addMatch(result, teams, "playoffs", 0, 0, "League #1", "League #4", seriesRules, "playoff-semi", { winToken: "PSF1W" });
  addMatch(result, teams, "playoffs", 0, 1, "League #2", "League #3", seriesRules, "playoff-semi", { winToken: "PSF2W" });
  addMatch(result, teams, "playoffs", 1, 0, "PSF1W", "PSF2W", seriesRules, "playoff-final", { winToken: "CHAMPION" });
  return result;
}

function generateGsl(teams, seriesRules) {
  if (teams.length !== 8) {
    const midpoint = Math.ceil(teams.length / 2);
    const result = [];
    result.push(...generateRoundRobin(teams, seriesRules, "group-a", "groups-open", teams.slice(0, midpoint).map((_, index) => index), "A"));
    result.push(...generateRoundRobin(teams, seriesRules, "group-b", "groups-open", teams.slice(midpoint).map((_, index) => midpoint + index), "B"));
    addMatch(result, teams, "playoffs", 0, 0, "Group A #1", "Group B #2", seriesRules, "playoffs", { winToken: "GSF1W" });
    addMatch(result, teams, "playoffs", 0, 1, "Group B #1", "Group A #2", seriesRules, "playoffs", { winToken: "GSF2W" });
    addMatch(result, teams, "playoffs", 1, 0, "GSF1W", "GSF2W", seriesRules, "grand-final", { winToken: "CHAMPION" });
    return result;
  }

  const result = [];
  const groups = [
    { key: "A", indices: [0, 3, 4, 7] },
    { key: "B", indices: [1, 2, 5, 6] },
  ];
  groups.forEach((group, groupIndex) => {
    const [a, b, c, d] = group.indices;
    const stageKey = `group-${group.key.toLowerCase()}`;
    addMatch(result, teams, stageKey, 0, 0, teamAt(teams, a), teamAt(teams, d), seriesRules, "groups-open", { groupKey: group.key, winToken: `G${group.key}O1W` });
    addMatch(result, teams, stageKey, 0, 1, teamAt(teams, b), teamAt(teams, c), seriesRules, "groups-open", { groupKey: group.key, winToken: `G${group.key}O2W` });
    addMatch(result, teams, stageKey, 1, 0, `G${group.key}O1W`, `G${group.key}O2W`, seriesRules, "groups-decider", { groupKey: group.key, winToken: `G${group.key}1` });
    addMatch(result, teams, stageKey, 1, 1, `G${group.key}O1L`, `G${group.key}O2L`, seriesRules, "groups-decider", { groupKey: group.key, winToken: `G${group.key}L1W` });
    addMatch(result, teams, stageKey, 2, 0, `G${group.key}L1W`, `G${group.key}DECIDER_L`, seriesRules, "groups-decider", { groupKey: group.key, winToken: `G${group.key}2` });
    addMatch(result, teams, "playoffs", 0, groupIndex, `G${group.key}1`, group.key === "A" ? "GB2" : "GA2", seriesRules, "playoffs", { winToken: `GSF${groupIndex + 1}W` });
  });
  addMatch(result, teams, "playoffs", 1, 0, "GSF1W", "GSF2W", seriesRules, "grand-final", { winToken: "CHAMPION" });
  return result;
}

function generateSwiss(teams, seriesRules) {
  const result = [];
  const rounds = roundRobinPairs(teams.map((_, index) => index)).slice(0, Math.min(3, Math.max(1, teams.length - 1)));
  rounds.forEach((round, roundIndex) => {
    round.forEach(([a, b], matchIndex) => {
      addMatch(result, teams, "swiss", roundIndex, matchIndex, teamAt(teams, a), teamAt(teams, b), seriesRules, `swiss-r${roundIndex + 1}`, {
        groupKey: "Swiss",
      });
    });
  });
  addMatch(result, teams, "playoffs", 0, 0, "Swiss #1", "Swiss #4", seriesRules, "qualifier-final", { winToken: "SQ1W" });
  addMatch(result, teams, "playoffs", 0, 1, "Swiss #2", "Swiss #3", seriesRules, "qualifier-final", { winToken: "SQ2W" });
  addMatch(result, teams, "playoffs", 1, 0, "SQ1W", "SQ2W", seriesRules, "qualifier-final", { winToken: "CHAMPION" });
  return result;
}

function generateHybrid(teams, seriesRules) {
  if (teams.length !== 8) {
    const midpoint = Math.ceil(teams.length / 2);
    const result = [];
    result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", teams.slice(0, midpoint).map((_, index) => index), "A"));
    result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", teams.slice(midpoint).map((_, index) => midpoint + index), "B"));
    result.push(...generateSingleElimination(teams, seriesRules, "upper-playoff", "upper-playoff-"));
    return result;
  }

  const result = [];
  result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", [0, 3, 4, 7], "A"));
  result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", [1, 2, 5, 6], "B"));
  addMatch(result, teams, "upper-playoff", 0, 0, "Group A #1", "Group B #2", seriesRules, "upper-playoff", { winToken: "HUSF1W" });
  addMatch(result, teams, "upper-playoff", 0, 1, "Group B #1", "Group A #2", seriesRules, "upper-playoff", { winToken: "HUSF2W" });
  addMatch(result, teams, "upper-playoff", 1, 0, "HUSF1W", "HUSF2W", seriesRules, "upper-playoff", { winToken: "HUF" });
  addMatch(result, teams, "lower-playoff", 0, 0, "Group A #3", "Group B #4", seriesRules, "lower-playoff", { winToken: "HLR1W" });
  addMatch(result, teams, "lower-playoff", 0, 1, "Group B #3", "Group A #4", seriesRules, "lower-playoff", { winToken: "HLR2W" });
  addMatch(result, teams, "lower-playoff", 1, 0, "HLR1W", "HUSF1L", seriesRules, "lower-playoff", { winToken: "HLR3W" });
  addMatch(result, teams, "lower-playoff", 1, 1, "HLR2W", "HUSF2L", seriesRules, "lower-playoff", { winToken: "HLR4W" });
  addMatch(result, teams, "lower-playoff", 2, 0, "HLR3W", "HLR4W", seriesRules, "lower-playoff", { winToken: "HLF" });
  addMatch(result, teams, "grand", 0, 0, "HUF", "HLF", seriesRules, "grand-final", { winToken: "CHAMPION" });
  return result;
}

export function generateMatches(format, teams, seriesRules = {}) {
  if (format === "se") {
    return generateSingleElimination(teams, seriesRules);
  }

  if (format === "rr") {
    return generateRr(teams, seriesRules);
  }

  if (format === "gsl") return generateGsl(teams, seriesRules);
  if (format === "swiss") return generateSwiss(teams, seriesRules);
  if (format === "hybrid") return generateHybrid(teams, seriesRules);
  return generateDse(teams, seriesRules);
}

export function stageTabsForFormat(format) {
  const map = {
    dse: [
      { id: "upper", label: "Upper bracket" },
      { id: "lower", label: "Lower bracket" },
      { id: "grand", label: "Grand final" },
    ],
    hybrid: [
      { id: "group-stage", label: "Group stage" },
      { id: "upper-playoff", label: "Upper playoffs" },
      { id: "lower-playoff", label: "Lower playoffs" },
      { id: "grand", label: "Grand final" },
    ],
    se: [{ id: "bracket", label: "Bracket" }],
    rr: [
      { id: "league", label: "League stage" },
      { id: "playoffs", label: "Playoffs" },
    ],
    gsl: [
      { id: "group-a", label: "Group A" },
      { id: "group-b", label: "Group B" },
      { id: "playoffs", label: "Playoffs" },
    ],
    swiss: [
      { id: "swiss", label: "Swiss rounds" },
      { id: "playoffs", label: "Qualification playoffs" },
    ],
  };
  return map[format] || map.dse;
}
