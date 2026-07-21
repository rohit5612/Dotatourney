import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupLineupsByTeam, matchLineupNeedsReseed } from "./matchLineupService.js";

function lineupRow(teamName, displayName, playerAccountId = displayName) {
  return {
    team_name: teamName,
    display_name: displayName,
    player_account_id: playerAccountId,
    roles: [],
    mmr: null,
    is_substitute: false,
    replaces_display_name: null,
    steam_avatar_url: "",
  };
}

describe("groupLineupsByTeam", () => {
  it("assigns rows only to matching team sides", () => {
    const rows = [
      lineupRow("Frost Reign", "Player A", "a"),
      lineupRow("Emberfall", "Player B", "b"),
      lineupRow("Old Team", "Player C", "c"),
    ];

    const grouped = groupLineupsByTeam(rows, "Frost Reign", "Emberfall");
    assert.equal(grouped.team1.players.length, 1);
    assert.equal(grouped.team2.players.length, 1);
    assert.equal(grouped.team1.players[0].displayName, "Player A");
    assert.equal(grouped.team2.players[0].displayName, "Player B");
  });

  it("does not dump stale team rows into team2", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => lineupRow("Emberfall", `Ember ${index + 1}`, `e${index}`)),
      ...Array.from({ length: 5 }, (_, index) => lineupRow("Former Opponent", `Other ${index + 1}`, `o${index}`)),
    ];

    const grouped = groupLineupsByTeam(rows, "Frost Reign", "Emberfall");
    assert.equal(grouped.team1.players.length, 0);
    assert.equal(grouped.team2.players.length, 5);
  });
});

describe("matchLineupNeedsReseed", () => {
  it("detects stale team_name rows after bracket reassignment", () => {
    const rows = [
      lineupRow("Emberfall", "Player 1"),
      lineupRow("Former Opponent", "Player 2"),
    ];
    assert.equal(matchLineupNeedsReseed(rows, "Frost Reign", "Emberfall"), true);
  });

  it("accepts a clean five-per-side lineup", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => lineupRow("Frost Reign", `FR ${index}`, `fr${index}`)),
      ...Array.from({ length: 5 }, (_, index) => lineupRow("Emberfall", `EF ${index}`, `ef${index}`)),
    ];
    assert.equal(matchLineupNeedsReseed(rows, "Frost Reign", "Emberfall"), false);
  });
});
