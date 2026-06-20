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
  getPlayerSessionAccount,
  changePlayerPassword,
  startLegacyClaim,
  verifyLegacyClaim,
  setPasswordFromClaim,
} from "../services/playerAuthService.js";
import {
  findAccountById,
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
  sendPlayerClaimAccountEmail,
  sendPlayerEmailVerificationEmail,
  sendPlayerPasswordResetEmail,
  maybeSendPlayerWelcomeEmail,
} from "../services/emailService.js";
import {
  previewCheckout,
  confirmCheckout,
  getCheckoutOrderStatus,
  simulateManualPayment,
  createSubstituteSignup,
  upsertCardAsset,
  CARD_TIERS,
} from "../services/paymentService.js";
import {
  getPlayerCoinSummary,
  getPlayerTeamForAccount,
  getPlayerMatchesForAccount,
  getPlayerDashboardHistory,
  getUpcomingTournamentsForPlayer,
} from "../services/playerProfileService.js";
import {
  createSubstitutionRequest,
  cancelSubstitutionRequest,
} from "../services/matchSubstitutionService.js";
import {
  getUnreadNotificationCount,
  listPlayerNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/playerNotificationService.js";

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
  identifier: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(1),
}).refine((d) => d.identifier || d.email, { message: "identifier or email required" });

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
    try {
      await maybeSendPlayerWelcomeEmail(account);
    } catch (emailErr) {
      console.error("[email] welcome mail failed:", emailErr?.message || emailErr);
    }
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
      mmr: z.number().int().min(0).max(20000).nullable().optional(),
      preferredRoles: z.array(z.string().min(1)).optional(),
      location: z.string().max(120).optional(),
    });
    const payload = schema.parse(req.body);
    const patch = {
      displayName: payload.displayName,
      phoneNumber: payload.phoneNumber,
      bio: payload.bio,
      mmr: payload.mmr,
      preferredRoles: payload.preferredRoles,
      location: payload.location,
    };
    if (
      payload.mmr != null ||
      payload.preferredRoles?.length ||
      payload.location ||
      payload.displayName ||
      payload.phoneNumber
    ) {
      patch.profileCompletedAt = new Date().toISOString();
    }
    const account = await updatePlayerAccount(req.playerAccount.id, patch);
    const me = await playerMeWithCoins(account);
    res.json(me);
  } catch (error) {
    next(error);
  }
});

