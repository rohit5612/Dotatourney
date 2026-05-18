import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyBlastGroupSeeding, computeBlastPlaceholderToTeamMap } from "./blastSeeding.js";
import { applyProgression } from "./progressionEngine.js";
import { blastSideBracketSizes, generateMatches, getBlastPhaseSizes, stageTabsForFormat } from "./formatGenerator.js";
import { buildGroupedStandings, buildStandings } from "./standingsEngine.js";

function teamList(n) {
  return Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `T${i + 1}` }));
}

function winTokensByStage(matches) {
  /** @type {Record<string, Set<string>>} */
  const map = {};
  for (const m of matches) {
    const tok = m.meta?.winToken;
    if (!tok) continue;
    const sk = m.stageKey;
    if (!map[sk]) map[sk] = new Set();
    map[sk].add(tok);
  }
  return map;
}

/** Mark every BO1 group match as decided (winner = team1) for deterministic tests. */
function finishBlastGroupStage(matches) {
  return matches.map((m) => {
    if (m.stageKey === "blast-group-a" || m.stageKey === "blast-group-b") {
      return { ...m, winner: m.team1, status: "finished" };
    }
    return m;
  });
}

describe("BLAST formatGenerator", () => {
  it("getBlastPhaseSizes is null below minimum (10 teams)", () => {
    assert.equal(getBlastPhaseSizes(9), null);
    assert.deepEqual(blastSideBracketSizes(8), { playin: 0, lc: 0 });
  });

  it("getBlastPhaseSizes remainder / LC / Play-In-from-groups (n=10 reserves seconds for QF)", () => {
    assert.deepEqual(
      getBlastPhaseSizes(10),
      {
        n: 10,
        sidePoolExcluded: 4,
        remainder: 6,
        lcEntrants: 4,
        playInFromGroups: 2,
        middleBracketEntrants: null,
        playInBracketSize: 4,
        lcAdvanceToPlayIn: 2,
        piSurvivorsToMain: 2,
        mainPlayoffPath: "ten_qf_seconds",
      },
    );
    assert.deepEqual(getBlastPhaseSizes(12), {
      n: 12,
      sidePoolExcluded: null,
      remainder: null,
      lcEntrants: 4,
      playInFromGroups: null,
      middleBracketEntrants: 4,
      playInBracketSize: null,
      lcAdvanceToPlayIn: 2,
      piSurvivorsToMain: 4,
      mainPlayoffPath: "tiered_merged_standings",
    });
    assert.deepEqual(blastSideBracketSizes(12), { playin: 4, lc: 4 });
  });

  it("n≥11 tiered path: middle band + LC scale (e.g. n=16)", () => {
    const s = getBlastPhaseSizes(16);
    assert.ok(s);
    assert.equal(s.mainPlayoffPath, "tiered_merged_standings");
    assert.equal(s.lcEntrants, 8);
    assert.equal(s.middleBracketEntrants, 4);
    assert.equal(s.piSurvivorsToMain, 4);
  });

  it("generateMatches rejects BLAST with fewer than 10 teams", () => {
    assert.throws(() => generateMatches("blast", teamList(7).map((t) => t.name), {}), /10 teams minimum/);
  });

  it("generateMatches('blast') for n=10,12,16: core stages and side brackets", () => {
    for (const n of [10, 12, 16]) {
      const teams = teamList(n);
      const matches = generateMatches("blast", teams.map((t) => t.name), {});
      const stages = [...new Set(matches.map((m) => m.stageKey))].sort();
      const sizes = getBlastPhaseSizes(n);
      assert.ok(sizes);

      assert.ok(stages.includes("blast-group-a"), `n=${n} has group A`);
      assert.ok(stages.includes("blast-group-b"), `n=${n} has group B`);
      assert.ok(stages.includes("blast-playoffs"), `n=${n} has playoffs`);
      assert.ok(stages.includes("blast-playin"), `n=${n} has play-in`);
      assert.ok(stages.includes("blast-lastchance"), `n=${n} has last chance`);

      const tabs = stageTabsForFormat("blast", { teamCount: n }).map((t) => t.id);
      assert.ok(tabs.includes("blast-qualifiers"), `n=${n} merged Last Chance & Play-In tab`);
      assert.ok(!tabs.includes("blast-playin"), `n=${n} standalone Play-In tab removed`);
      assert.ok(!tabs.includes("blast-lastchance"), `n=${n} standalone Last Chance tab removed`);
      const qaIdx = tabs.indexOf("blast-qualifiers");
      const grpBIdx = tabs.indexOf("blast-group-b");
      const poIdx = tabs.indexOf("blast-playoffs");
      assert.ok(grpBIdx < qaIdx, "Qualifier tab after Group B");
      assert.ok(qaIdx < poIdx, "Qualifier tab before Playoffs");
    }
  });

  it("generateMatches('blast') succeeds for every team count 10–64 (dashboard input range)", () => {
    const names64 = Array.from({ length: 64 }, (_, i) => `T${i + 1}`);
    for (let n = 10; n <= 64; n += 1) {
      assert.ok(getBlastPhaseSizes(n), `sizes n=${n}`);
      const slice = names64.slice(0, n);
      let matches;
      assert.doesNotThrow(() => {
        matches = generateMatches("blast", slice, {});
      }, `generate n=${n}`);
      assert.ok(matches.length > 0, `non-empty n=${n}`);
    }
  });

  it("n=10: group 2nds in main quarterfinals vs Play-In finalists (4-team PI, one round)", () => {
    const teams = teamList(10);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const pi = matches.filter((m) => m.stageKey === "blast-playin");
    assert.ok(pi.every((m) => m.roundIndex === 0));
    assert.equal(pi.length, 2);
    const poQf = matches.filter((m) => m.stageKey === "blast-playoffs" && m.roundIndex === 0);
    assert.equal(poQf.length, 2);
    const teamsQf = new Set(poQf.flatMap((m) => [m.team1, m.team2]));
    assert.ok(teamsQf.has("Group A #2"));
    assert.ok(teamsQf.has("Group B #2"));
    assert.ok(teamsQf.has("PIR1M1W"));
    assert.ok(teamsQf.has("PIR1M2W"));
  });

  it("n=12 tiered BLAST: middle #3/#4, crossover group #2 vs LC, QF/SF playoff path, PIR + LCR tokens", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const pi = matches.filter((m) => m.stageKey === "blast-playin");
    assert.ok(pi.every((m) => String(m.meta?.winToken || "").startsWith("PIR")), "all Play-In wins use PIR…");
    assert.ok(pi.some((m) => m.meta?.seriesRuleKey === "blast-playin-cross"), "crossover rows");
    const po = matches.filter((m) => m.stageKey === "blast-playoffs").sort((a, b) => a.roundIndex - b.roundIndex);
    assert.equal(po.length, 5);
    const qf = po.filter((m) => m.roundIndex === 0);
    assert.equal(qf.length, 2);
    assert.ok(qf.every((m) => m.meta?.seriesRuleKey === "blast-po-quarterfinal"));
    const sf = po.filter((m) => m.roundIndex === 1);
    const tSf = new Set(sf.flatMap((m) => [m.team1, m.team2]));
    assert.ok(tSf.has("Group A #1"));
    assert.ok(tSf.has("Group B #1"));
    const cross = matches.filter((m) => m.meta?.seriesRuleKey === "blast-playin-cross");
    assert.equal(cross.length, 2);
    const crossGroupSeeds = new Set(cross.map((m) => m.team1));
    assert.ok(crossGroupSeeds.has("Group A #2"));
    assert.ok(crossGroupSeeds.has("Group B #2"));
    const piMid = pi.filter((m) => (m.roundIndex ?? 0) === 0);
    const midEntrants = new Set(piMid.flatMap((m) => [m.team1, m.team2]));
    for (const x of ["Group A #3", "Group B #3", "Group A #4", "Group B #4"]) {
      assert.ok(midEntrants.has(x), `middle round 0 includes ${x}`);
    }
    assert.ok(!midEntrants.has("Group A #2") && !midEntrants.has("Group B #2"), "group #2 not in middle knockout");
    assert.ok(piMid.every((m) => m.meta?.seriesRuleKey === "blast-mp-semifinal"), "tiered middle Play-In uses blast-mp-semifinal");
    assert.ok(cross.every((m) => m.meta?.seriesRuleKey === "blast-playin-cross"), "crossover uses blast-playin-cross");
    const custom = generateMatches("blast", teams.map((t) => t.name), {
      "blast-mp-semifinal": "bo1",
      "blast-playin-cross": "bo5",
    });
    assert.equal(
      custom.find((m) => m.stageKey === "blast-playin" && m.meta?.seriesRuleKey === "blast-mp-semifinal")?.meta?.seriesType,
      "bo1",
    );
    assert.equal(custom.find((m) => m.meta?.seriesRuleKey === "blast-playin-cross")?.meta?.seriesType, "bo5");
    const cx1 = cross[0].meta?.winToken;
    const cx2 = cross[1].meta?.winToken;
    const qp = (tok) => {
      const row = qf.find((m) => m.team1 === tok || m.team2 === tok);
      return row.team1 === tok ? row.team2 : row.team1;
    };
    assert.notEqual(qp(cx1), qp(cx2));
    const qs = [...qf].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
    assert.ok(
      qs.every((row) => [row.team1, row.team2].some((x) => String(x).startsWith("PIR"))),
      "QF sides reference Play-In winners",
    );
    assert.equal(new Set(qs.map((row) => [String(row.team1), String(row.team2)].sort().join("+"))).size, 2);
  });

  it("match list order: Last Chance block before Play-In block", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const firstLc = matches.findIndex((m) => m.stageKey === "blast-lastchance");
    const firstPi = matches.findIndex((m) => m.stageKey === "blast-playin");
    assert.ok(firstLc >= 0 && firstPi >= 0);
    assert.ok(firstLc < firstPi);
  });

  it("n≥11 tiered: Play-In has middle rounds then crossover (all `PIR…` win tokens)", () => {
    const teams = teamList(14);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const pi = matches.filter((m) => m.stageKey === "blast-playin");
    const rounds = [...new Set(pi.map((m) => m.roundIndex ?? 0))].sort((a, b) => a - b);
    assert.ok(rounds.length >= 2, `expected middle + crossover rounds, got ${rounds.length}`);
    assert.ok(pi.every((m) => String(m.meta?.winToken || "").startsWith("PIR")), "PIR prefix for Play-In");
    assert.ok(
      pi.every((m) => !/^PI\d+M\d+W$/.test(String(m.meta?.winToken || ""))),
      "tiered drops legacy PI1M1W-style tokens",
    );
  });

  it("Play-In / Last chance / playoff win tokens use simple prefixes (PIR / LCR / QFR / SFR)", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const byStage = winTokensByStage(matches);
    const pi = byStage["blast-playin"] || new Set();
    const lc = byStage["blast-lastchance"] || new Set();
    for (const t of pi) {
      assert.ok(!lc.has(t), `token ${t} must not appear in both play-in and last chance`);
    }
    for (const t of pi) {
      assert.ok(/^PIR\d+M\d+W$/.test(t), `play-in token ${t} should be PIR…`);
    }
    for (const t of lc) assert.ok(t.startsWith("LCR"), `last-chance token ${t} should start with LCR`);
    const po = byStage["blast-playoffs"] || new Set();
    for (const t of po) {
      if (t === "CHAMPION") continue;
      assert.ok(t.startsWith("QFR") || t.startsWith("SFR"), `playoff token ${t} should be QFR… or SFR…`);
    }
  });

  it("applyProgression on qualifier winners does not fill Last Chance slots", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const qualFirst = matches.find(
      (m) => m.stageKey === "blast-playin" && m.meta?.winToken && /^PIR\d+M\d+W$/.test(m.meta.winToken),
    );
    assert.ok(qualFirst);
    const tok = qualFirst.meta.winToken;
    const winner = "WinnerQual";
    const updated = { ...qualFirst, winner, meta: { ...qualFirst.meta, winToken: tok } };
    const base = matches.map((m) => (m.id === qualFirst.id ? updated : m));
    const progressed = applyProgression(base, updated);

    const lcMatches = progressed.filter((m) => m.stageKey === "blast-lastchance");
    assert.ok(lcMatches.length > 0);
    for (const m of lcMatches) {
      assert.notEqual(m.team1, winner);
      assert.notEqual(m.team2, winner);
    }
  });

  it("group sizes for odd and even total n", () => {
    const mid = (n) => Math.ceil(n / 2);
    for (const n of [10, 11, 12]) {
      const teams = teamList(n);
      const matches = generateMatches("blast", teams.map((t) => t.name), {});
      const aIdx = new Set(
        matches.filter((m) => m.stageKey === "blast-group-a").flatMap((m) => [m.team1, m.team2]),
      );
      const inA = teams.filter((t) => aIdx.has(t.name));
      assert.equal(inA.length, mid(n), `group A size n=${n}`);
    }
  });
});

