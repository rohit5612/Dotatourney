import test from "node:test";
import assert from "node:assert/strict";
import { generateMatches } from "./formatGenerator.js";
import { computeBlastPlaceholderToTeamMap } from "./blastSeeding.js";
import {
  getQualifierSeedingOverrides,
  listBlastQualifierSlotKeys,
  listEditableQualifierSlotKeys,
  mergeQualifierSeedingOverrides,
  normalizeQualifierSeedingOverrides,
  validateQualifierSeedingOverrides,
} from "./blastQualifierSeeding.js";

test("listBlastQualifierSlotKeys for n=12 includes group ranks only", () => {
  const keys = listBlastQualifierSlotKeys(12);
  assert.deepEqual(keys, [
    "Group A #1",
    "Group A #2",
    "Group A #3",
    "Group A #4",
    "Group A #5",
    "Group A #6",
    "Group B #1",
    "Group B #2",
    "Group B #3",
    "Group B #4",
    "Group B #5",
    "Group B #6",
  ]);
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

test("listEditableQualifierSlotKeys unlocks group slots per finished group", () => {
  const keys = listEditableQualifierSlotKeys(12, ["A"], false);
  assert.ok(keys.includes("Group A #1"));
  assert.ok(!keys.includes("Group B #1"));
  assert.ok(!keys.includes("BLR1"));
});

test("computeBlastPlaceholderToTeamMap works when only Group A is finished", () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({ name: `T${i + 1}` }));
  const orderA = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const orderB = ["T7", "T8", "T9", "T10", "T11", "T12"];
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
