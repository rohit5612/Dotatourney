import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBlastPlacementTeams, buildBlastBracketHonors, buildPublicHonorsPayload, deriveTeamBracketBadge } from "./bracketHonorsEngine.js";

describe("bracketHonorsEngine", () => {
  it("marks champion and runner-up from final", () => {
    const matches = [
      {
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "Alpha",
        team2: "Beta",
        winner: "Alpha",
        status: "finished",
      },
    ];
    const honors = buildBlastBracketHonors(matches, "blast");
    assert.equal(honors.champion?.teamName, "Alpha");
    assert.equal(honors.runnerUp?.teamName, "Beta");
    assert.equal(honors.placementTeams[0].teamName, "Alpha");
    assert.equal(honors.placementTeams[1].teamName, "Beta");
  });

  it("includes semifinal losers as shared 3rd place entries", () => {
    const matches = [
      {
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 0,
        team1: "Seed A",
        team2: "Semi Loser A",
        winner: "Seed A",
        status: "finished",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 1,
        team1: "Seed B",
        team2: "Semi Loser B",
        winner: "Seed B",
        status: "finished",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "Seed A",
        team2: "Seed B",
        winner: "Seed A",
        status: "finished",
      },
    ];
    const placements = buildBlastPlacementTeams(matches);
    assert.equal(placements.filter((entry) => entry.placement === 3).length, 2);
  });

  it("shows highest alive round while event is in progress", () => {
    const matches = [
      {
        stageKey: "blast-playoffs",
        roundIndex: 0,
        matchIndex: 0,
        team1: "Alpha",
        team2: "Beta",
        winner: "Alpha",
        status: "finished",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 0,
        team1: "Seed",
        team2: "Alpha",
        winner: null,
        status: "upcoming",
      },
    ];
    const badge = deriveTeamBracketBadge("Alpha", matches);
    assert.equal(badge.kind, "in_semifinals");
  });

  it("treats engine round numbers 1,2,3 as quarterfinals, semifinals, final", () => {
    const matches = [
      {
        stageKey: "blast-playoffs",
        roundIndex: 1,
        matchIndex: 0,
        team1: "Alpha",
        team2: "Beta",
        winner: null,
        status: "upcoming",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "SFR1M1W",
        team2: "SFR1M2W",
        winner: null,
        status: "upcoming",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 3,
        matchIndex: 0,
        team1: "CHAMPION",
        team2: "CHAMPION",
        winner: null,
        status: "upcoming",
      },
    ];
    const badge = deriveTeamBracketBadge("Alpha", matches);
    assert.equal(badge.kind, "in_quarterfinals");
    assert.equal(badge.label, "Quarterfinals");
  });

  it("respects displayPodiumCount from admin settings", () => {
    const matches = [
      {
        stageKey: "blast-playoffs",
        roundIndex: 2,
        matchIndex: 0,
        team1: "Alpha",
        team2: "Beta",
        winner: "Alpha",
        status: "finished",
      },
    ];
    const payload = buildPublicHonorsPayload(matches, "blast", { displayPodiumCount: 1, customCards: [] });
    assert.equal(payload.podiumTeams.length, 1);
    assert.equal(payload.podiumTeams[0].teamName, "Alpha");
  });

  it("never assigns a group-stage badge — only the last non-group series", () => {
    const matches = [
      {
        stageKey: "blast-group-a",
        roundIndex: 0,
        matchIndex: 0,
        team1: "Group Only",
        team2: "Rival",
        winner: "Rival",
        status: "finished",
      },
      {
        stageKey: "blast-lastchance",
        roundIndex: 0,
        matchIndex: 0,
        team1: "LC Exit",
        team2: "Other",
        winner: "Other",
        status: "finished",
      },
      {
        stageKey: "blast-playoffs",
        roundIndex: 0,
        matchIndex: 0,
        team1: "QF Exit",
        team2: "Seed",
        winner: "Seed",
        status: "finished",
      },
    ];

    assert.equal(deriveTeamBracketBadge("Group Only", matches), null);
    assert.equal(deriveTeamBracketBadge("LC Exit", matches)?.kind, "last_chance");
    assert.equal(deriveTeamBracketBadge("QF Exit", matches)?.kind, "quarterfinalist");
  });
});
