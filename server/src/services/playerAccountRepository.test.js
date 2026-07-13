import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBpcId,
  normalizeBpcIdParam,
  parseBpcIdNumber,
  publicSteamOnlyProfile,
} from "./playerAccountRepository.js";

test("formatBpcId and parseBpcIdNumber round-trip", () => {
  assert.equal(formatBpcId(2), "BPC-002");
  assert.equal(formatBpcId(73), "BPC-073");
  assert.equal(parseBpcIdNumber("bpc-073"), 73);
  assert.equal(parseBpcIdNumber("BPC-ABC"), null);
});

test("normalizeBpcIdParam accepts canonical and shorthand forms", () => {
  assert.equal(normalizeBpcIdParam("BPC-042"), "BPC-042");
  assert.equal(normalizeBpcIdParam("bpc-042"), "BPC-042");
  assert.equal(normalizeBpcIdParam("042"), "BPC-042");
  assert.equal(normalizeBpcIdParam("42"), "BPC-042");
  assert.equal(normalizeBpcIdParam(""), null);
  assert.equal(normalizeBpcIdParam("invalid"), null);
});

test("publicSteamOnlyProfile omits email and discord", () => {
  const profile = publicSteamOnlyProfile({
    display_name: "AddicTzZ",
    bpc_id: "BPC-042",
    slug: "addictzz",
    email: "secret@example.com",
    discord_username: "discord#1234",
    steam_persona: "AddicTzZ",
    steam_avatar_url: "https://steam/avatar.jpg",
    steam_profile: "https://steamcommunity.com/id/x",
  });
  assert.equal(profile.displayName, "AddicTzZ");
  assert.equal(profile.bpcId, "BPC-042");
  assert.equal(profile.steamPersona, "AddicTzZ");
  assert.ok(!("email" in profile));
  assert.ok(!("discordUsername" in profile));
});
