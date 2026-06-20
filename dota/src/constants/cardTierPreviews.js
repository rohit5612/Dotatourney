/** Shared tier order and screenshot preview paths (checkout + What's New). */

export const CARD_TIER_ORDER = ["default", "player", "gold", "holo"];

export const CARD_TIER_PREVIEW_IMAGES = {
  default: "/cards/previews/default.png",
  player: "/cards/previews/player.png",
  gold: "/cards/previews/gold.png",
  holo: "/cards/previews/holo.png",
};

export const CARD_TIER_PREVIEW_LABELS = {
  default: "Default BPC card preview",
  player: "Player BPC card preview",
  gold: "Gold BPC card preview",
  holo: "Holo BPC card preview",
};

/** Feature comparison rows — column 0 labels; tier columns show tick when true. */
export const CARD_TIER_COMPARISON_FEATURES = [
  {
    label: "Season registration",
    tiers: { default: true, player: true, gold: true, holo: true },
  },
  {
    label: "League Stats on card",
    tiers: { default: false, player: true, gold: true, holo: true },
  },
  {
    label: "Custom logo slot",
    tiers: { default: false, player: false, gold: true, holo: true },
  },
  
  {
    label: "Enhanced public profile",
    tiers: { default: false, player: false, gold: true, holo: true },
  },
  {
    label: "BPC coins grant on placements**",
    tiers: { default: false, player: false, gold: true, holo: true },
  },
  {
    label: "Custom avatar / animated gif",
    tiers: { default: false, player: false, gold: false, holo: true },
  },
  {
    label: "Custom stats on card",
    tiers: { default: false, player: false, gold: false, holo: true },
  },
  {
    label: "Custom Discord role + perks",
    tiers: { default: false, player: false, gold: false, holo: true },
  },
  {
    label: "Special Shoutout on Livestreams",
    tiers: { default: false, player: false, gold: false, holo: true },
  },
  
];
