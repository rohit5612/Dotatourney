import { buildBlastSeriesRules } from "./blastSeriesRules.js";
import { buildDefaultSeriesRules } from "./formatPresetsSeriesRules.js";

/**
 * Tournament format presets for admin setup wizard (Phase 6).
 * Maps preset id → generator parameters without changing existing BLAST logic.
 */
export const FORMAT_PRESETS = {
  "BLAST-12": {
    id: "BLAST-12",
    label: "BLAST — 12 teams",
    format: "blast",
    teamCount: 12,
    groupCount: 2,
    seriesType: "bo3",
    description: "Two groups of six, double elimination style BLAST format.",
  },
  "BLAST-10": {
    id: "BLAST-10",
    label: "BLAST — 10 teams",
    format: "blast",
    teamCount: 10,
    groupCount: 2,
    seriesType: "bo3",
    description: "Two groups of five.",
  },
  "SE-8": {
    id: "SE-8",
    label: "Single elimination — 8 teams",
    format: "se",
    teamCount: 8,
    groupCount: 1,
    seriesType: "bo3",
    description: "Classic 8-team single elimination bracket.",
  },
  "RR-6": {
    id: "RR-6",
    label: "Round robin — 6 teams",
    format: "rr",
    teamCount: 6,
    groupCount: 1,
    seriesType: "bo2",
    description: "Six teams, everyone plays everyone.",
  },
  DSE: {
    id: "DSE",
    label: "Double elimination — 8 teams",
    format: "dse",
    teamCount: 8,
    groupCount: 1,
    seriesType: "bo3",
    description: "Upper/lower bracket double elimination.",
  },
};

export function listFormatPresets() {
  return Object.values(FORMAT_PRESETS);
}

export function resolveFormatPreset(presetId) {
  const key = String(presetId || "").trim();
  const preset = FORMAT_PRESETS[key] || FORMAT_PRESETS[key.toUpperCase()];
  if (!preset) return null;
  const seriesRules =
    preset.format === "blast"
      ? buildBlastSeriesRules(preset.teamCount, preset.seriesType)
      : buildDefaultSeriesRules(preset.format, preset.seriesType);
  return {
    ...preset,
    seriesRules,
  };
}

export function applyPresetToSetup(setup, presetId) {
  const preset = resolveFormatPreset(presetId);
  if (!preset) return setup;
  return {
    ...setup,
    format: preset.format,
    teamCount: preset.teamCount,
    seriesType: preset.seriesType,
    seriesRules: preset.seriesRules,
    formatPreset: preset.id,
    groupCount: preset.groupCount,
  };
}
