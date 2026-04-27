import { randomUUID } from "node:crypto";

export const formatTeamGuidance = {
  se: { min: 2, recommended: "4, 8, 16, 32", odd: "Supported with byes" },
  dse: { min: 4, recommended: "4, 8, 16", odd: "Supported with upper-bracket byes" },
  rr: { min: 3, recommended: "4-10", odd: "Supported with round byes" },
  gsl: { min: 4, recommended: "8 or 16", odd: "Supported with uneven groups" },
  swiss: { min: 4, recommended: "8, 16, 32", odd: "Supported with round byes" },
  hybrid: { min: 4, recommended: "8 or 16", odd: "Supported with uneven groups" },
};

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

function validateTeamCount(format, teamCount) {
  const guidance = formatTeamGuidance[format] || formatTeamGuidance.dse;
  if (teamCount < guidance.min) {
    return `${guidance.min} teams minimum required for ${format.toUpperCase()} brackets. Recommended: ${guidance.recommended}.`;
  }
  return "";
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

function roundRuleKey(size, rulePrefix, fallbackPrefix = "") {
  if (size === 2) return rulePrefix ? `${rulePrefix}final` : "final";
  if (size === 4) return rulePrefix ? `${rulePrefix}semifinal` : "semifinal";
  if (size === 8) return rulePrefix ? `${rulePrefix}quarterfinal` : "quarterfinal";
  return rulePrefix ? `${rulePrefix}round` : fallbackPrefix || "quarterfinal";
}

function pairEntrants(result, teams, entrants, stageKey, roundIndex, seriesRules, seriesRuleKey, tokenPrefix) {
  const winners = [];
  const pairCount = Math.floor(entrants.length / 2);
  for (let matchIndex = 0; matchIndex < pairCount; matchIndex += 1) {
    const team1 = entrants[matchIndex];
    const team2 = entrants[entrants.length - 1 - matchIndex];
    const winToken = `${tokenPrefix}${roundIndex + 1}M${matchIndex + 1}W`;
    if (team1 === "BYE") {
      winners.push(team2);
    } else if (team2 === "BYE") {
      winners.push(team1);
    } else {
      addMatch(result, teams, stageKey, roundIndex, matchIndex, team1, team2, seriesRules, seriesRuleKey, { winToken });
      winners.push(winToken);
    }
  }
  if (entrants.length % 2 === 1) {
    winners.push(entrants[Math.floor(entrants.length / 2)]);
  }
  return winners;
}

function generateSingleElimination(teams, seriesRules, stageKey = "bracket", rulePrefix = "") {
  const result = [];
  const bracketSize = nextPowerOfTwo(Math.max(2, teams.length));
  let entrants = Array.from({ length: bracketSize }, (_, index) => (index < teams.length ? teamAt(teams, index) : "BYE"));
  let roundIndex = 0;

  while (entrants.length > 1) {
    const ruleKey = roundRuleKey(entrants.length, rulePrefix, "quarterfinal");
    entrants = pairEntrants(result, teams, entrants, stageKey, roundIndex, seriesRules, ruleKey, "R");
    roundIndex += 1;
  }

  return result;
}

function generateDse(teams, seriesRules) {
  const result = [];
  const bracketSize = nextPowerOfTwo(Math.max(4, teams.length));
  let entrants = Array.from({ length: bracketSize }, (_, index) => (index < teams.length ? teamAt(teams, index) : "BYE"));
  const upperLosers = [];
  let upperRound = 0;

  while (entrants.length > 1) {
    const ruleKey = entrants.length <= 4 ? "upper-r2" : "upper-r1";
    const nextEntrants = [];
    const roundLosers = [];
    const pairCount = entrants.length / 2;
    for (let matchIndex = 0; matchIndex < pairCount; matchIndex += 1) {
      const team1 = entrants[matchIndex];
      const team2 = entrants[entrants.length - 1 - matchIndex];
      const isUpperFinal = entrants.length === 2;
      const winToken = isUpperFinal ? "UBW" : `U${upperRound + 1}M${matchIndex + 1}W`;
      if (team1 === "BYE") {
        nextEntrants.push(team2);
      } else if (team2 === "BYE") {
        nextEntrants.push(team1);
      } else {
        addMatch(result, teams, "upper", upperRound, matchIndex, team1, team2, seriesRules, ruleKey, { winToken });
        nextEntrants.push(winToken);
        roundLosers.push(winToken.replace(/W$/, "L"));
      }
    }
    upperLosers.push(roundLosers);
    entrants = nextEntrants;
    upperRound += 1;
  }

  let lowerEntrants = upperLosers[0] || [];
  let lowerRound = 0;
  for (let upperLoserRound = 1; upperLoserRound < upperLosers.length; upperLoserRound += 1) {
    if (lowerEntrants.length > 1) {
      lowerEntrants = pairEntrants(result, teams, lowerEntrants, "lower", lowerRound, seriesRules, "lower-all", "L");
      lowerRound += 1;
    }
    const incoming = upperLosers[upperLoserRound];
    if (incoming.length) {
      lowerEntrants = pairEntrants(result, teams, [...lowerEntrants, ...incoming], "lower", lowerRound, seriesRules, "lower-all", "L");
      lowerRound += 1;
    }
  }

  while (lowerEntrants.length > 1) {
    lowerEntrants = pairEntrants(result, teams, lowerEntrants, "lower", lowerRound, seriesRules, "lower-all", "L");
    lowerRound += 1;
  }

  addMatch(result, teams, "grand", 0, 0, "UBW", lowerEntrants[0] || "LBW", seriesRules, "grand-final", { winToken: "CHAMPION" });
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
  const playoffEntrants = Array.from({ length: Math.min(4, teams.length) }, (_, index) => `League #${index + 1}`);
  result.push(...generateSingleElimination(playoffEntrants, seriesRules, "playoffs", "playoff-"));
  return result;
}

function generateGsl(teams, seriesRules) {
  if (teams.length !== 8) {
    const midpoint = Math.ceil(teams.length / 2);
    const result = [];
    result.push(...generateRoundRobin(teams, seriesRules, "group-a", "groups-open", teams.slice(0, midpoint).map((_, index) => index), "A"));
    result.push(...generateRoundRobin(teams, seriesRules, "group-b", "groups-open", teams.slice(midpoint).map((_, index) => midpoint + index), "B"));
    result.push(...generateSingleElimination(["Group A #1", "Group B #2", "Group B #1", "Group A #2"], seriesRules, "playoffs", "playoff-"));
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
  });
  addMatch(result, teams, "playoffs", 0, 0, "GA1", "GB2", seriesRules, "playoffs", { winToken: "GSF1W" });
  addMatch(result, teams, "playoffs", 0, 1, "GB1", "GA2", seriesRules, "playoffs", { winToken: "GSF2W" });
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
  const playoffEntrants = Array.from({ length: Math.min(4, teams.length) }, (_, index) => `Swiss #${index + 1}`);
  result.push(...generateSingleElimination(playoffEntrants, seriesRules, "playoffs", "qualifier-"));
  return result;
}

function generateHybrid(teams, seriesRules) {
  if (teams.length !== 8) {
    const midpoint = Math.ceil(teams.length / 2);
    const result = [];
    result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", teams.slice(0, midpoint).map((_, index) => index), "A"));
    result.push(...generateRoundRobin(teams, seriesRules, "group-stage", "group-stage", teams.slice(midpoint).map((_, index) => midpoint + index), "B"));
    result.push(...generateSingleElimination(["Group A #1", "Group B #2", "Group B #1", "Group A #2"], seriesRules, "upper-playoff", "upper-playoff-"));
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
  const validationMessage = validateTeamCount(format, teams.length);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

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

export function getFormatTeamCountMessage(format, teamCount) {
  return validateTeamCount(format, teamCount);
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
