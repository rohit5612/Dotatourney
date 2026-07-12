import { resolvePublicTeamLogo } from "./teamLogoUrl.js";

const ROLE_ORDER = ["Carry", "Mid", "Offlane", "Soft support", "Hard support"];

export { ROLE_ORDER };

const REGIONS = ["South Asia", "SEA", "Middle East", "Europe", "Oceania"];

function isBlastGroupStageKey(stageKey) {
  return /^blast-group-[a-h]$/i.test(stageKey || "");
}

function hashString(value) {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeRole(role) {
  const raw = String(role || "").trim();
  if (!raw) return "Player";
  const lower = raw.toLowerCase();
  if (lower.includes("carry") && !lower.includes("hard")) return "Carry";
  if (lower === "mid" || lower.includes("mid")) return "Mid";
  if (lower.includes("off")) return "Offlane";
  if (lower.includes("hard") || lower.includes("5")) return "Hard support";
  if (lower.includes("soft") || lower.includes("4")) return "Soft support";
  return raw;
}

export { normalizeRole };

export function displayRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === "Soft support") return "Soft Support";
  if (normalized === "Hard support") return "Hard Support";
  return normalized;
}

export function sortPlayersByRole(players) {
  const list = [...(players || [])];
  const roleRank = (player) => {
    const roles = getPlayerRoles(player);
    if (!roles.length) return 99;
    return Math.min(...roles.map((role) => {
      const index = ROLE_ORDER.indexOf(role);
      return index === -1 ? 99 : index;
    }));
  };
  return list.sort((a, b) => {
    const captainA = Boolean(a.isCaptain) ? 0 : 1;
    const captainB = Boolean(b.isCaptain) ? 0 : 1;
    if (captainA !== captainB) return captainA - captainB;
    return roleRank(a) - roleRank(b);
  });
}

export function sortRolesByDefault(roles) {
  const list = [...new Set((roles || []).map((role) => normalizeRole(role)).filter((role) => role && role !== "Player"))];
  return list.sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a);
    const bi = ROLE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function getPlayerRoles(player) {
  const raw = player?.roles?.length ? player.roles : player?.role ? [player.role] : [];
  return sortRolesByDefault(raw);
}

export function primaryPlayerRole(player) {
  const roles = getPlayerRoles(player);
  return roles[0] || normalizeRole(player?.role) || "Player";
}

export function playerDisplayName(player) {
  return (
    String(player?.displayName || player?.display_name || "").trim() ||
    String(player?.steamName || player?.steam_name || "").trim() ||
    String(player?.name || "").trim() ||
    "Player"
  );
}

export function playerProfileSlug(player) {
  const slug = String(player?.slug || player?.playerSlug || player?.player_slug || "").trim();
  return slug || null;
}

export function registrationDisplayName(registration) {
  return (
    String(registration?.displayName || registration?.display_name || "").trim() ||
    String(registration?.steamName || registration?.steam_name || "").trim() ||
    String(registration?.name || "").trim() ||
    "Player"
  );
}

export function isBlastGroupMatch(match) {
  return isBlastGroupStageKey(match?.stageKey);
}

export function blastGroupMatches(matches) {
  return (matches || []).filter(isBlastGroupMatch);
}

function parseGroupLetterFromLabel(label) {
  const match = /group\s*([a-h])/i.exec(String(label || ""));
  return match ? match[1].toUpperCase() : null;
}

export { parseGroupLetterFromLabel };

export function groupLabelSortRank(label) {
  const letter = parseGroupLetterFromLabel(label);
  if (letter) return letter.charCodeAt(0) - 65;
  return 99;
}

function formatGroupKeyLabel(groupKey) {
  const key = String(groupKey || "").trim();
  if (!key) return null;
  if (/^group\s+[a-h]$/i.test(key)) {
    const letter = parseGroupLetterFromLabel(key);
    return letter ? `Group ${letter}` : key;
  }
  if (/^[a-h]$/i.test(key)) return `Group ${key.toUpperCase()}`;
  return key;
}

export function getTeamGroupLabel(teamName, groupedStandings) {
  for (const group of groupedStandings || []) {
    if (group.rows?.some((row) => row.team === teamName)) {
      return group.label || null;
    }
  }
  return null;
}

export function getTeamGroupStatsRow(teamName, groupedStandings) {
  for (const group of groupedStandings || []) {
    const row = group.rows?.find((entry) => entry.team === teamName);
    if (row) {
      return { row, groupLabel: group.label };
    }
  }
  return null;
}

export function getTeamStandingsRow(teamName, standings) {
  return (standings || []).find((row) => row.team === teamName) || null;
}

