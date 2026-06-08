import { env } from "../config/env.js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleAuthorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = new Error("Google token exchange failed");
    err.status = 400;
    throw err;
  }
  const token = await res.json();
  const meRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) {
    const err = new Error("Google profile fetch failed");
    err.status = 400;
    throw err;
  }
  const user = await meRes.json();
  return {
    googleSub: user.sub,
    email: user.email,
    displayName: user.name || "",
    emailVerified: Boolean(user.email_verified),
  };
}