describe("BLAST group seeding from standings", () => {
  it("fills playoffs, play-in, and last chance when groups are complete", () => {
    const teams = teamList(12);
    const raw = generateMatches("blast", teams.map((t) => t.name), {});
    const finished = finishBlastGroupStage(raw);
    assert.ok(computeBlastPlaceholderToTeamMap(teams, finished));
    const { matches: seeded } = applyBlastGroupSeeding(teams, finished);

    const groupStandingPlaceholder = /^Group [AB] #\d+$/;
    for (const m of seeded) {
      if (m.stageKey === "blast-playin" || m.stageKey === "blast-lastchance") {
        assert.ok(!groupStandingPlaceholder.test(m.team1), `team1 still group placeholder: ${m.team1}`);
        assert.ok(!groupStandingPlaceholder.test(m.team2), `team2 still group placeholder: ${m.team2}`);
      }
    }
  });

  it("returns null map until all group games have a winner", () => {
    const teams = teamList(10);
    const raw = generateMatches("blast", teams.map((t) => t.name), {});
    const partial = raw.map((m) =>
      m.stageKey === "blast-group-a" && m.roundIndex === 0 ? { ...m, winner: m.team1, status: "finished" } : m,
    );
    assert.equal(computeBlastPlaceholderToTeamMap(teams, partial), null);
  });
});

describe("BLAST grouped standings", () => {
  it("Group A / B tables only list teams in that group", () => {
    const teams = teamList(11);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const grouped = buildGroupedStandings(teams, matches, "blast");
    const gA = grouped.find((g) => g.label === "Group A");
    const gB = grouped.find((g) => g.label === "Group B");
    assert.ok(gA && gB);
    const namesA = new Set(gA.rows.map((r) => r.team));
    const namesB = new Set(gB.rows.map((r) => r.team));
    assert.equal(namesA.size, 6);
    assert.equal(namesB.size, 5);
    for (const r of gA.rows) assert.ok(!namesB.has(r.team));
  });

  it("global blast standings do not mark top-2 advancing across both groups", () => {
    const teams = teamList(10);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const standings = buildStandings(teams, matches, "blast");
    assert.ok(standings.every((r) => r.status === "in_progress"));
  });
});
