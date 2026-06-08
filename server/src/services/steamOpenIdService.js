import { env } from "../config/env.js";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

export function steamLoginUrl(returnTo, realm) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

/** @param {Record<string, string>} query */
export async function verifySteamOpenIdCallback(query) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!text.includes("is_valid:true")) {
    const err = new Error("Steam OpenID verification failed");
    err.status = 400;
    throw err;
  }

  const claimed = query["openid.claimed_id"] || "";
  const match = claimed.match(/\/openid\/id\/(\d+)$/);
  if (!match) {
    const err = new Error("Invalid Steam identity");
    err.status = 400;
    throw err;
  }
  return match[1];
}

export async function fetchSteamProfile(steamId) {
  const key = env.steamApiKey;
  if (!key) {
    return {
      persona: "",
      avatarUrl: "",
      profile: `https://steamcommunity.com/profiles/${steamId}`,
    };
  }
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(steamId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return {
      persona: "",
      avatarUrl: "",
      profile: `https://steamcommunity.com/profiles/${steamId}`,
    };
  }
  const json = await res.json();
  const player = json?.response?.players?.[0];
  return {
    persona: player?.personaname || "",
    avatarUrl: player?.avatarfull || player?.avatarmedium || "",
    profile: player?.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
  };
}
