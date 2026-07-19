import test from "node:test";
import assert from "node:assert/strict";
import { generateMatches } from "./formatGenerator.js";
import { computeBlastPlaceholderToTeamMap } from "./blastSeeding.js";
import {
  getQualifierSeedingOverrides,
  listBlastGroupSlotKeys,
  listEditableQualifierSlotKeys,
  mergeQualifierSeedingOverrides,
  normalizeQualifierSeedingOverrides,
  stripGroupStandingsOverrides,
  validateQualifierSeedingOverrides,
} from "./blastQualifierSeeding.js";
import { applyGroupStandingsOverrides } from "./groupStandingsOverrides.js";

const engine12 = { teamCount: 12, format: "blast", groupStage: { enabled: true, groupCount: 2 } };
const engine4g = { teamCount: 16, format: "blast", groupStage: { enabled: true, groupCount: 4 } };

test("listBlastGroupSlotKeys follows engine groupCount", () => {
  assert.equal(listBlastGroupSlotKeys(engine12).length, 12);
  assert.equal(listBlastGroupSlotKeys(engine4g).length, 16);
  assert.ok(listBlastGroupSlotKeys(engine4g).some((key) => key.startsWith("Group C #")));
});

test("listEditableQualifierSlotKeys unlocks group slots per finished group", () => {
  const keys = listEditableQualifierSlotKeys(engine12, ["A"]);
  assert.ok(keys.includes("Group A #1"));
  assert.ok(!keys.includes("Group B #1"));
  assert.ok(!keys.some((key) => key.startsWith("BLR")));
});

test("stripGroupStandingsOverrides removes global merged slots", () => {
  assert.deepEqual(
    stripGroupStandingsOverrides({
      "Group A #1": "Alpha",
      BLR1: "Beta",
    }),
    { "Group A #1": "Alpha" },
  );
});

test("applyGroupStandingsOverrides reorders group rows", () => {
  const grouped = [
    {
      label: "Group A",
      rows: [
        { team: "A1", wins: 3 },
        { team: "A2", wins: 2 },
      ],
    },
  ];
  const next = applyGroupStandingsOverrides(grouped, { "Group A #1": "A2", "Group A #2": "A1" });
  assert.deepEqual(next[0].rows.map((row) => row.team), ["A2", "A1"]);
});

test("mergeQualifierSeedingOverrides overlays manual ranks", () => {
  const base = { "Group A #1": "Alpha", "Group B #1": "Beta" };
  const merged = mergeQualifierSeedingOverrides(base, { "Group A #1": "Gamma" });
  assert.equal(merged["Group A #1"], "Gamma");
  assert.equal(merged["Group B #1"], "Beta");
});

test("normalizeQualifierSeedingOverrides keeps only diffs from auto map", () => {
  const auto = { "Group A #1": "Alpha", "Group B #1": "Beta" };
  assert.deepEqual(
    normalizeQualifierSeedingOverrides(auto, {
      "Group A #1": "Alpha",
      "Group B #1": "Gamma",
    }),
    { "Group B #1": "Gamma" },
  );
});

test("validateQualifierSeedingOverrides rejects duplicate teams", () => {
  const message = validateQualifierSeedingOverrides(
    { "Group A #1": "Alpha", "Group B #1": "Alpha" },
    [{ name: "Alpha" }, { name: "Beta" }],
    ["Group A #1", "Group B #1"],
  );
  assert.match(message || "", /more than one slot/i);
});

test("computeBlastPlaceholderToTeamMap works when only Group A is finished", () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({ name: `T${i + 1}` }));
  const orderA = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const matches = generateMatches(
    "blast",
    teams.map((t) => t.name),
    {},
  );
  const partial = matches.map((m) => {
    if (m.stageKey !== "blast-group-a") return m;
    const i1 = orderA.indexOf(m.team1);
    const i2 = orderA.indexOf(m.team2);
    if (i1 === -1 || i2 === -1) return m;
    return { ...m, winner: i1 < i2 ? m.team1 : m.team2, status: "finished" };
  });
  const map = computeBlastPlaceholderToTeamMap(teams, partial, null);
  assert.equal(map?.["Group A #1"], "T1");
  assert.equal(map?.["Group B #1"], undefined);
});

test("getQualifierSeedingOverrides reads engine_config map", () => {
  assert.deepEqual(
    getQualifierSeedingOverrides({
      qualifierSeedingOverrides: { "Group A #1": "Alpha", "Group B #2": "" },
    }),
    { "Group A #1": "Alpha" },
  );
});