export function getTeamStandingLabel(teamName, standings, groupedStandings, format) {
  const groupStanding = (group) => {
    const groupIdx = group.rows?.findIndex((row) => row.team === teamName);
    if (groupIdx < 0) return null;
    const letter = parseGroupLetterFromLabel(group.label);
    if (letter) return `Group ${letter} · #${groupIdx + 1}`;
    return `#${groupIdx + 1}`;
  };

  if (format === "blast") {
    for (const group of groupedStandings || []) {
      const label = groupStanding(group);
      if (label) return label;
    }

    const globalIdx = (standings || []).findIndex((row) => row.team === teamName);
    if (globalIdx >= 0) return `#${globalIdx + 1} global`;
    return "TBD";
  }

  const overall = standings || [];
  const overallIdx = overall.findIndex((row) => row.team === teamName);
  if (overallIdx >= 0 && overall.length > 1) {
    return `#${overallIdx + 1} overall`;
  }
  if (overallIdx >= 0) {
    return "#1";
  }

  for (const group of groupedStandings || []) {
    const label = groupStanding(group);
    if (label) return label;
  }

  return "TBD";
}

export function deriveRegion(team, players) {
  const fromPlayer = (players || []).map((p) => p.location).find((loc) => String(loc || "").trim());
  if (fromPlayer) {
    const part = String(fromPlayer).split(",")[0]?.trim();
    if (part) return part;
  }
  return REGIONS[hashString(team.id || team.name) % REGIONS.length];
}

export function getRecentForm(teamName, matches, limit = 5) {
  const results = (matches || [])
    .filter((match) => match.winner && (match.team1 === teamName || match.team2 === teamName))
    .map((match) => (match.winner === teamName ? "W" : "L"));
  return results.slice(-limit);
}

export function isTeamLive(teamName, schedule, matches) {
  for (const slot of schedule || []) {
    if (slot.status !== "live") continue;
    const match = (matches || []).find((entry) => entry.id === slot.matchId);
    if (match && (match.team1 === teamName || match.team2 === teamName)) return true;
  }
  return false;
}

/** Lookup logos/accent from admin team setup (by source team id or name). */
export function buildTeamSetupLookup(setupTeams) {
  const logosById = new Map();
  const logosByName = new Map();
  const accentsById = new Map();
  const accentsByName = new Map();

  for (const team of setupTeams || []) {
    const logo = resolvePublicTeamLogo(team.logoUrl || team.logo_url || "");
    const accent = String(team.accentColor || team.accent_color || "").trim();
    if (team.id) {
      if (logo) logosById.set(team.id, logo);
      if (accent) accentsById.set(team.id, accent);
    }
    const nameKey = String(team.name || "").trim().toLowerCase();
    if (nameKey) {
      if (logo) logosByName.set(nameKey, logo);
      if (accent) accentsByName.set(nameKey, accent);
    }
  }

  return { logosById, logosByName, accentsById, accentsByName };
}

export function resolveTeamLogoFromSetup(team, setupTeamsOrLookup) {
  const direct = String(team?.logoUrl || team?.logo_url || "").trim();
  const lookup = setupTeamsOrLookup?.logosById
    ? setupTeamsOrLookup
    : buildTeamSetupLookup(setupTeamsOrLookup);
  const fromSetup =
    lookup.logosById.get(team?.sourceTeamId) ||
    lookup.logosByName.get(String(team?.name || "").trim().toLowerCase()) ||
    "";

  return resolvePublicTeamLogo(direct, fromSetup);
}

export function resolveTeamAccentFromSetup(team, setupTeamsOrLookup) {
  const direct = String(team?.accentColor || team?.accent_color || "").trim();
  if (direct) return direct;

  const lookup = setupTeamsOrLookup?.accentsById
    ? setupTeamsOrLookup
    : buildTeamSetupLookup(setupTeamsOrLookup);

  return (
    lookup.accentsById.get(team?.sourceTeamId) ||
    lookup.accentsByName.get(String(team?.name || "").trim().toLowerCase()) ||
    ""
  );
}

export function applyTeamSetupAssets(team, setupTeamsOrLookup) {
  const logoUrl = resolveTeamLogoFromSetup(team, setupTeamsOrLookup);
  const accentColor = resolveTeamAccentFromSetup(team, setupTeamsOrLookup);
  return {
    ...team,
    ...(logoUrl ? { logoUrl, logo_url: logoUrl } : {}),
    ...(accentColor ? { accentColor, accent_color: accentColor } : {}),
  };
}

