import { env } from "../config/env.js";

const DISCORD_AUTH = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_ME = "https://discord.com/api/users/@me";

export function discordAuthorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds.join",
    state,
  });
  return `${DISCORD_AUTH}?${params.toString()}`;
}

export async function exchangeDiscordCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = new Error("Discord token exchange failed");
    err.status = 400;
    throw err;
  }
  const token = await res.json();
  const meRes = await fetch(DISCORD_ME, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) {
    const err = new Error("Discord profile fetch failed");
    err.status = 400;
    throw err;
  }
  const user = await meRes.json();
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "";
  return {
    discordId: user.id,
    discordUsername: user.global_name || user.username || "",
    discordAvatarUrl: avatarUrl,
    accessToken: token.access_token,
  };
}

/**
 * Add a user to the configured BPC Discord guild using their OAuth access token.
 * Non-throwing: link flow should succeed even when join fails.
 * @returns {Promise<boolean>} true when joined or already a member
 */
export async function addUserToGuild({ discordUserId, accessToken }) {
  const guildId = env.discordGuildId;
  const botToken = env.discordBotToken;
  if (!guildId || !botToken || !discordUserId || !accessToken) {
    return false;
  }

  const res = await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (res.status === 201 || res.status === 204 || res.status === 409) {
    return true;
  }

  let detail = "";
  try {
    const body = await res.json();
    detail = body?.message || JSON.stringify(body);
  } catch {
    detail = await res.text().catch(() => "");
  }
  console.warn(
    `[discord] guild join failed for user ${discordUserId} (status ${res.status})${detail ? `: ${detail}` : ""}`,
  );
  return false;
}
