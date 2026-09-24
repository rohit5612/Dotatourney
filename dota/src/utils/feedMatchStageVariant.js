/** Visual tier for public profile match feed cards (from stage label / stage key). */
export function resolveFeedMatchStageVariant(row) {
  const label = String(row?.stageLabel || "").toLowerCase();
  const key = String(row?.stageKey || "").toLowerCase();

  if (label.includes("semi") || key.includes("semi")) return "semifinal";
  if (label.includes("quarter") || key.includes("quarter")) return "quarterfinal";
  if (
    (label.includes("final") && !label.includes("semi") && !label.includes("quarter")) ||
    (/final/i.test(key) && !key.includes("semi") && !key.includes("quarter"))
  ) {
    return "finals";
  }
  if (label.includes("last chance") || key === "blast-lastchance" || key.includes("lastchance")) {
    return "last-chance";
  }
  if (
    label.includes("play-in") ||
    label.includes("play in") ||
    label.includes("crossover") ||
    key === "blast-playin"
  ) {
    return "play-in";
  }
  if (label.includes("group") || /^blast-group/.test(key)) return "group";
  return "default";
}

export function feedMatchStageClass(variant) {
  const tier = variant || "default";
  return `profile-feed__match-post--stage-${tier}`;
}
