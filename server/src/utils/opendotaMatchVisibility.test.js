import test from "node:test";
import assert from "node:assert/strict";
import {
  inferMatchHistoryRestricted,
  leagueSnapshotIsSettled,
} from "./opendotaMatchVisibility.js";

test("inferMatchHistoryRestricted when no wl, heroes, or totals games", () => {
  assert.equal(inferMatchHistoryRestricted({ win: 0, lose: 0 }, [], []), true);
});

test("inferMatchHistoryRestricted false when wl has games", () => {
  assert.equal(inferMatchHistoryRestricted({ win: 3, lose: 2 }, [], []), false);
});

test("leagueSnapshotIsSettled for emptyLeagueSync", () => {
  assert.equal(
    leagueSnapshotIsSettled({ verifiedLeague: true, emptyLeagueSync: true, matchIds: [], raw: [] }),
    true,
  );
});
