import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPublicMatchStageLabel } from "./matchStageLabel.js";

describe("formatPublicMatchStageLabel", () => {
  const playoffMatches = [
    { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
    { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 1, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
    { stageKey: "blast-playoffs", roundIndex: 2, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
    { stageKey: "blast-playoffs", roundIndex: 2, matchIndex: 1, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
    { stageKey: "blast-playoffs", roundIndex: 3, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
  ];

  it("derives quarter, semi, and final labels from playoff round position", () => {
    assert.equal(
      formatPublicMatchStageLabel(
        { stageKey: "blast-playoffs", roundIndex: 1, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
        playoffMatches,
      ),
      "Quarterfinals",
    );
    assert.equal(
      formatPublicMatchStageLabel(
        { stageKey: "blast-playoffs", roundIndex: 2, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
        playoffMatches,
      ),
      "Semifinals",
    );
    assert.equal(
      formatPublicMatchStageLabel(
        { stageKey: "blast-playoffs", roundIndex: 3, matchIndex: 0, meta: { seriesRuleKey: "blast-po-quarterfinal" } },
        playoffMatches,
      ),
      "Finals",
    );
  });

  it("keeps crossover label for play-in cross matches", () => {
    assert.equal(
      formatPublicMatchStageLabel({
        stageKey: "blast-playin",
        roundIndex: 0,
        meta: { seriesRuleKey: "blast-playin-cross" },
      }),
      "Crossover",
    );
  });
});
