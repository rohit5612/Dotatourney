import {
  canonicalPlayoffSeriesRuleKey,
  isPlayoffStageKey,
} from "../services/playoffRoundUtils.js";

const SERIES_RULE_LABELS = {
  "blast-po-final": "Finals",
  "blast-po-semifinal": "Semifinals",
  "blast-po-quarterfinal": "Quarterfinals",
  "blast-lc-quarterfinal": "Last Chance",
  "blast-lc-semifinal": "Last Chance",
  "blast-lc-final": "Last Chance",
  "blast-lc-round": "Last Chance",
  "blast-mp-semifinal": "Play-In",
  "blast-playin-cross": "Crossover",
  "blast-playin-semifinal": "Play-In",
  "blast-group-bo1": "Group Stage",
};

function parseMeta(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeMatchForStageLabel(match) {
  return {
    stageKey: String(match?.stageKey || match?.stage_key || "").trim(),
    roundIndex: match?.roundIndex ?? match?.round_index ?? 0,
    matchIndex: match?.matchIndex ?? match?.match_index ?? 0,
    meta: parseMeta(match?.meta),
  };
}

function isBlastPlayInCrossMatch(match) {
  const stageKey = match?.stageKey || match?.stage_key || "";
  if (stageKey !== "blast-playin") return false;
  const meta = parseMeta(match?.meta);
  return meta.seriesRuleKey === "blast-playin-cross" || meta.presentationSeriesRuleKey === "blast-playin-cross";
}

function playoffLabelFromContext(match, allMatches) {
  const normalized = normalizeMatchForStageLabel(match);
  if (!isPlayoffStageKey(normalized.stageKey) || !allMatches?.length) return null;
  const context = allMatches.map(normalizeMatchForStageLabel);
  const ruleKey = canonicalPlayoffSeriesRuleKey(normalized, context);
  return ruleKey && SERIES_RULE_LABELS[ruleKey] ? SERIES_RULE_LABELS[ruleKey] : null;
}

/** Human-readable stage label for public match history (BLAST-aware). */
export function formatPublicMatchStageLabel(match, allMatches = null) {
  if (!match) return "Match";

  const meta = parseMeta(match.meta);
  const stageKey = String(match.stageKey || match.stage_key || "").trim();

  const playoffLabel = playoffLabelFromContext(match, allMatches);
  if (playoffLabel) return playoffLabel;

  const presentationRule = String(meta.presentationSeriesRuleKey || "").trim();
  if (presentationRule && SERIES_RULE_LABELS[presentationRule]) {
    return SERIES_RULE_LABELS[presentationRule];
  }

  const seriesRuleKey = String(meta.seriesRuleKey || "").trim();
  if (seriesRuleKey && SERIES_RULE_LABELS[seriesRuleKey] && !isPlayoffStageKey(stageKey)) {
    return SERIES_RULE_LABELS[seriesRuleKey];
  }

  if (/^blast-group-/i.test(stageKey)) return "Group Stage";
  if (stageKey === "blast-lastchance") return "Last Chance";
  if (stageKey === "blast-playin") {
    return isBlastPlayInCrossMatch(match) ? "Crossover" : "Play-In";
  }

  if (stageKey) {
    return stageKey
      .replace(/^blast-/, "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return "Match";
}
