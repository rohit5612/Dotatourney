import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySeriesRulesToMatches, resolveSeries } from "./seriesRulesEngine.js";

function match(overrides = {}) {
  return {
    id: "m1",
    status: "upcoming",
    winner: null,
    meta: { seriesRuleKey: "blast-po-semifinal", seriesType: "bo5" },
    ...overrides,
  };
}

describe("seriesRulesEngine", () => {
  it("resolveSeries falls back when rule key missing", () => {
    assert.equal(resolveSeries({}, "blast-po-final", "bo3"), "bo3");
    assert.equal(resolveSeries({ "blast-po-final": "bo1" }, "blast-po-final", "bo3"), "bo1");
  });

  it("updates upcoming matches by seriesRuleKey", () => {
    const { matches, updatedCount } = applySeriesRulesToMatches(
      [match(), match({ id: "m2", meta: { seriesRuleKey: "blast-po-final", seriesType: "bo5" } })],
      { "blast-po-semifinal": "bo3", "blast-po-final": "bo3" },
    );
    assert.equal(updatedCount, 2);
    assert.equal(matches[0].meta.seriesType, "bo3");
    assert.equal(matches[1].meta.seriesType, "bo3");
  });

  it("skips finished and live matches", () => {
    const { matches, updatedCount, skippedCount } = applySeriesRulesToMatches(
      [
        match({ status: "finished", winner: "Team A" }),
        match({ id: "m2", status: "live" }),
        match({ id: "m3" }),
      ],
      { "blast-po-semifinal": "bo3" },
    );
    assert.equal(updatedCount, 1);
    assert.equal(skippedCount, 2);
    assert.equal(matches[0].meta.seriesType, "bo5");
    assert.equal(matches[1].meta.seriesType, "bo5");
    assert.equal(matches[2].meta.seriesType, "bo3");
  });

  it("no-op when seriesType already matches config", () => {
    const { updatedCount } = applySeriesRulesToMatches([match({ meta: { seriesRuleKey: "x", seriesType: "bo3" } })], {
      x: "bo3",
    });
    assert.equal(updatedCount, 0);
  });

  it("skips matches without seriesRuleKey", () => {
    const { updatedCount } = applySeriesRulesToMatches([match({ meta: { seriesType: "bo5" } })], {
      "blast-po-semifinal": "bo3",
    });
    assert.equal(updatedCount, 0);
  });
});
