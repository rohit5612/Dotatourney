/** In-memory logo preload cache — avoids re-fetching when schedule/teams re-render. */

import { buildTeamSetupLookup, resolveTeamLogoFromSetup } from "./teamPage.js";

const loaded = new Set();
const failed = new Set();
const inflight = new Map();

export function normalizeTeamLogoUrl(url) {
  const trimmed = String(url || "").trim();
  return trimmed || null;
}

export function isTeamLogoCached(url) {
  const key = normalizeTeamLogoUrl(url);
  return key ? loaded.has(key) : false;
}

export function markTeamLogoCached(url) {
  const key = normalizeTeamLogoUrl(url);
  if (key) loaded.add(key);
}

export function markTeamLogoFailed(url) {
  const key = normalizeTeamLogoUrl(url);
  if (key) failed.add(key);
}

export function preloadTeamLogo(url) {
  const key = normalizeTeamLogoUrl(url);
  if (!key) return Promise.resolve(false);
  if (loaded.has(key)) return Promise.resolve(true);
  if (failed.has(key)) return Promise.resolve(false);
  if (inflight.has(key)) return inflight.get(key);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loaded.add(key);
      inflight.delete(key);
      resolve(true);
    };
    img.onerror = () => {
      failed.add(key);
      inflight.delete(key);
      resolve(false);
    };
    img.src = key;
  });

  inflight.set(key, promise);
  return promise;
}

export function preloadTeamLogos(urls) {
  const unique = [...new Set((urls || []).map(normalizeTeamLogoUrl).filter(Boolean))];
  if (!unique.length) return Promise.resolve([]);
  return Promise.all(unique.map(preloadTeamLogo));
}

export function collectTeamLogoUrls(teams, setupTeams) {
  const lookup = setupTeams?.length ? buildTeamSetupLookup(setupTeams) : null;
  const urls = new Set();

  for (const team of teams || []) {
    const raw = lookup ? resolveTeamLogoFromSetup(team, lookup) : team.logoUrl || team.logo_url || "";
    const url = normalizeTeamLogoUrl(raw);
    if (url) urls.add(url);
  }

  for (const team of setupTeams || []) {
    const url = normalizeTeamLogoUrl(team.logoUrl || team.logo_url || "");
    if (url) urls.add(url);
  }

  return [...urls];
}
