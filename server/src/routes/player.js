import express from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  createPlayerSession,
  deletePlayerSession,
  loginPlayer,
  registerPlayerWithPassword,
  requirePlayer,
  resetPlayerPassword,
  requestPasswordReset,
  upsertPlayerFromOAuth,
  verifyPlayerEmail,
  resendPlayerEmailVerification,
  playerMeWithCoins,
} from "../services/playerAuthService.js";
import {
  findAccountBySteamId,
  findAccountByDiscordId,
  recordAccountLink,
  updatePlayerAccount,
} from "../services/playerAccountRepository.js";
import { createOAuthState, parseOAuthState } from "../services/oauthStateService.js";
import { steamLoginUrl, verifySteamOpenIdCallback, fetchSteamProfile } from "../services/steamOpenIdService.js";
import { discordAuthorizeUrl, exchangeDiscordCode } from "../services/discordOAuthService.js";
import { googleAuthorizeUrl, exchangeGoogleCode } from "../services/googleOAuthService.js";
import {
  sendPlayerEmailVerificationEmail,
  sendPlayerPasswordResetEmail,
} from "../services/emailService.js";
import { getPlayerSessionAccount } from "../services/playerAuthService.js";

const router = express.Router();

function apiBase() {
  return String(env.apiPublicUrl || `http://localhost:${env.port}`).replace(/\/$/, "");
}

function frontendUrl(path) {
  return `${env.appUrl.replace(/\/$/, "")}${path}`;
}

function redirectWithToken(res, token) {
  return res.redirect(`${frontendUrl("/auth/callback")}?token=${encodeURIComponent(token)}`);
}

function redirectWithError(res, message) {
  return res.redirect(`${frontendUrl("/auth/callback")}?error=${encodeURIComponent(message)}`);
}

