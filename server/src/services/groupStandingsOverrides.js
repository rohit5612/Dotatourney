import { resolveGroupStageConfig } from "./engineGroupConfig.js";
import { computeBlastPlaceholderToTeamMap } from "./blastSeeding.js";
import {
  getQualifierSeedingOverrides,
  mergeQualifierSeedingOverrides,
  parseBlastGroupSlotLetter,
  stripGroupStandingsOverrides,
} from "./blastQualifierSeeding.js";
import { buildGroupedStandings } from "./standingsEngine.js";

/** @param {object[]} groupedStandings */
export function sortGroupedStandingsForEngine(groupedStandings, engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig || {});
  const order = new Map(plan.groupKeys.map((key, index) => [`Group ${key}`, index]));
  return [...(groupedStandings || [])].sort(
    (a, b) => (order.get(a.label) ?? 99) - (order.get(b.label) ?? 99),
  );
}

/**
 * Reorder group table rows to match manual rank assignments.
 * @param {object[]} groupedStandings
 * @param {Record<string, string>} effectiveMap
 */
export function applyGroupStandingsOverrides(groupedStandings, effectiveMap) {
  if (!effectiveMap || !Object.keys(effectiveMap).length) return groupedStandings || [];

  return (groupedStandings || []).map((group) => {
    const labelMatch = String(group.label || "").match(/^Group ([A-H])$/i);
    if (!labelMatch) return group;
    const letter = labelMatch[1].toUpperCase();
    const rankTeams = [];
    for (let rank = 1; rank <= (group.rows?.length || 0); rank += 1) {
      const team = effectiveMap[`Group ${letter} #${rank}`];
      if (team) rankTeams.push(team);
    }
    if (!rankTeams.length) return group;

    const rowByTeam = new Map((group.rows || []).map((row) => [row.team, row]));
    const used = new Set();
    const rows = [];
    for (const team of rankTeams) {
      const row = rowByTeam.get(team);
      if (row) {
        rows.push(row);
        used.add(team);
      }
    }
    for (const row of group.rows || []) {
      if (!used.has(row.team)) rows.push(row);
    }
    return { ...group, rows };
  });
}

export function buildEffectiveGroupStandingsMap(teams, matches, engineConfig) {
  const overrides = stripGroupStandingsOverrides(getQualifierSeedingOverrides(engineConfig));
  const autoMap = computeBlastPlaceholderToTeamMap(teams, matches, null);
  return mergeQualifierSeedingOverrides(autoMap, overrides);
}

export function buildGroupedStandingsWithSeeding(teams, matches, format, engineConfig = null) {
  let grouped = buildGroupedStandings(teams, matches, format);
  if (format !== "blast") return grouped;

  grouped = sortGroupedStandingsForEngine(grouped, engineConfig);
  const effectiveMap = buildEffectiveGroupStandingsMap(teams, matches, engineConfig);
  if (!effectiveMap) return grouped;
  return applyGroupStandingsOverrides(grouped, effectiveMap);
}
