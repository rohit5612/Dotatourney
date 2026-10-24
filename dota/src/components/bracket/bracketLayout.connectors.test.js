import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eliminationFeederEdges } from "./bracketLayout.js";

describe("blast-playoffs connector edges", () => {
  it("uses paired lanes (QF i → SF i) instead of converging bracket merge", () => {
    const qf0 = {
      id: "qf0",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "A",
      team2: "B",
      meta: { winToken: "QFR1M1W" },
    };
    const qf1 = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 1,
      team1: "C",
      team2: "D",
      meta: { winToken: "QFR1M2W" },
    };
    const sf0 = {
      id: "sf0",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Group A #1",
      team2: "QFR1M1W",
      meta: { winToken: "SFR1M1W", team2Feed: "QFR1M1W" },
    };
    const sf1 = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 1,
      team1: "Group B #1",
      team2: "QFR1M2W",
      meta: { winToken: "SFR1M2W", team2Feed: "QFR1M2W" },
    };
    const fin = {
      id: "fin",
      stageKey: "blast-playoffs",
      roundIndex: 2,
      matchIndex: 0,
      team1: "SFR1M1W",
      team2: "SFR1M2W",
      meta: { winToken: "CHAMPION", team1Feed: "SFR1M1W", team2Feed: "SFR1M2W" },
    };

    const pairs = [
      ["blast-playoffs:0", [qf0, qf1]],
      ["blast-playoffs:1", [sf0, sf1]],
      ["blast-playoffs:2", [fin]],
    ];
    const edges = eliminationFeederEdges(pairs);
    const has = (from, to) => edges.some((e) => e.fromId === from && e.toId === to);

    assert.ok(has("qf0", "sf0"), "QF1 feeds SF1");
    assert.ok(has("qf1", "sf1"), "QF2 feeds SF2");
    assert.equal(has("qf1", "sf0"), false, "QF2 must not feed SF1");
    assert.equal(has("qf0", "sf1"), false, "QF1 must not feed SF2");
    assert.ok(has("sf0", "fin"), "SF1 feeds final slot 1");
    assert.ok(has("sf1", "fin"), "SF2 feeds final slot 2");
  });
});