async function bearerAccount(req) {
  const header = req.get("authorization") || "";
  const queryToken = String(req.query.access_token || "");
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : queryToken;
  return getPlayerSessionAccount(token);
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(80).optional().default(""),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/register", async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const { account, verifyToken } = await registerPlayerWithPassword(payload);
    const verifyUrl = `${frontendUrl("/verify-email")}?token=${encodeURIComponent(verifyToken)}&email=${encodeURIComponent(account.email)}`;
    await sendPlayerEmailVerificationEmail({ to: account.email, verifyUrl, displayName: account.display_name });
    res.status(201).json({
      message: "Account created. Check your email to verify before signing in.",
      email: account.email,
      ...(env.emailSkipSend ? { devVerifyUrl: verifyUrl } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/verify-email", async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ message: "Missing verification token" });
    const email = String(req.query.email || "");
    const account = await verifyPlayerEmail(token, { email });
    const session = await createPlayerSession(account.id);
    res.json({
      message: "Email verified successfully",
      token: session.token,
      expiresAt: session.expiresAt,
      account: { bpcId: account.bpc_id, slug: account.slug },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/resend-verification", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const result = await resendPlayerEmailVerification(email);
    if (!result) {
      return res.json({ message: "If that email exists, a new verification link was sent." });
    }
    const verifyUrl = `${frontendUrl("/verify-email")}?token=${encodeURIComponent(result.verifyToken)}&email=${encodeURIComponent(result.account.email)}`;
    await sendPlayerEmailVerificationEmail({
      to: result.account.email,
      verifyUrl,
      displayName: result.account.display_name,
    });
    res.json({
      message: "Verification email sent.",
      ...(env.emailSkipSend ? { devVerifyUrl: verifyUrl } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const { account, session } = await loginPlayer(payload);
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      account: {
        bpcId: account.bpc_id,
        slug: account.slug,
        email: account.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", requirePlayer, async (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    await deletePlayerSession(token);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requirePlayer, async (req, res, next) => {
  try {
    const payload = await playerMeWithCoins(req.playerAccount);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requirePlayer, async (req, res, next) => {
  try {
    const schema = z.object({
      displayName: z.string().min(1).max(80).optional(),
      phoneNumber: z.string().max(32).optional(),
      bio: z.string().max(500).optional(),
    });
    const payload = schema.parse(req.body);
    const account = await updatePlayerAccount(req.playerAccount.id, {
      displayName: payload.displayName,
      phoneNumber: payload.phoneNumber,
      bio: payload.bio,
    });
    const me = await playerMeWithCoins(account);
    res.json(me);
  } catch (error) {
    next(error);
  }
});

router.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const result = await requestPasswordReset(email);
    if (result) {
      const resetUrl = `${frontendUrl("/reset-password")}?token=${encodeURIComponent(result.resetToken)}`;
      await sendPlayerPasswordResetEmail({ to: result.account.email, resetUrl });
      if (env.emailSkipSend) {
        return res.json({ message: "If that email exists, a reset link was sent.", devResetUrl: resetUrl });
      }
    }
    res.json({ message: "If that email exists, a reset link was sent." });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const payload = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(req.body);
    const account = await resetPlayerPassword(payload.token, payload.password);
    const session = await createPlayerSession(account.id);
    res.json({
      message: "Password updated",
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

// --- Google (login or signup) ---

router.get("/auth/google/start", async (req, res, next) => {
  try {
    if (!env.googleClientId) {
      return res.status(503).json({ message: "Google login is not configured" });
    }
    const mode = req.query.intent === "signup" ? "signup" : "login";
    const state = createOAuthState({ provider: "google", mode });
    const redirectUri = `${apiBase()}/api/player/auth/google/callback`;
    res.redirect(googleAuthorizeUrl(redirectUri, state));
  } catch (error) {
    next(error);
  }
});

router.get("/auth/google/callback", async (req, res, next) => {
  try {
    const state = parseOAuthState(req.query.state);
    if (!state || state.provider !== "google") {
      return redirectWithError(res, "Invalid OAuth state");
    }
    const code = String(req.query.code || "");
    if (!code) return redirectWithError(res, "Missing authorization code");

    const profile = await exchangeGoogleCode(code, `${apiBase()}/api/player/auth/google/callback`);
    const account = await upsertPlayerFromOAuth({
      email: profile.email,
      googleSub: profile.googleSub,
      displayName: profile.displayName,
      emailVerified: profile.emailVerified,
    });
    await recordAccountLink(account.id, "google", profile.googleSub);
    const session = await createPlayerSession(account.id);
    return redirectWithToken(res, session.token);
  } catch (error) {
    return redirectWithError(res, error.message || "Google sign-in failed");
  }
});

// --- Steam (link only; requires session) ---

router.get("/auth/steam/start", async (req, res, next) => {
  try {
    const account = await bearerAccount(req);
    if (!account) {
      return res.redirect(`${frontendUrl("/login")}?error=${encodeURIComponent("Sign in first to link Steam")}`);
    }
    const returnTo = `${apiBase()}/api/player/auth/steam/callback`;
    const realm = apiBase();
    const state = createOAuthState({ provider: "steam", mode: "link", accountId: account.id });
    const url = steamLoginUrl(`${returnTo}?state=${encodeURIComponent(state)}`, realm);
    res.redirect(url);
  } catch (error) {
    next(error);
  }
});

router.get("/auth/steam/callback", async (req, res, next) => {
  try {
    const state = parseOAuthState(req.query.state);
    if (!state || state.provider !== "steam" || state.mode !== "link" || !state.accountId) {
      return redirectWithError(res, "Invalid Steam link state");
    }
    const steamId = await verifySteamOpenIdCallback(req.query);
    const existing = await findAccountBySteamId(steamId);
    if (existing && existing.id !== state.accountId) {
      return redirectWithError(res, "This Steam account is already linked to another player");
    }
    const profile = await fetchSteamProfile(steamId);
    const account = await updatePlayerAccount(state.accountId, {
      steamId,
      steamPersona: profile.persona,
      steamAvatarUrl: profile.avatarUrl,
      steamProfile: profile.profile,
    });
    await recordAccountLink(account.id, "steam", steamId);
    const session = await createPlayerSession(account.id);
    return res.redirect(`${frontendUrl("/dashboard")}?linked=steam&token=${encodeURIComponent(session.token)}`);
  } catch (error) {
    return redirectWithError(res, error.message || "Steam link failed");
  }
});

// --- Discord (link only) ---

router.get("/auth/discord/start", async (req, res, next) => {
  try {
    if (!env.discordClientId) {
      return res.status(503).json({ message: "Discord linking is not configured" });
    }
    const account = await bearerAccount(req);
    if (!account) {
      return res.redirect(`${frontendUrl("/login")}?error=${encodeURIComponent("Sign in first to link Discord")}`);
    }
    const state = createOAuthState({ provider: "discord", mode: "link", accountId: account.id });
    const redirectUri = `${apiBase()}/api/player/auth/discord/callback`;
    res.redirect(discordAuthorizeUrl(redirectUri, state));
  } catch (error) {
    next(error);
  }
});

router.get("/auth/discord/callback", async (req, res, next) => {
  try {
    const state = parseOAuthState(req.query.state);
    if (!state || state.provider !== "discord" || state.mode !== "link" || !state.accountId) {
      return redirectWithError(res, "Invalid Discord link state");
    }
    const code = String(req.query.code || "");
    if (!code) return redirectWithError(res, "Missing authorization code");

    const profile = await exchangeDiscordCode(code, `${apiBase()}/api/player/auth/discord/callback`);
    const existing = await findAccountByDiscordId(profile.discordId);
    if (existing && existing.id !== state.accountId) {
      return redirectWithError(res, "This Discord account is already linked to another player");
    }
    const account = await updatePlayerAccount(state.accountId, {
      discordId: profile.discordId,
      discordUsername: profile.discordUsername,
      discordAvatarUrl: profile.discordAvatarUrl,
    });
    await recordAccountLink(account.id, "discord", profile.discordId);
    const session = await createPlayerSession(account.id);
    return res.redirect(`${frontendUrl("/dashboard")}?linked=discord&token=${encodeURIComponent(session.token)}`);
  } catch (error) {
    return redirectWithError(res, error.message || "Discord link failed");
  }
});

/** Public profile stub for Phase 1 */
router.get("/public/accounts/:slug", async (req, res, next) => {
  try {
    const { findAccountBySlug, publicPlayerAccount } = await import("../services/playerAccountRepository.js");
    const account = await findAccountBySlug(req.params.slug);
    if (!account) return res.status(404).json({ message: "Player not found" });
    res.json({ account: publicPlayerAccount(account), phase: "profile-v4" });
  } catch (error) {
    next(error);
  }
});

export default router;
