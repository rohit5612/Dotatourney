import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyProgression, reapplyAllProgression } from "./progressionEngine.js";

describe("progressionEngine", () => {
  it("applyProgression fills token slots on first result", () => {
    const qf = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Team Alpha",
      team2: "Team Beta",
      winner: "Team Alpha",
      status: "finished",
      meta: { winToken: "QFR1M1W" },
    };
    const sf = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Group A #1",
      team2: "QFR1M1W",
      winner: null,
      status: "upcoming",
      meta: { winToken: "SFR1M1W" },
    };
    const progressed = applyProgression([qf, sf], qf);
    assert.equal(progressed.find((m) => m.id === "sf1").team2, "Team Alpha");
  });

  it("reapplyAllProgression corrects downstream slots after winner change", () => {
    const qf = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Team Alpha",
      team2: "Team Beta",
      winner: "Team Beta",
      status: "finished",
      meta: { winToken: "QFR1M1W" },
    };
    const sf = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Group A #1",
      team2: "Team Alpha",
      winner: null,
      status: "upcoming",
      meta: { winToken: "SFR1M1W", team2Feed: "QFR1M1W" },
    };
    const finalMatch = {
      id: "final1",
      stageKey: "blast-playoffs",
      roundIndex: 2,
      matchIndex: 0,
      team1: "SFR1M1W",
      team2: "SFR1M2W",
      winner: null,
      status: "upcoming",
      meta: { winToken: "CHAMPION" },
    };

    const corrected = reapplyAllProgression([qf, sf, finalMatch]);
    assert.equal(corrected.find((m) => m.id === "sf1").team2, "Team Beta");
  });

  it("reapplyAllProgression infers blast feeds without stored feed meta", () => {
    const qf = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Team Alpha",
      team2: "Team Beta",
      winner: "Team Beta",
      status: "finished",
      meta: { winToken: "QFR1M1W" },
    };
    const sf = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Group A #1",
      team2: "Team Alpha",
      winner: null,
      status: "upcoming",
      meta: { winToken: "SFR1M1W" },
    };

    const corrected = reapplyAllProgression([qf, sf]);
    assert.equal(corrected.find((m) => m.id === "sf1").team2, "Team Beta");
  });

  it("reapplyAllProgression ignores unrelated group wins with the same team name", () => {
    const groupWin = {
      id: "ga1",
      stageKey: "blast-group-a",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Mortal Oath",
      team2: "Other Team",
      winner: "Mortal Oath",
      status: "finished",
      meta: { winToken: "GAR1M1W" },
    };
    const qf = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Emberfall",
      team2: "Mortal Oath",
      winner: "Emberfall",
      status: "finished",
      meta: { winToken: "QFR1M1W" },
    };
    const sf = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Arrise Corp",
      team2: "Mortal Oath",
      winner: null,
      status: "upcoming",
      meta: { winToken: "SFR1M1W" },
    };

    const corrected = reapplyAllProgression([groupWin, qf, sf]);
    assert.equal(corrected.find((m) => m.id === "sf1").team2, "Emberfall");
  });

  it("reapplyAllProgression works with legacy 1-based playoff round indices", () => {
    const qf0 = {
      id: "qf0",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "T1",
      team2: "T2",
      winner: "T1",
      status: "finished",
      meta: { winToken: "SFR1M1W" },
    };
    const qf1 = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 1,
      team1: "T3",
      team2: "T4",
      winner: "T4",
      status: "finished",
      meta: { winToken: "SFR1M2W" },
    };
    const sf = {
      id: "sf0",
      stageKey: "blast-playoffs",
      roundIndex: 2,
      matchIndex: 0,
      team1: "SFR1M1W",
      team2: "SFR1M2W",
      winner: null,
      status: "upcoming",
      meta: { winToken: "CHAMPION" },
    };

    const corrected = reapplyAllProgression([qf0, qf1, sf]);
    const nextSf = corrected.find((m) => m.id === "sf0");
    assert.equal(nextSf.team1, "T1");
    assert.equal(nextSf.team2, "T4");
  });

  it("reapplyAllProgression overrides stale team feed meta from wrong upstream", () => {
    const groupWin = {
      id: "ga1",
      stageKey: "blast-group-a",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Mortal Oath",
      team2: "Other Team",
      winner: "Mortal Oath",
      status: "finished",
      meta: { winToken: "GAR1M1W" },
    };
    const qf = {
      id: "qf1",
      stageKey: "blast-playoffs",
      roundIndex: 0,
      matchIndex: 0,
      team1: "Emberfall",
      team2: "Mortal Oath",
      winner: "Emberfall",
      status: "finished",
      meta: { winToken: "QFR1M1W" },
    };
    const sf = {
      id: "sf1",
      stageKey: "blast-playoffs",
      roundIndex: 1,
      matchIndex: 0,
      team1: "Arrise Corp",
      team2: "Mortal Oath",
      winner: null,
      status: "upcoming",
      meta: { winToken: "SFR1M1W", team2Feed: "GAR1M1W" },
    };

    const corrected = reapplyAllProgression([groupWin, qf, sf]);
    const nextSf = corrected.find((m) => m.id === "sf1");
    assert.equal(nextSf.team2, "Emberfall");
    assert.equal(nextSf.meta.team2Feed, "QFR1M1W");
  });
});