export function enrichTeam(team, context) {
  const { standings, groupedStandings, matches, schedule, format, setupTeams, honors } = context;
  const base = setupTeams ? applyTeamSetupAssets(team, setupTeams) : team;
  const isBlast = format === "blast";
  const players = sortPlayersByRole(base.players || []);
  const groupEntry = isBlast ? getTeamGroupStatsRow(base.name, groupedStandings) : null;
  const statsRow =
    isBlast && groupEntry ? groupEntry.row : getTeamStandingsRow(base.name, standings);
  const formMatches = isBlast ? blastGroupMatches(matches) : matches;
  const played = statsRow?.played ?? 0;
  const wins = statsRow?.wins ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null;
  const group =
    getTeamGroupLabel(base.name, groupedStandings) ||
    formatGroupKeyLabel(base.groupKey || base.group_key) ||
    null;

  return {
    ...base,
    players,
    group,
    region: deriveRegion(base, players),
    stats: {
      winRate,
      played,
      wins,
      losses: statsRow?.losses ?? 0,
      standing: getTeamStandingLabel(base.name, standings, groupedStandings, format),
    },
    form: getRecentForm(base.name, formMatches),
    isLive: isTeamLive(base.name, schedule, matches),
    bracketBadge: honors?.badgesByTeam?.[base.name] || null,
  };
}

export function playerInitials(name) {
  const label = typeof name === "string" ? name : playerDisplayName(name);
  return String(label || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function teamInitials(team) {
  return (team.abbr || team.name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/** Case-insensitive team lookup by display name (matches use team names, not ids). */
export function buildTeamNameLookup(teams, setupTeams) {
  const map = new Map();
  const setupLookup = setupTeams?.length ? buildTeamSetupLookup(setupTeams) : null;
  for (const team of teams || []) {
    const name = String(team.name || "").trim();
    if (!name) continue;
    const resolved = setupLookup ? applyTeamSetupAssets(team, setupLookup) : team;
    map.set(name.toLowerCase(), resolved);
  }
  return map;
}

export function findTeamByName(lookup, name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;
  return lookup?.get(key) ?? null;
}

function compareByOverallRank(a, b, overallRank) {
  const ra = overallRank.get(a) ?? Number.MAX_SAFE_INTEGER;
  const rb = overallRank.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/**
 * After the final, order by bracket placement (champion → runner-up → SF → QF → …).
 * Teams missing from placement data fall back to badge depth, then seed.
 */
function orderTeamsByTournamentPlacement(teams, honors) {
  const byName = new Map((teams || []).map((team) => [team.name, team]));
  const placementTeams = honors?.placementTeams || [];
  const ordered = [];
  const seen = new Set();

  for (const entry of placementTeams) {
    const team = byName.get(entry.teamName);
    if (!team || seen.has(team.name)) continue;
    seen.add(team.name);
    ordered.push(team);
  }

  const remainder = (teams || []).filter((team) => !seen.has(team.name));
  remainder.sort((a, b) => {
    const depthA = honors?.badgesByTeam?.[a.name]?.depth ?? 0;
    const depthB = honors?.badgesByTeam?.[b.name]?.depth ?? 0;
    if (depthA !== depthB) return depthB - depthA;
    return (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER);
  });

  return [...ordered, ...remainder];
}

/**
 * Teams page: group-tier order while the event is live; bracket placement once the final has a winner.
 */
export function orderTeamsForTeamsPage(teams, { standings = [], groupedStandings = [], honors } = {}) {
  if (honors?.finalFinished && honors?.placementTeams?.length) {
    return orderTeamsByTournamentPlacement(teams, honors);
  }

  const list = teams || [];
  const byName = new Map(list.map((team) => [team.name, team]));
  const orderedNames = [];
  const seen = new Set();

  const pushName = (name) => {
    const key = String(name || "").trim();
    if (!key || seen.has(key) || !byName.has(key)) return;
    seen.add(key);
    orderedNames.push(key);
  };

  const overallRank = new Map();
  for (const [idx, row] of (standings || []).entries()) {
    const key = String(row.team || "").trim();
    if (key) overallRank.set(key, idx);
  }

  const groups = [...(groupedStandings || [])].sort((a, b) => {
    const ra = groupLabelSortRank(a.label || "");
    const rb = groupLabelSortRank(b.label || "");
    if (ra !== rb) return ra - rb;
    return String(a.label || "").localeCompare(String(b.label || ""));
  });

  const maxTier = groups.reduce((max, group) => Math.max(max, group.rows?.length || 0), 0);

  for (let tier = 0; tier < maxTier; tier += 1) {
    const tierTeams = [];
    for (const group of groups) {
      const name = group.rows?.[tier]?.team;
      if (name) tierTeams.push(String(name).trim());
    }
    tierTeams.sort((a, b) => compareByOverallRank(a, b, overallRank));
    for (const name of tierTeams) {
      pushName(name);
    }
  }

  for (const row of standings || []) {
    pushName(row.team);
  }

  const fallback = [...list].sort(
    (a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER),
  );
  for (const team of fallback) {
    pushName(team.name);
  }

  return orderedNames.map((name) => byName.get(name)).filter(Boolean);
}

export function squadCountLabel(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "Squads will enter the battlefield.";
  if (n === 1) return "One squad enters the battlefield.";
  return `${n} squads enter the battlefield.`;
}
