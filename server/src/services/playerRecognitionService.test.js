import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySeasonRecognitions } from "./playerRecognitionService.js";

describe("playerRecognitionService", () => {
  it("assigns S2 champion and MVP badges from season snapshot teams", () => {
    const index = new Map();
    const season = {
      season_number: 2,
      season_slug: "season-2",
      season_name: "Bharat Pro Circuit League Season 2",
      season_card_badge: "S2",
    };
    const honors = {
      podiumTeams: [{ placement: 1, teamName: "Phantom" }],
      customCards: [],
    };
    const teams = [
      {
        name: "Phantom",
        players: [
          { id: "mvp-player", displayName: "Ace", playerAccountId: "account-mvp" },
          { id: "ally-player", displayName: "Bravo", playerAccountId: "account-ally" },
        ],
      },
    ];
    const mvp = {
      teamName: "Phantom",
      playerId: "mvp-player",
      playerName: "Ace",
    };

    applySeasonRecognitions(index, season, { honors, teams, mvp });

    assert.deepEqual(index.get("account-mvp"), [
      {
        id: "S2-mvp",
        label: "S2•MVP",
        kind: "mvp",
        seasonNumber: 2,
        seasonSlug: "season-2",
        seasonName: "Bharat Pro Circuit League Season 2",
        detail: "Tournament MVP · Bharat Pro Circuit League Season 2",
      },
      {
        id: "S2-champion",
        label: "S2•Champion",
        kind: "champion",
        seasonNumber: 2,
        seasonSlug: "season-2",
        seasonName: "Bharat Pro Circuit League Season 2",
        teamName: "Phantom",
        detail: "Bharat Pro Circuit League Season 2 · Phantom",
      },
    ]);
    assert.deepEqual(index.get("account-ally"), [
      {
        id: "S2-champion",
        label: "S2•Champion",
        kind: "champion",
        seasonNumber: 2,
        seasonSlug: "season-2",
        seasonName: "Bharat Pro Circuit League Season 2",
        teamName: "Phantom",
        detail: "Bharat Pro Circuit League Season 2 · Phantom",
      },
    ]);
  });

  it("keeps S1 and S2 badges separate for multi-season players", () => {
    const index = new Map();

    applySeasonRecognitions(
      index,
      { season_number: 1, season_slug: "season-1", season_name: "Season 1", season_card_badge: "S1" },
      {
        honors: { podiumTeams: [{ placement: 1, teamName: "Ashborn" }], customCards: [] },
        teams: [{ name: "Ashborn", players: [{ id: "p1", displayName: "Star", playerAccountId: "shared-account" }] }],
        mvp: { teamName: "Ashborn", playerId: "p1", playerName: "Star" },
      },
    );

    applySeasonRecognitions(
      index,
      { season_number: 2, season_slug: "season-2", season_name: "Season 2", season_card_badge: "S2" },
      {
        honors: { podiumTeams: [{ placement: 1, teamName: "Phantom" }], customCards: [] },
        teams: [{ name: "Phantom", players: [{ id: "p2", displayName: "Ace", playerAccountId: "shared-account" }] }],
        mvp: null,
      },
    );

    const badges = index.get("shared-account").map((entry) => entry.label);
    assert.deepEqual(badges, ["S1•MVP", "S1•Champion", "S2•Champion"]);
  });
});
