import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markManifestAsCollection, resolveSeasonSnapshotTier } from "./cardSnapshotService.js";

describe("cardSnapshotService", () => {
  it("resolves snapshot tier from registration, admin override, and uploaded asset", () => {
    assert.equal(
      resolveSeasonSnapshotTier(
        { card_tier_override: "gold" },
        { card_tier: "default" },
        { tier: "player" },
      ),
      "gold",
    );
    assert.equal(
      resolveSeasonSnapshotTier(
        { card_tier_override: null },
        { card_tier: "default" },
        { tier: "holo" },
      ),
      "holo",
    );
  });

  it("marks manifests as inactive collection cards with season label", () => {
    const manifest = markManifestAsCollection({
      tier: "gold",
      seasonBadge: "S2 Emerald",
      seasonValidity: {
        badge: "S2 Emerald",
        active: true,
        label: "Valid for S2 Emerald",
      },
    });

    assert.equal(manifest.seasonValidity.active, false);
    assert.equal(manifest.seasonValidity.collectionOnly, true);
    assert.equal(manifest.seasonValidity.label, "S2 Emerald · Vault");
  });

  it("returns null for empty manifests", () => {
    assert.equal(markManifestAsCollection(null), null);
  });
});
