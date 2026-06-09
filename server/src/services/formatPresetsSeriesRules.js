/** Minimal series rule maps for format presets (mirrors frontend tournament constants). */
export function buildDefaultSeriesRules(format, fallback = "bo3") {
  if (format === "blast") {
    return {
      "group-all": fallback,
      "upper-r1": fallback,
      "lower-all": fallback,
      quarterfinal: fallback,
      semifinal: fallback,
      final: fallback,
    };
  }
  if (format === "rr") {
    return { "rr-all": fallback };
  }
  if (format === "se") {
    return {
      "upper-r1": fallback,
      quarterfinal: fallback,
      semifinal: fallback,
      final: fallback,
    };
  }
  return {
    "upper-r1": fallback,
    "upper-r2": fallback,
    "lower-all": fallback,
    final: fallback,
  };
}
