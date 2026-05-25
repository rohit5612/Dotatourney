import { describeBracketToken } from "../components/bracket/MatchCard.jsx";

const BRACKET_TOKEN = /^[A-Z0-9_]+$/;

/** Whether a team slot string is an unresolved bracket placeholder (not a real team name). */
export function isBracketPlaceholderToken(name) {
  const text = String(name || "").trim();
  if (!text) return false;
  if (/^Group [A-Z] #\d+$/.test(text)) return true;
  if (!BRACKET_TOKEN.test(text)) return false;
  if (/^(CHAMPION|UBW|UBL|LBW|HUF|HLF)$/.test(text)) return true;
  if (/\d/.test(text)) return true;
  if (/^(LCR|PIR|QFR|SFR|LCH|PIN|MID|CRS|MAIN|BLC|BPI|BLR)/.test(text)) return true;
  return false;
}

/** Source elimination match whose outcome resolves a win/loser token. */
export function findFeederMatchForToken(token, matches) {
  const text = String(token || "").trim();
  if (!text || (!text.endsWith("W") && !text.endsWith("L"))) return null;
  const winToken = text.endsWith("L") ? text.replace(/L$/, "W") : text;
  return (matches || []).find((match) => match.meta?.winToken === winToken) || null;
}

function formatMatchup(team1, team2) {
  const left = String(team1 || "TBD").trim() || "TBD";
  const right = String(team2 || "TBD").trim() || "TBD";
  return `${left} vs ${right}`;
}

function enrichWithFeederContext(token, base, matches) {
  const feeder = findFeederMatchForToken(token, matches);
  if (!feeder) return base;

  const isLoser = String(token).endsWith("L");
  const winner = feeder.winner;
  const team1 = feeder.team1;
  const team2 = feeder.team2;

  if (winner) {
    const outcome = isLoser ? (winner === team1 ? team2 : team1) : winner;
    const matchup = formatMatchup(team1, team2);
    const role = isLoser ? "Loser" : "Winner";
    return `${base} ${role}: ${outcome} (from ${matchup}).`;
  }

  return `${base} Decided by ${formatMatchup(team1, team2)}.`;
}

/**
 * Tooltip for bracket placeholders on public schedule/bracket views.
 * @param {string} name
 * @param {object[]} matches
 * @param {{ blastBracketDepths?: { lc?: number, pi?: number }, blastVariant?: string|null }} [options]
 */
export function buildBracketTokenHelp(name, matches, options = {}) {
  if (!isBracketPlaceholderToken(name)) return "";
  const { blastBracketDepths, blastVariant } = options;
  const base =
    describeBracketToken(name, blastBracketDepths, blastVariant) ||
    `${name}: bracket slot — fills when earlier matches finish.`;
  return enrichWithFeederContext(name, base, matches);
}
