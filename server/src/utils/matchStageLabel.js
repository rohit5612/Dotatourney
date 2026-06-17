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

function isBlastPlayInCrossMatch(match) {
  const stageKey = match?.stageKey || match?.stage_key || "";
  if (stageKey !== "blast-playin") return false;
  const meta = parseMeta(match?.meta);
  return meta.seriesRuleKey === "blast-playin-cross";
}

/** Human-readable stage label for public match history (BLAST-aware). */
export function formatPublicMatchStageLabel(match) {
  if (!match) return "Match";

  const meta = parseMeta(match.meta);
  const seriesRuleKey = String(meta.seriesRuleKey || "").trim();
  if (seriesRuleKey && SERIES_RULE_LABELS[seriesRuleKey]) {
    return SERIES_RULE_LABELS[seriesRuleKey];
  }

  const stageKey = String(match.stageKey || match.stage_key || "").trim();
  const roundIndex = Number(match.roundIndex ?? match.round_index ?? 0);

  if (/^blast-group-/i.test(stageKey)) return "Group Stage";
  if (stageKey === "blast-lastchance") return "Last Chance";
  if (stageKey === "blast-playin") {
    return isBlastPlayInCrossMatch(match) ? "Crossover" : "Play-In";
  }
  if (stageKey === "blast-playoffs") {
    if (roundIndex >= 2) return "Finals";
    if (roundIndex === 1) return "Semifinals";
    return "Quarterfinals";
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
