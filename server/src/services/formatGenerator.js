import { randomUUID } from "node:crypto";

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

export function generateMatches(format, teams) {
  const result = [];

  if (format === "se") {
    result.push(match(teamAt(teams, 0), teamAt(teams, 7), "bracket", 0, 0, { winToken: "QF1W" }));
    result.push(match(teamAt(teams, 3), teamAt(teams, 4), "bracket", 0, 1, { winToken: "QF2W" }));
    result.push(match(teamAt(teams, 1), teamAt(teams, 6), "bracket", 0, 2, { winToken: "QF3W" }));
    result.push(match(teamAt(teams, 2), teamAt(teams, 5), "bracket", 0, 3, { winToken: "QF4W" }));
    result.push(match("QF1W", "QF2W", "bracket", 1, 0, { winToken: "SF1W" }));
    result.push(match("QF3W", "QF4W", "bracket", 1, 1, { winToken: "SF2W" }));
    result.push(match("SF1W", "SF2W", "bracket", 2, 0, { winToken: "CHAMPION" }));
    return result;
  }

  if (format === "rr") {
    const pairs = [
      [[0, 1], [2, 3], [4, 5], [6, 7]],
      [[0, 2], [1, 3], [4, 6], [5, 7]],
      [[0, 4], [1, 5], [2, 6], [3, 7]],
      [[0, 6], [1, 7], [3, 5], [2, 4]],
      [[0, 5], [1, 4], [2, 7], [3, 6]],
      [[0, 3], [1, 2], [5, 6], [4, 7]],
      [[0, 7], [1, 6], [2, 5], [3, 4]],
    ];
    pairs.forEach((round, roundIndex) => {
      round.forEach((pair, matchIndex) => {
        result.push(
          match(teamAt(teams, pair[0]), teamAt(teams, pair[1]), "rr", roundIndex, matchIndex, {}),
        );
      });
    });
    return result;
  }

  // Shared bracket layout used for dse, hybrid, gsl, swiss fallback.
  const mappings = {
    dse: [
      ["upper", teamAt(teams, 0), teamAt(teams, 7), 0, 0, "UQF1W"],
      ["upper", teamAt(teams, 3), teamAt(teams, 4), 0, 1, "UQF2W"],
      ["upper", teamAt(teams, 1), teamAt(teams, 6), 1, 0, "UQF3W"],
      ["upper", teamAt(teams, 2), teamAt(teams, 5), 1, 1, "UQF4W"],
      ["upper", "UQF1W", "UQF2W", 2, 0, "USF1W"],
      ["upper", "UQF3W", "UQF4W", 2, 1, "USF2W"],
      ["upper", "USF1W", "USF2W", 3, 0, "UBW"],
      ["lower", "UQF1L", "UQF2L", 0, 0, "LR1W1"],
      ["lower", "UQF3L", "UQF4L", 0, 1, "LR1W2"],
      ["lower", "LR1W1", "USF1L", 1, 0, "LR2W1"],
      ["lower", "LR1W2", "USF2L", 1, 1, "LR2W2"],
      ["lower", "LR2W1", "LR2W2", 2, 0, "LR3W"],
      ["lower", "LR3W", "UBL", 3, 0, "LBW"],
      ["grand", "UBW", "LBW", 0, 0, "CHAMPION"],
    ],
  };

  const key = format === "hybrid" ? "dse" : format;
  const selected = mappings[key] || mappings.dse;

  selected.forEach(([stageKey, team1, team2, roundIndex, matchIndex, winToken]) => {
    result.push(
      match(team1, team2, stageKey, Number(roundIndex), Number(matchIndex), {
        winToken,
      }),
    );
  });

  return result;
}

export function stageTabsForFormat(format) {
  const map = {
    dse: [
      { id: "upper", label: "Upper bracket" },
      { id: "lower", label: "Lower bracket" },
      { id: "grand", label: "Grand final" },
    ],
    hybrid: [
      { id: "upper", label: "Upper bracket" },
      { id: "lower", label: "Lower bracket" },
      { id: "grand", label: "Grand final" },
    ],
    se: [{ id: "bracket", label: "Bracket" }],
    rr: [{ id: "rr", label: "Round robin" }],
    gsl: [
      { id: "upper", label: "Group stage" },
      { id: "grand", label: "Playoffs" },
    ],
    swiss: [{ id: "upper", label: "Swiss rounds" }],
  };
  return map[format] || map.dse;
}
