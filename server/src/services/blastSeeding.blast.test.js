import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMatches } from "./formatGenerator.js";
import { applyBlastGroupSeeding, computeBlastPlaceholderToTeamMap } from "./blastSeeding.js";
import { buildGroupedStandings, blastGroupLabelFromMatch } from "./standingsEngine.js";

function teamList(n) {
  return Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `T${i + 1}` }));
}

/** Finish group BO1 with a fixed strength order (lower index = better rank). */
function finishGroupsWithOrder(matches, orderA, orderB) {
  return matches.map((m) => {
    if (m.stageKey === "blast-group-a") {
      const i1 = orderA.indexOf(m.team1);
      const i2 = orderA.indexOf(m.team2);
      if (i1 === -1 || i2 === -1) return m;
      return { ...m, winner: i1 < i2 ? m.team1 : m.team2, status: "finished" };
    }
    if (m.stageKey === "blast-group-b") {
      const i1 = orderB.indexOf(m.team1);
      const i2 = orderB.indexOf(m.team2);
      if (i1 === -1 || i2 === -1) return m;
      return { ...m, winner: i1 < i2 ? m.team1 : m.team2, status: "finished" };
    }
    return m;
  });
}

function round0Pairings(matches, stageKey, seriesRuleKey = null) {
  return matches
    .filter(
      (m) =>
        m.stageKey === stageKey &&
        m.roundIndex === 0 &&
        (seriesRuleKey == null || m.meta?.seriesRuleKey === seriesRuleKey),
    )
    .sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0))
    .map((m) => [m.team1, m.team2]);
}

describe("BLAST n=12 qualifier & semifinal seeding paths", () => {
  it("generates cross-group Last chance (#5/#6), middle Play-In (#3/#4), crossover (#2 vs LC), semis (#1 wait)", () => {
    const teams = teamList(12);
    const matches = generateMatches(
      "blast",
      teams.map((t) => t.name),
      {},
    );

    assert.deepEqual(round0Pairings(matches, "blast-lastchance"), [
      ["Group A #5", "Group B #6"],
      ["Group A #6", "Group B #5"],
    ]);
    assert.deepEqual(round0Pairings(matches, "blast-playin", "blast-mp-semifinal"), [
      ["Group A #3", "Group B #4"],
      ["Group B #3", "Group A #4"],
    ]);

    const cross = matches.filter((m) => m.meta?.seriesRuleKey === "blast-playin-cross");
    assert.deepEqual(
      cross.map((m) => [m.team1, m.team2]),
      [
        ["Group A #2", "LCR1M1W"],
        ["Group B #2", "LCR1M2W"],
      ],
    );

    const sf = matches.filter((m) => m.stageKey === "blast-playoffs" && m.roundIndex === 1);
    assert.deepEqual(
      sf.map((m) => [m.team1, m.team2]),
      [
        ["Group A #1", "QFR1M1W"],
        ["Group B #1", "QFR1M2W"],
      ],
    );
  });

  it("seeds all qualifier and semifinal slots from group standings (no bracket regen)", () => {
    const groupAOrder = [
      "Arrise Corp",
      "Ashborn",
      "Invictus",
      "Phantom Division",
      "Crimson Veil",
      "Chaos Rift",
    ];
    const groupBOrder = ["T7", "T8", "T9", "T10", "T11", "T12"];
    const teams = [
      ...groupAOrder.map((name) => ({ name })),
      ...groupBOrder.map((name) => ({ name })),
    ];

    const raw = generateMatches(
      "blast",
      teams.map((t) => t.name),
      {},
    );
    const finished = finishGroupsWithOrder(raw, groupAOrder, groupBOrder);
    assert.ok(computeBlastPlaceholderToTeamMap(teams, finished));

    const { matches: seeded } = applyBlastGroupSeeding(teams, finished);

    assert.deepEqual(round0Pairings(seeded, "blast-lastchance"), [
      ["Crimson Veil", "T12"],
      ["Chaos Rift", "T11"],
    ]);
    assert.deepEqual(round0Pairings(seeded, "blast-playin", "blast-mp-semifinal"), [
      ["Invictus", "T10"],
      ["T9", "Phantom Division"],
    ]);

    const cross = seeded.filter((m) => m.meta?.seriesRuleKey === "blast-playin-cross");
    assert.equal(cross[0].team1, "Ashborn");
    assert.equal(cross[1].team1, "T8");
    assert.ok(cross.every((m) => String(m.team2).startsWith("LCR")));

    const sf = seeded.filter((m) => m.stageKey === "blast-playoffs" && m.roundIndex === 1);
    assert.equal(sf[0].team1, "Arrise Corp");
    assert.equal(sf[1].team1, "T7");
    assert.ok(sf.every((m) => String(m.team2).startsWith("QFR")));

    const placeholder = /^Group [AB] #\d+$/;
    for (const m of seeded) {
      if (m.stageKey === "blast-lastchance" || m.stageKey === "blast-playin" || m.stageKey === "blast-playoffs") {
        assert.ok(!placeholder.test(m.team1), `team1 still placeholder: ${m.team1}`);
        assert.ok(!placeholder.test(m.team2), `team2 still placeholder: ${m.team2}`);
      }
    }
  });

  it("re-syncs wrong persisted seeds (Ashborn in SF → Arrise SF, Ashborn crossover only)", () => {
    const groupAOrder = [
      "Arrise Corp",
      "Ashborn",
      "Invictus",
      "Phantom Division",
      "Crimson Veil",
      "Chaos Rift",
    ];
    const groupBOrder = ["T7", "T8", "T9", "T10", "T11", "T12"];
    const teams = [
      ...groupAOrder.map((name) => ({ name })),
      ...groupBOrder.map((name) => ({ name })),
    ];

    const raw = generateMatches("blast", teams.map((t) => t.name), {});
    const finished = finishGroupsWithOrder(raw, groupAOrder, groupBOrder);

    const wronglySeeded = finished.map((m) => {
      if (m.stageKey === "blast-playoffs" && m.roundIndex === 1 && m.matchIndex === 0) {
        return { ...m, team1: "Ashborn", team2: m.team2 };
      }
      if (m.meta?.seriesRuleKey === "blast-playin-cross" && m.matchIndex === 0) {
        return { ...m, team1: "Arrise Corp", team2: m.team2 };
      }
      return m;
    });

    const { matches: fixed } = applyBlastGroupSeeding(teams, wronglySeeded);
    const sf = fixed.find((m) => m.stageKey === "blast-playoffs" && m.roundIndex === 1 && m.matchIndex === 0);
    const cross = fixed.find((m) => m.meta?.seriesRuleKey === "blast-playin-cross" && m.matchIndex === 0);
    assert.equal(sf?.team1, "Arrise Corp");
    assert.equal(cross?.team1, "Ashborn");
  });

  it("resolves Group A/B labels from stageKey when meta.groupKey is absent (legacy matches)", () => {
    const match = { stageKey: "blast-group-a", meta: {} };
    assert.equal(blastGroupLabelFromMatch(match), "Group A");
    const grouped = buildGroupedStandings([{ name: "T1" }], [match], "blast");
    assert.equal(grouped[0]?.label, "Group A");
  });
});
