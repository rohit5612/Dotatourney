import { randomUUID } from "node:crypto";
import { resolveSeries } from "./seriesRulesEngine.js";

export const formatTeamGuidance = {
  se: { min: 2, recommended: "4, 8, 16, 32", odd: "Supported with byes" },
  dse: { min: 4, recommended: "4, 8, 16", odd: "Supported with upper-bracket byes" },
  rr: { min: 3, recommended: "4-10", odd: "Supported with round byes" },
  gsl: { min: 4, recommended: "8 or 16", odd: "Supported with uneven groups" },
  swiss: { min: 4, recommended: "8, 16, 32", odd: "Supported with round byes" },
  hybrid: { min: 4, recommended: "8 or 16", odd: "Supported with uneven groups" },
  /** BLAST: two BO1 groups → Last chance → Play-In → main playoffs. Side-bracket depth scales with total teams (minimum 10). */
  blast: {
    min: 10,
    recommended: "10+ (scales to large events)",
    odd: "Odd totals split ⌈n/2⌉ / ⌊n/2⌋ into two BO1 groups. Last chance and Play-In round counts follow bracket generation for that entry count.",
  },
};

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
  const slotMeta = { ...meta, seriesRuleKey, seriesType: resolveSeries(seriesRules, seriesRuleKey) };
  if (typeof team1 === "string" && /^Group [AB] #\d+$/.test(team1)) slotMeta.blastSlot1 = team1;
  if (typeof team2 === "string" && /^Group [AB] #\d+$/.test(team2)) slotMeta.blastSlot2 = team2;
  result.push(match(team1, team2, stageKey, roundIndex, matchIndex, slotMeta));
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

function generateEliminationUntilSurvivors(teamNames, teams, seriesRules, stageKey, rulePrefix, tokenPrefix, survivorCount) {
  const result = [];
  const bracketSize = nextPowerOfTwo(Math.max(teamNames.length, survivorCount));
  let entrants = Array.from({ length: bracketSize }, (_, index) => (index < teamNames.length ? teamNames[index] : "BYE"));
  let roundIndex = 0;

  while (entrants.length > survivorCount) {
    const ruleKey = roundRuleKey(entrants.length, rulePrefix, "quarterfinal");
    entrants = pairEntrants(result, teams, entrants, stageKey, roundIndex, seriesRules, ruleKey, tokenPrefix);
    roundIndex += 1;
  }

  return { matches: result, survivorTokens: entrants };
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

function generateSingleElimination(teams, seriesRules, stageKey = "bracket", rulePrefix = "", tokenPrefix = "R") {
  const result = [];
  const bracketSize = nextPowerOfTwo(Math.max(2, teams.length));
  let entrants = Array.from({ length: bracketSize }, (_, index) => (index < teams.length ? teamAt(teams, index) : "BYE"));
  let roundIndex = 0;

  while (entrants.length > 1) {
    const ruleKey = roundRuleKey(entrants.length, rulePrefix, "quarterfinal");
    entrants = pairEntrants(result, teams, entrants, stageKey, roundIndex, seriesRules, ruleKey, tokenPrefix);
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

/**
 * BLAST sizing:
 * - n=10: group 1sts/2nds reserved for main path; remainder → BPI slice + LC (legacy path).
 * - n≥11: merged global standings — #1–#2 semifinal seeds, #9+ style bottom band → LC, middle → knockout,
 *   #3–#4 vs LC survivors → QF fills with middle survivors until 4 title-bracket entrants.
 * @param {number} teamCount
 */
export function getBlastPhaseSizes(teamCount) {
  const n = Math.max(0, Number(teamCount) || 0);
  if (n < 10) return null;
  const lcEntrants = Math.max(4, n - 8);

  if (n === 10) {
    const sidePoolExcluded = 4;
    const remainder = n - sidePoolExcluded;
    const playInFromGroups = remainder - lcEntrants;
    if (playInFromGroups < 0) return null;
    return {
      n,
      sidePoolExcluded,
      remainder,
      lcEntrants,
      playInFromGroups,
      middleBracketEntrants: null,
      playInBracketSize: 4,
      lcAdvanceToPlayIn: 2,
      piSurvivorsToMain: 2,
      mainPlayoffPath: "ten_qf_seconds",
    };
  }

  const middleBracketEntrants = n - 4 - lcEntrants;
  if (middleBracketEntrants < 1) return null;

  return {
    n,
    sidePoolExcluded: null,
    remainder: null,
    lcEntrants,
    playInFromGroups: null,
    middleBracketEntrants,
    playInBracketSize: null,
    lcAdvanceToPlayIn: 2,
    piSurvivorsToMain: 4,
    /** @type {"tiered_merged_standings"} */
    mainPlayoffPath: "tiered_merged_standings",
  };
}

/**
 * @deprecated Prefer getBlastPhaseSizes. Kept for callers that expect { playin, lc }:
 * playin = middle Play-In entrants (n≥11) or BPI count (n=10); lc = Last chance field size.
 */
export function blastSideBracketSizes(teamCount) {
  const s = getBlastPhaseSizes(teamCount);
  if (!s) return { playin: 0, lc: 0 };
  const pin = s.middleBracketEntrants ?? s.playInFromGroups ?? 0;
  return { playin: pin, lc: s.lcEntrants };
}

/**
 * BLAST-style slam: two BO1 groups → qualifiers → playoffs.
 *
 * - **n=10**: Group **A/B #1** wait in semis; **#2** in QFs vs Play-In winners; **#3** + Last chance survivors in the 4-team Play-In;
 *   **#4–#5** in each group start Last chance.
 * - **n=12**: **#1** wait in semifinals; **#3/#4** meet in a middle knockout (A3↔B4, B3↔A4); **#2** faces a Last chance finalist in crossover; **#5/#6** start Last chance. Four playoff quarterfinalists emerge from middle + crossover survivors, then cross-seeded semis vs #1s.
 */
function generateBlast(teams, seriesRules, options = {}) {
  const n = teams.length;
  const sizes = getBlastPhaseSizes(n);
  if (!sizes) {
    throw new Error(validateTeamCount("blast", n) || "Invalid BLAST team count");
  }

  let idxA;
  let idxB;
  if (options.groupIndices) {
    idxA = options.groupIndices.idxA;
    idxB = options.groupIndices.idxB;
  } else {
    const mid = Math.ceil(n / 2);
    idxA = Array.from({ length: mid }, (_, i) => i);
    idxB = Array.from({ length: n - mid }, (_, i) => mid + i);
  }
  const result = [];
  result.push(...generateRoundRobin(teams, seriesRules, "blast-group-a", "blast-group-bo1", idxA, "A"));
  result.push(...generateRoundRobin(teams, seriesRules, "blast-group-b", "blast-group-bo1", idxB, "B"));

  /** Win-token prefixes: Last chance `LCR1M1W`; Play-In `PIR1M1W`; playoffs `QFR` / `SFR`. */
  const lcTok = "LCR";
  const piTok = "PIR";

  let lcSeeds;
  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    lcSeeds = ["Group A #4", "Group A #5", "Group B #4", "Group B #5"];
  } else if (sizes.mainPlayoffPath === "tiered_merged_standings" && n === 12) {
    lcSeeds = ["Group A #5", "Group A #6", "Group B #5", "Group B #6"];
  } else {
    lcSeeds = Array.from({ length: sizes.lcEntrants }, (_, i) => `BLC${i + 1}`);
  }

  const lcBlock = generateEliminationUntilSurvivors(
    lcSeeds,
    teams,
    seriesRules,
    "blast-lastchance",
    "blast-lc-",
    lcTok,
    sizes.lcAdvanceToPlayIn,
  );
  result.push(...lcBlock.matches);

  if (sizes.mainPlayoffPath === "ten_qf_seconds") {
    const piFour = ["Group A #3", "Group B #3", ...lcBlock.survivorTokens];
    if (piFour.length !== 4) {
      throw new Error(`BLAST n=10 expects 4 Play-In entrants, got ${piFour.length}`);
    }
    const playIn4Key = roundRuleKey(4, "blast-playin-", "quarterfinal");
    pairEntrants(result, teams, piFour, "blast-playin", 0, seriesRules, playIn4Key, piTok);

    addMatch(result, teams, "blast-playoffs", 0, 0, "Group A #2", "PIR1M1W", seriesRules, "blast-po-quarterfinal", {
      winToken: "QFR1M1W",
      team2Feed: "PIR1M1W",
    });
    addMatch(result, teams, "blast-playoffs", 0, 1, "Group B #2", "PIR1M2W", seriesRules, "blast-po-quarterfinal", {
      winToken: "QFR1M2W",
      team2Feed: "PIR1M2W",
    });
    addMatch(result, teams, "blast-playoffs", 1, 0, "Group A #1", "QFR1M1W", seriesRules, "blast-po-semifinal", {
      winToken: "SFR1M1W",
      team2Feed: "QFR1M1W",
    });
    addMatch(result, teams, "blast-playoffs", 1, 1, "Group B #1", "QFR1M2W", seriesRules, "blast-po-semifinal", {
      winToken: "SFR1M2W",
      team2Feed: "QFR1M2W",
    });
    addMatch(result, teams, "blast-playoffs", 2, 0, "SFR1M1W", "SFR1M2W", seriesRules, "blast-po-final", {
      winToken: "CHAMPION",
      team1Feed: "SFR1M1W",
      team2Feed: "SFR1M2W",
    });
  } else if (sizes.mainPlayoffPath === "tiered_merged_standings") {
    const middleCount = sizes.middleBracketEntrants ?? 0;
    if (middleCount < 1) {
      throw new Error(`BLAST tiered expects middleBracketEntrants >= 1, got ${middleCount}`);
    }
    const midSeeds =
      n === 12
        ? ["Group A #3", "Group B #3", "Group A #4", "Group B #4"]
        : Array.from({ length: middleCount }, (_, i) => `MID${i + 1}`);
    const mpBlock = generateEliminationUntilSurvivors(
      midSeeds,
      teams,
      seriesRules,
      "blast-playin",
      "blast-mp-",
      piTok,
      2,
    );
    result.push(...mpBlock.matches);
    let maxMpRi = -1;
    for (const m of mpBlock.matches) {
      const ri = m.roundIndex ?? 0;
      if (ri > maxMpRi) maxMpRi = ri;
    }
    const crossRoundIndex = maxMpRi >= 0 ? maxMpRi + 1 : 0;
    const crossRi = crossRoundIndex + 1;
    const [lcWin1, lcWin2] = lcBlock.survivorTokens;
    const crossLeft = n === 12 ? "Group A #2" : "BLR3";
    const crossRight = n === 12 ? "Group B #2" : "BLR4";
    addMatch(result, teams, "blast-playin", crossRoundIndex, 0, crossLeft, lcWin1, seriesRules, "blast-playin-cross", {
      winToken: `PIR${crossRi}M1W`,
    });
    addMatch(result, teams, "blast-playin", crossRoundIndex, 1, crossRight, lcWin2, seriesRules, "blast-playin-cross", {
      winToken: `PIR${crossRi}M2W`,
    });

    const [mw1, mw2] = mpBlock.survivorTokens;
    const px1 = `PIR${crossRi}M1W`;
    const px2 = `PIR${crossRi}M2W`;
    // Cross seeds: crossover (#2 vs LC finalists) feeds opposite middle-band (#3/#4) survivors — avoids parallel 1–1 / 2–2 lanes.
    addMatch(result, teams, "blast-playoffs", 0, 0, mw1, px2, seriesRules, "blast-po-quarterfinal", {
      winToken: "QFR1M1W",
      team2Feed: px2,
    });
    addMatch(result, teams, "blast-playoffs", 0, 1, mw2, px1, seriesRules, "blast-po-quarterfinal", {
      winToken: "QFR1M2W",
      team2Feed: px1,
    });
    const waitSF1 = n === 12 ? "Group A #1" : "BLR1";
    const waitSF2 = n === 12 ? "Group B #1" : "BLR2";
    addMatch(result, teams, "blast-playoffs", 1, 0, waitSF1, "QFR1M1W", seriesRules, "blast-po-semifinal", {
      winToken: "SFR1M1W",
      team2Feed: "QFR1M1W",
    });
    addMatch(result, teams, "blast-playoffs", 1, 1, waitSF2, "QFR1M2W", seriesRules, "blast-po-semifinal", {
      winToken: "SFR1M2W",
      team2Feed: "QFR1M2W",
    });
    addMatch(result, teams, "blast-playoffs", 2, 0, "SFR1M1W", "SFR1M2W", seriesRules, "blast-po-final", {
      winToken: "CHAMPION",
      team1Feed: "SFR1M1W",
      team2Feed: "SFR1M2W",
    });
  }

  return result;
}

export function generateMatches(format, teams, seriesRules = {}, options = {}) {
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
  if (format === "blast") return generateBlast(teams, seriesRules, options);
  return generateDse(teams, seriesRules);
}

export function getFormatTeamCountMessage(format, teamCount) {
  return validateTeamCount(format, teamCount);
}

export function stageTabsForFormat(format, options = {}) {
  const teamCount = options.teamCount;
  if (format === "blast") {
    const n = typeof teamCount === "number" && Number.isFinite(teamCount) ? teamCount : 12;
    const sizes = getBlastPhaseSizes(n);
    const tabs = [
      { id: "blast-group-a", label: "Group A (BO1)" },
      { id: "blast-group-b", label: "Group B (BO1)" },
    ];
    if (sizes) {
      tabs.push({ id: "blast-qualifiers", label: "Last Chance & Play-In" });
    }
    tabs.push({ id: "blast-playoffs", label: "Playoffs" });
    return tabs;
  }

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
