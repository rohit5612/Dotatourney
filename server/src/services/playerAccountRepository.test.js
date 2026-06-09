import test from "node:test";
import assert from "node:assert/strict";
import { publicSteamOnlyProfile } from "./playerAccountRepository.js";

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
