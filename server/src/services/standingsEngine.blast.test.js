import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareBlastGroupTiebreak,
  headToHeadNet,
  miniLeagueWins,
  neustadtlScore,
} from "./blastStandings.js";
import { buildGroupedStandings, buildStandings, blastBracketUsesGroupRanksOnly } from "./standingsEngine.js";

function blastGroupMatch(team1, team2, winner, groupKey = "A") {
  return {
    team1,
    team2,
    winner,
    stageKey: groupKey === "A" ? "blast-group-a" : "blast-group-b",
    meta: { groupKey },
  };
}

/** Six-team BO1 group from production screenshot (four teams 3–2). */
function sixTeamFourWayTieMatches() {
  return [
    blastGroupMatch("Arrise Corp", "Invictus", "Arrise Corp"),
    blastGroupMatch("Arrise Corp", "Chaos Rift", "Arrise Corp"),
    blastGroupMatch("Arrise Corp", "Crimson Veil", "Crimson Veil"),
    blastGroupMatch("Arrise Corp", "Ashborn", "Arrise Corp"),
    blastGroupMatch("Arrise Corp", "Phantom Division", "Phantom Division"),
    blastGroupMatch("Phantom Division", "Chaos Rift", "Phantom Division"),
    blastGroupMatch("Invictus", "Crimson Veil", "Invictus"),
    blastGroupMatch("Chaos Rift", "Ashborn", "Chaos Rift"),
    blastGroupMatch("Crimson Veil", "Phantom Division", "Phantom Division"),
    blastGroupMatch("Ashborn", "Invictus", "Ashborn"),
    blastGroupMatch("Ashborn", "Crimson Veil", "Ashborn"),
    blastGroupMatch("Phantom Division", "Ashborn", "Ashborn"),
    blastGroupMatch("Invictus", "Phantom Division", "Invictus"),
    blastGroupMatch("Chaos Rift", "Invictus", "Invictus"),
    blastGroupMatch("Crimson Veil", "Chaos Rift", "Crimson Veil"),
  ];
}

const sixTeamNames = [
  "Arrise Corp",
  "Invictus",
  "Chaos Rift",
  "Crimson Veil",
  "Ashborn",
  "Phantom Division",
];

describe("BLAST group tiebreakers (wins → mini-league H2H → direct H2H → Neustadtl)", () => {
  it("resolves four-way 3–2 tie: Arrise #1, Ashborn #2 (mini-league then direct H2H)", () => {
    const teams = sixTeamNames.map((name) => ({ name }));
    const matches = sixTeamFourWayTieMatches();
    const rows = buildStandings(teams, matches, "blast", { blastGroupStandings: true });

    assert.deepEqual(
      rows.map((r) => r.team),
      [
        "Arrise Corp",
        "Ashborn",
        "Invictus",
        "Phantom Division",
        "Crimson Veil",
        "Chaos Rift",
      ],
    );
    assert.equal(rows[0].status, "advancing");
    assert.equal(rows[1].status, "play_in_cross");
    assert.equal(rows[0].wins, 3);
    assert.equal(rows[1].wins, 3);

    const tied = ["Arrise Corp", "Invictus", "Ashborn", "Phantom Division"];
    assert.equal(miniLeagueWins("Arrise Corp", tied, matches), 2);
    assert.equal(miniLeagueWins("Ashborn", tied, matches), 2);
    assert.equal(miniLeagueWins("Invictus", tied, matches), 1);
    assert.equal(miniLeagueWins("Phantom Division", tied, matches), 1);
    assert.equal(headToHeadNet("Arrise Corp", "Ashborn", matches), -1);
    assert.equal(headToHeadNet("Invictus", "Phantom Division", matches), -1);
  });

  it("computes Neustadtl as sum of opponents' total group wins for each win", () => {
    const matches = sixTeamFourWayTieMatches();
    const winsByTeam = {
      "Arrise Corp": 3,
      Invictus: 3,
      "Chaos Rift": 1,
      "Crimson Veil": 2,
      Ashborn: 3,
      "Phantom Division": 3,
    };
    assert.equal(neustadtlScore("Ashborn", matches, winsByTeam), 8);
    assert.equal(neustadtlScore("Arrise Corp", matches, winsByTeam), 7);
    assert.equal(neustadtlScore("Invictus", matches, winsByTeam), 6);
    assert.equal(neustadtlScore("Phantom Division", matches, winsByTeam), 6);
  });

  it("ranks Arrise above Ashborn on direct H2H when mini-league is tied (not Neustadtl alone)", () => {
    const matches = sixTeamFourWayTieMatches();
    const entries = sixTeamNames.map((team) => ({
      team,
      wins: 3,
      neustadtl: team === "Ashborn" ? 8 : team === "Arrise Corp" ? 7 : 6,
    }));
    const ar = entries.find((e) => e.team === "Arrise Corp");
    const ab = entries.find((e) => e.team === "Ashborn");
    assert.equal(compareBlastGroupTiebreak(ar, ab, entries, matches), -1);
    assert.equal(compareBlastGroupTiebreak(ab, ar, entries, matches), 1);
  });

  it("exposes grouped standings via buildGroupedStandings without touching match data", () => {
    const teams = sixTeamNames.map((name) => ({ name }));
    const grouped = buildGroupedStandings(teams, sixTeamFourWayTieMatches(), "blast");
    const gA = grouped.find((g) => g.label === "Group A");
    assert.ok(gA);
    assert.equal(gA.rows[0].team, "Arrise Corp");
    assert.equal(gA.rows[1].team, "Ashborn");
  });

  it("n=12 uses group-rank bracket path — no merged global standings row set", () => {
    assert.equal(blastBracketUsesGroupRanksOnly(12), true);
    assert.equal(blastBracketUsesGroupRanksOnly(10), true);
    assert.equal(blastBracketUsesGroupRanksOnly(14), false);
  });
});
