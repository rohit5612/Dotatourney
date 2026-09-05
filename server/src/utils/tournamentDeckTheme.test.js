import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasDeckBadgeTheme,
  normalizeDeckThemeHexColor,
  parseTournamentDeckTheme,
  serializeTournamentDeckTheme,
} from "./tournamentDeckTheme.js";

describe("tournamentDeckTheme", () => {
  it("normalizes short and long hex colors", () => {
    assert.equal(normalizeDeckThemeHexColor("abc"), "#aabbcc");
    assert.equal(normalizeDeckThemeHexColor("#F8FAFC"), "#f8fafc");
    assert.equal(normalizeDeckThemeHexColor("not-a-color"), "");
  });

  it("parses and serializes deck badge theme fields", () => {
    const theme = parseTournamentDeckTheme({
      badgeBackground: "#1e3a2f",
      badgeText: "#fff",
    });
    assert.deepEqual(theme, {
      badgeBackground: "#1e3a2f",
      badgeText: "#ffffff",
    });
    assert.equal(hasDeckBadgeTheme(theme), true);
    assert.deepEqual(serializeTournamentDeckTheme(theme), theme);
  });
});
