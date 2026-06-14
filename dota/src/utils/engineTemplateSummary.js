const STAGE_TYPE_LABELS = {
  group_round_robin: "Groups",
  last_chance: "Last chance",
  play_in: "Play-in",
  crossover: "Crossover",
  single_elimination: "Single elim",
  double_elimination: "Double elim",
  round_robin: "Round robin",
};

const SEEDING_LABELS = {
  manual: "Manual groups",
  seed_order: "Seed order",
  random: "Random draw",
  snake: "Snake draft",
};

export function summarizeEngineConfig(config) {
  if (!config || typeof config !== "object") return null;
  const teamCount = config.teamCount ?? config.team_count;
  const stages = Array.isArray(config.stages) ? config.stages : [];
  const stageLabels = stages
    .map((stage) => stage.label || STAGE_TYPE_LABELS[stage.type] || stage.type)
    .filter(Boolean);
  const parts = [];
  if (teamCount) parts.push(`${teamCount} teams`);
  const groupStage = config.groupStage;
  if (groupStage?.enabled) {
    parts.push(`${groupStage.groupCount || 2} groups · ${SEEDING_LABELS[groupStage.seedingMode] || groupStage.seedingMode}`);
  }
  if (stageLabels.length) parts.push(stageLabels.join(" → "));
  else if (config.format) parts.push(String(config.format).toUpperCase());
  return parts.length ? parts.join(" · ") : null;
}

export function formatLabelForTemplate(template) {
  if (!template) return "No format selected";
  const fromConfig = summarizeEngineConfig(template.config);
  return fromConfig ? `${template.label} (${fromConfig})` : template.label;
}
