import test from "node:test";
import assert from "node:assert/strict";
import {
  getQualifierSeedingOverrides,
  listBlastQualifierSlotKeys,
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

test("getQualifierSeedingOverrides reads engine_config map", () => {
  assert.deepEqual(
    getQualifierSeedingOverrides({
      qualifierSeedingOverrides: { "Group A #1": "Alpha", "Group B #2": "" },
    }),
    { "Group A #1": "Alpha" },
  );
});
