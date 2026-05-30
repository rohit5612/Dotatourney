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
});
