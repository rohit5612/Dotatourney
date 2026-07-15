import test from "node:test";
import assert from "node:assert/strict";
import { steam64ToSteam32 } from "./steamId.js";

test("steam64ToSteam32 converts valid Steam64 IDs", () => {
  assert.equal(steam64ToSteam32("76561198085409965"), 125144237);
  assert.equal(steam64ToSteam32("76561198034030852"), 73765124);
});

test("steam64ToSteam32 rejects invalid input", () => {
  assert.equal(steam64ToSteam32(""), null);
  assert.equal(steam64ToSteam32("not-a-steam-id"), null);
  assert.equal(steam64ToSteam32("7656119"), null);
});
