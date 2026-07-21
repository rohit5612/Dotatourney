import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileEngineStageMatches } from "./engineStageSeeding.js";
import { decorateMatchesForClient } from "./playoffRoundUtils.js";

describe("playoff round normalization", () => {
  it("decorateMatchesForClient rewrites feeder slot placeholders for legacy tokens", () => {
    const matches = [
      {
        id: "qf0",
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 0,
        team1: "T1",
        team2: "T2",
        meta: { winToken: "SFR1M1W" },
      },
      {
        id: "qf1",
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 1,
        team1: "T3",
        team2: "T4",
        meta: { winToken: "SFR1M2W" },
      },
      {
        id: "sf0",
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "SFR1M1W",
        team2: "SFR1M2W",
        meta: { winToken: "CHAMPION" },
      },
      {
        id: "sf1",
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 1,
        team1: "SFR1M3W",
        team2: "SFR1M4W",
        meta: { winToken: "CHAMPION" },
      },
      {
        id: "fin",
        stageKey: "blast-playoffs",
        roundIndex: 3,
        matchIndex: 0,
        team1: "CHAMPION",
        team2: "CHAMPION",
        meta: { winToken: "CHAMPION" },
      },
    ];
    const decorated = decorateMatchesForClient(matches);
    const sf = decorated.find((m) => m.id === "sf0");
    const fin = decorated.find((m) => m.id === "fin");
    assert.equal(sf?.meta?.presentationTeam1, "QFR1M1W");
    assert.equal(sf?.meta?.presentationTeam2, "QFR1M2W");
    assert.equal(sf?.meta?.presentationWinToken, "SFR1M1W");
    assert.equal(fin?.meta?.presentationTeam1, "SFR1M1W");
    assert.equal(fin?.meta?.presentationTeam2, "SFR1M2W");
    assert.equal(sf?.team1, "SFR1M1W");
    assert.equal(fin?.team1, "CHAMPION");
  });

  it("decorateMatchesForClient adds presentation tokens for legacy 1-based playoff rounds", () => {
    const matches = [
      {
        id: "qf1",
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 0,
        team1: "A",
        team2: "B",
        meta: { winToken: "SFR1M1W", seriesRuleKey: "blast-po-semifinal" },
      },
      {
        id: "sf1",
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "SFR1M1W",
        team2: "SFR1M2W",
        meta: { winToken: "CHAMPION", seriesRuleKey: "blast-po-final" },
      },
    ];
    const [qf] = decorateMatchesForClient(matches);
    assert.equal(qf.meta.presentationWinToken, "QFR1M1W");
    assert.equal(qf.meta.presentationSeriesRuleKey, "blast-po-quarterfinal");
    assert.equal(qf.meta.winToken, "SFR1M1W");
  });

  it("compiles 1-based playoff rounds with QFR tokens on the first elimination round", () => {
    /** @type {object[]} */
    const compiled = [];
    const engineConfig = {
      format: "blast",
      teamCount: 16,
      groupStage: { enabled: true, groupCount: 4, groupSizes: [4, 4, 4, 4] },
      stages: [
        { key: "groups", type: "group_round_robin" },
        { key: "play_in", type: "crossover", matches: [] },
        {
          key: "playoffs",
          type: "single_elimination",
          matches: [
            {
              matchKey: "m0",
              label: "Quarterfinal 1",
              roundIndex: 1,
              elimination: true,
              slots: [
                { side: 1, source: "winner:play_in:0" },
                { side: 2, source: "group:A:1" },
              ],
            },
            {
              matchKey: "m1",
              label: "Semifinal 1",
              roundIndex: 2,
              elimination: true,
              slots: [
                { side: 1, source: "winner:playoffs:0" },
                { side: 2, source: "winner:playoffs:1" },
              ],
            },
            {
              matchKey: "m2",
              label: "Finals",
              roundIndex: 3,
              elimination: true,
              slots: [
                { side: 1, source: "winner:playoffs:1" },
                { side: 2, source: "winner:playoffs:2" },
              ],
            },
          ],
        },
      ],
    };

    compileEngineStageMatches(engineConfig, (team1, team2, stageKey, roundIndex, matchIndex, seriesRuleKey, meta) => {
      compiled.push({ team1, team2, stageKey, roundIndex, matchIndex, seriesRuleKey, meta });
    });

    const qf = compiled.find((row) => row.roundIndex === 0 && row.matchIndex === 0);
    const sf = compiled.find((row) => row.roundIndex === 1);
    const fin = compiled.find((row) => row.roundIndex === 2);
    assert.equal(qf?.meta?.winToken, "QFR1M1W");
    assert.equal(qf?.seriesRuleKey, "blast-po-quarterfinal");
    assert.equal(sf?.meta?.winToken?.startsWith("SFR"), true);
    assert.equal(sf?.seriesRuleKey, "blast-po-semifinal");
    assert.equal(fin?.meta?.winToken, "CHAMPION");
    assert.equal(fin?.seriesRuleKey, "blast-po-final");
  });
});
