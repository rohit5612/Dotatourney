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
        playInBracketSize: 4,
        lcAdvanceToPlayIn: 2,
        piSurvivorsToMain: 2,
        mainPlayoffPath: "ten_qf_seconds",
      },
    );
    assert.deepEqual(getBlastPhaseSizes(12), {
      n: 12,
      sidePoolExcluded: 4,
      remainder: 8,
      lcEntrants: 4,
      playInFromGroups: 4,
      playInBracketSize: 8,
      lcAdvanceToPlayIn: 2,
      piSurvivorsToMain: 0,
      mainPlayoffPath: "twelve_semis_top2",
    });
    assert.deepEqual(blastSideBracketSizes(12), { playin: 4, lc: 4 });
  });

  it("n=16 keeps standard main path (only group winners reserved from side pool)", () => {
    const s = getBlastPhaseSizes(16);
    assert.ok(s);
    assert.equal(s.sidePoolExcluded, 2);
    assert.equal(s.remainder, 14);
    assert.equal(s.mainPlayoffPath, "standard");
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
      assert.ok(tabs.includes("blast-playin"), `n=${n} tabs include Play-In`);
      assert.ok(tabs.includes("blast-lastchance"), `n=${n} tabs include Last Chance`);
      const lcIdx = tabs.indexOf("blast-lastchance");
      const piIdx = tabs.indexOf("blast-playin");
      assert.ok(lcIdx < piIdx, "UI tabs: Last Chance before Play-In");
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
    assert.ok(teamsQf.has("PI1M1W"));
    assert.ok(teamsQf.has("PI1M2W"));
  });

  it("n=12: main bracket is semis + final only; top two per group (no Play-In feeds championship)", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const po = matches.filter((m) => m.stageKey === "blast-playoffs").sort((a, b) => a.roundIndex - b.roundIndex);
    assert.equal(po.length, 3);
    assert.ok(
      po
        .filter((m) => m.roundIndex === 0)
        .every((m) => m.meta?.seriesRuleKey === "blast-po-semifinal"),
    );
    const sf = po.filter((m) => m.roundIndex === 0);
    const tSf = new Set(sf.flatMap((m) => [m.team1, m.team2]));
    assert.ok(tSf.has("Group A #1"));
    assert.ok(tSf.has("Group A #2"));
    assert.ok(tSf.has("Group B #1"));
    assert.ok(tSf.has("Group B #2"));
    for (const m of po) {
      assert.ok(!String(m.team1).startsWith("PI"));
      assert.ok(!String(m.team2).startsWith("PI"));
    }
  });

  it("match list order: Last Chance block before Play-In block", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const firstLc = matches.findIndex((m) => m.stageKey === "blast-lastchance");
    const firstPi = matches.findIndex((m) => m.stageKey === "blast-playin");
    assert.ok(firstLc >= 0 && firstPi >= 0);
    assert.ok(firstLc < firstPi);
  });

  it("Play-In single round for n>=11 except n=10 (n=14 has only PI round 0)", () => {
    const teams = teamList(14);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const pi = matches.filter((m) => m.stageKey === "blast-playin");
    assert.ok(pi.every((m) => m.roundIndex === 0));
    for (const m of pi) {
      assert.match(String(m.meta?.winToken || ""), /^PI1M\d+W$/);
    }
  });

  it("Play-In and Last Chance use disjoint winToken prefixes", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const byStage = winTokensByStage(matches);
    const pi = byStage["blast-playin"] || new Set();
    const lc = byStage["blast-lastchance"] || new Set();
    for (const t of pi) {
      assert.ok(!lc.has(t), `token ${t} must not appear in both play-in and last chance`);
    }
    for (const t of pi) assert.ok(t.startsWith("PI"), `play-in token ${t} should start with PI`);
    for (const t of lc) assert.ok(t.startsWith("LC"), `last-chance token ${t} should start with LC`);
    const po = byStage["blast-playoffs"] || new Set();
    for (const t of po) {
      if (t === "CHAMPION") continue;
      assert.ok(t.startsWith("BPO"), `playoff SE token ${t} should start with BPO`);
    }
  });

  it("applyProgression on Play-In does not fill Last Chance slots", () => {
    const teams = teamList(12);
    const matches = generateMatches("blast", teams.map((t) => t.name), {});
    const playinFirst = matches.find((m) => m.stageKey === "blast-playin" && m.meta?.winToken);
    assert.ok(playinFirst);
    const tok = playinFirst.meta.winToken;
    assert.ok(tok.startsWith("PI"));
    const winner = "WinnerPI";
    const updated = { ...playinFirst, winner, meta: { ...playinFirst.meta, winToken: tok } };
    const base = matches.map((m) => (m.id === playinFirst.id ? updated : m));
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

    const groupPlaceholder = /^((BPI|BLC)\d+|Group [AB] #\d+)$/;
    for (const m of seeded) {
      if (m.stageKey === "blast-playin" || m.stageKey === "blast-lastchance") {
        assert.ok(!groupPlaceholder.test(m.team1), `team1 still group placeholder: ${m.team1}`);
        assert.ok(!groupPlaceholder.test(m.team2), `team2 still group placeholder: ${m.team2}`);
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