router.post("/me/change-password", requirePlayer, async (req, res, next) => {
  try {
    const payload = z
      .object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8),
      })
      .parse(req.body);
    const account = await changePlayerPassword(req.playerAccount, payload);
    res.json({ message: "Password updated", account: { bpcId: account.bpc_id } });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/claim/start", async (req, res, next) => {
  try {
    const { bpcId, email } = z
      .object({ bpcId: z.string().min(1), email: z.string().email() })
      .parse(req.body);
    const result = await startLegacyClaim({ bpcId, email });
    const verifyUrl = `${frontendUrl("/claim-account")}?step=verify&bpcId=${encodeURIComponent(bpcId)}&email=${encodeURIComponent(result.account.email)}&token=${encodeURIComponent(result.verifyToken)}`;
    await sendPlayerClaimAccountEmail({
      to: result.account.email,
      verifyUrl,
      displayName: result.account.display_name,
      bpcId: result.account.bpc_id,
    });
    res.json({
      message: "Check your email for a secure link to verify and claim your account.",
      ...(env.emailSkipSend ? { devVerifyUrl: verifyUrl } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/claim/verify", async (req, res, next) => {
  try {
    const payload = z
      .object({
        bpcId: z.string().min(1),
        email: z.string().email(),
        token: z.string().min(1),
      })
      .parse(req.query);
    const result = await verifyLegacyClaim({
      bpcId: payload.bpcId,
      email: payload.email,
      code: payload.token,
    });
    res.json({
      message: "Email verified. Set your password to finish.",
      claimToken: result.claimToken,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/claim/verify", async (req, res, next) => {
  try {
    const payload = z
      .object({
        bpcId: z.string().min(1),
        email: z.string().email(),
        code: z.string().min(1).optional(),
        token: z.string().min(1).optional(),
      })
      .refine((d) => d.code || d.token, { message: "token required" })
      .parse(req.body);
    const result = await verifyLegacyClaim({
      bpcId: payload.bpcId,
      email: payload.email,
      code: payload.code || payload.token,
    });
    res.json({
      message: "Email verified. Set your password to finish.",
      claimToken: result.claimToken,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/claim/set-password", async (req, res, next) => {
  try {
    const payload = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(req.body);
    const { account, session } = await setPasswordFromClaim({
      claimToken: payload.token,
      password: payload.password,
    });
    try {
      await maybeSendPlayerWelcomeEmail(account);
    } catch (emailErr) {
      console.error("[email] welcome mail failed:", emailErr?.message || emailErr);
    }
    res.json({
      message: "Account claimed successfully",
      token: session.token,
      expiresAt: session.expiresAt,
      account: { bpcId: account.bpc_id, slug: account.slug },
    });
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

const checkoutPreviewSchema = z.object({
  cardTier: z.enum(CARD_TIERS).optional().default("default"),
  coinsToApply: z.number().int().min(0).optional(),
});

const registrationDetailsSchema = z.object({
  mmr: z.number().int().min(0).max(20000).nullable().optional(),
  roles: z.array(z.string().min(1)).optional(),
  location: z.string().max(120).optional(),
  phoneNumber: z.string().max(32).optional(),
});

const checkoutConfirmSchema = checkoutPreviewSchema.extend({
  assetUrl: z.string().optional(),
  tagline: z.string().max(120).optional(),
  registrationDetails: registrationDetailsSchema.optional(),
});

router.post("/tournaments/:slug/checkout/preview", requirePlayer, async (req, res, next) => {
  try {
    const body = checkoutPreviewSchema.parse(req.body);
    const preview = await previewCheckout(req.playerAccount, req.params.slug, body);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

router.post("/tournaments/:slug/checkout/confirm", requirePlayer, async (req, res, next) => {
  try {
    const body = checkoutConfirmSchema.parse(req.body);
    if (body.registrationDetails) {
      const d = body.registrationDetails;
      await updatePlayerAccount(req.playerAccount.id, {
        mmr: d.mmr,
        preferredRoles: d.roles,
        location: d.location,
        phoneNumber: d.phoneNumber,
        profileCompletedAt: new Date().toISOString(),
      });
      req.playerAccount = await findAccountById(req.playerAccount.id);
    }
    const result = await confirmCheckout(req.playerAccount, req.params.slug, body);
    if (body.assetUrl || body.tagline) {
      const tier = body.cardTier === "default" ? "gold" : body.cardTier;
      if (tier === "gold" || tier === "holo") {
        await upsertCardAsset(req.playerAccount.id, {
          tier,
          assetUrl: body.assetUrl || "",
          tagline: body.tagline || "",
        });
      }
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/checkout/:orderId/status", requirePlayer, async (req, res, next) => {
  try {
    const status = await getCheckoutOrderStatus(req.params.orderId, req.playerAccount.id);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.post("/checkout/:orderId/simulate-pay", requirePlayer, async (req, res, next) => {
  try {
    const result = await simulateManualPayment(req.params.orderId, req.playerAccount.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/tournaments/:slug/substitute", requirePlayer, async (req, res, next) => {
  try {
    const body = z
      .object({
        availability: z.string().max(500).optional().default(""),
        notes: z.string().max(1000).optional().default(""),
      })
      .parse(req.body);
    const result = await createSubstituteSignup(req.playerAccount, req.params.slug, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/me/coins", requirePlayer, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const offset = Number(req.query.offset) || 0;
    const payload = await getPlayerCoinSummary(req.playerAccount.id, { limit, offset });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/notifications/unread-count", requirePlayer, async (req, res, next) => {
  try {
    const count = await getUnreadNotificationCount(req.playerAccount.id);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", requirePlayer, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const offset = Number(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const payload = await listPlayerNotifications(req.playerAccount.id, { limit, offset, unreadOnly });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", requirePlayer, async (req, res, next) => {
  try {
    const ok = await markNotificationRead(req.playerAccount.id, req.params.id);
    if (!ok) return res.status(404).json({ message: "Notification not found" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/notifications/read-all", requirePlayer, async (req, res, next) => {
  try {
    const count = await markAllNotificationsRead(req.playerAccount.id);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.get("/team", requirePlayer, async (req, res, next) => {
  try {
    const payload = await getPlayerTeamForAccount(req.playerAccount.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/matches", requirePlayer, async (req, res, next) => {
  try {
    const payload = await getPlayerMatchesForAccount(req.playerAccount.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/matches/:matchId/substitution-request", requirePlayer, async (req, res, next) => {
  try {
    const body = z.object({ reason: z.string().min(3).max(2000) }).parse(req.body);
    const payload = await createSubstitutionRequest(req.playerAccount.id, req.params.matchId, body.reason);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete("/matches/:matchId/substitution-request", requirePlayer, async (req, res, next) => {
  try {
    const payload = await cancelSubstitutionRequest(req.playerAccount.id, req.params.matchId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/history", requirePlayer, async (req, res, next) => {
  try {
    const payload = await getPlayerDashboardHistory(req.playerAccount.id);
    if (!payload) return res.status(404).json({ message: "Player not found" });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/tournaments/upcoming", requirePlayer, async (req, res, next) => {
  try {
    const payload = await getUpcomingTournamentsForPlayer(req.playerAccount.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;
