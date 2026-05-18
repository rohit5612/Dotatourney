import express from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  completeRegistrationPayment,
  countApprovedPlayerRegistrations,
  getPublicRegistrationSession,
  lookupRegistrationFlowStage,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "../services/registrationRepository.js";
import { getPublishedTournament, getPublishedTournamentForPublicRequest } from "../services/tournamentRepository.js";
import { buildGroupedStandings, buildStandings } from "../services/standingsEngine.js";
import { stageTabsForFormat } from "../services/formatGenerator.js";
import {
  sendPlayerRegistrationOtpEmail,
  sendPlayerRegistrationSubmittedEmail,
  sendPlayerRegistrationVerifiedEmail,
} from "../services/emailService.js";

const router = express.Router();

function isValidDiscordHandle(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^\d{17,20}$/.test(s)) return true;
  if (/^[\w.]{2,32}#\d{4}$/i.test(s)) return true;
  if (/^[a-z0-9._]{2,32}$/i.test(s)) return true;
  return false;
}

function isValidSteamProfileLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const u = new URL(normalized);
    if (u.hostname.toLowerCase() !== "steamcommunity.com") return false;
    const pathPrefix = u.pathname.toLowerCase();
    return pathPrefix.startsWith("/profiles/") || pathPrefix.startsWith("/id/");
  } catch {
    return false;
  }
}

const registerFormSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
    location: z.string().optional().default(""),
    roles: z.array(z.string().min(1)).min(1),
    mmr: z.number().int().min(0).max(20000),
    steamName: z.string().min(1),
    steamProfile: z.string().min(1),
    discordHandle: z.string().min(1),
    phoneNumber: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (!isValidDiscordHandle(data.discordHandle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Discord ID must be a legacy tag (e.g. name#1234), a handle (e.g. my_name), or a numeric user ID (17–20 digits).",
        path: ["discordHandle"],
      });
    }
    if (!isValidSteamProfileLink(data.steamProfile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Steam profile must be a steamcommunity.com URL, e.g. https://steamcommunity.com/profiles/76561198… or https://steamcommunity.com/id/yourid",
        path: ["steamProfile"],
      });
    }
  });

function continueRegisterUrl(identifier, email, publicCode) {
  const base = env.appUrl.replace(/\/$/, "");
  const e = encodeURIComponent(email);
  const c = encodeURIComponent(publicCode);
  return `${base}/register?resume=1&email=${e}&code=${c}`;
}

const DEFAULT_PUBLIC_TOURNAMENT_NAME = "BPC League — Bharat Pro Circuit League";
const DEFAULT_FALLBACK_SLUG = "bpcl";
const DEFAULT_REG_PREFIX = "BPC";

function fallbackTournament(identifier) {
  return {
    id: null,
    name: DEFAULT_PUBLIC_TOURNAMENT_NAME,
    slug: identifier,
    format: "dse",
    series_type: "bo3",
    team_count: 8,
    description: "A Dota 2 community tournament platform. Full event details will appear here once admins publish the setup.",
    prize_pool: "TBA",
    prize_pool_breakdown: "",
    entry_fee: "TBA",
    start_date: null,
    end_date: null,
    registration_deadline: null,
    discord_url: "https://discord.gg/sV2PhYc6A3",
    rulebook: "Rules will be published before tournament lock-in.",
    announcements: ["Tournament setup is in progress."],
    banner_announcements: [],
    visibility_mode: "demo",
    payment_qr_image: "",
    payment_upi_id: "",
    registration_code_prefix: DEFAULT_REG_PREFIX,
    registrations_open: false,
  };
}

function publicMatch(match, visibilityMode) {
  if (visibilityMode !== "demo") return match;
  const t1 = match.meta?.demoTeam1 || match.team1;
  const t2 = match.meta?.demoTeam2 || match.team2;
  let winner = match.winner;
  if (winner) {
    if (winner === match.team1) winner = t1;
    else if (winner === match.team2) winner = t2;
  }
  return {
    ...match,
    team1: t1,
    team2: t2,
    winner: winner || null,
  };
}

async function publicPayload(data, fallbackIdentifier = DEFAULT_FALLBACK_SLUG) {
  if (!data) {
    return {
      tournament: fallbackTournament(fallbackIdentifier),
      teams: [],
      matches: [],
      schedule: [],
      tabs: stageTabsForFormat("dse"),
      standings: [],
      groupedStandings: [],
      isPlaceholder: true,
      approvedRegistrationCount: 0,
    };
  }

  const approvedRegistrationCount = await countApprovedPlayerRegistrations(data.tournament.id);

  const visibilityMode = data.tournament.visibility_mode || "demo";
  const matches = data.matches.map((match) => publicMatch(match, visibilityMode));
  const workingTeamLogos = new Map(
    (data.teams || []).flatMap((team) => {
      const logo = team.logoUrl || team.logo_url || "";
      if (!logo) return [];
      return [
        [team.id, logo],
        [String(team.name || "").trim().toLowerCase(), logo],
      ];
    }),
  );
  const resolveTeamLogo = (team) =>
    team.logoUrl ||
    team.logo_url ||
    workingTeamLogos.get(team.sourceTeamId) ||
    workingTeamLogos.get(String(team.name || "").trim().toLowerCase()) ||
    "";
  const publicTeams = data.approvedRoster
    ? data.approvedRoster.teams.map((team) => ({
        ...team,
        logoUrl: resolveTeamLogo(team),
        players: data.approvedRoster.players.filter((player) =>
          data.approvedRoster.teamPlayers.some((record) => record.team_id === team.id && record.player_id === player.id),
        ),
      }))
    : (data.teams || []).map((team) => ({ ...team, logoUrl: resolveTeamLogo(team) }));
  const standingsTeams =
    visibilityMode === "demo"
      ? Array.from({ length: data.tournament.team_count }, (_, index) => ({ name: `Team ${index + 1}` }))
      : publicTeams.length > 0
        ? publicTeams
        : Array.from(
            new Set(matches.flatMap((m) => [m.team1, m.team2]).filter((n) => typeof n === "string" && n.trim() !== "")),
          ).map((name) => ({ name }));
  const format = data.tournament.format;
  return {
    tournament: data.tournament,
    teams: visibilityMode === "demo" ? [] : publicTeams,
    matches,
    schedule: data.schedule,
    tabs: stageTabsForFormat(format, { teamCount: data.tournament.team_count }),
    standings: buildStandings(standingsTeams, matches, format),
    groupedStandings: buildGroupedStandings(standingsTeams, matches, format),
    approvedRegistrationCount,
  };
}

function assertPublishedOpen(data) {
  if (!data) {
    const err = new Error("No tournament is currently published for registration");
    err.status = 404;
    throw err;
  }
  if (data.tournament.registrations_open !== true) {
    const err = new Error(
      "Registration is closed. New sign-ups, email verification, continuing from an email link (including Complete payment), and submitting payment online are disabled.",
    );
    err.status = 403;
    throw err;
  }
}

router.get("/tournament", async (_req, res, next) => {
  try {
    return res.json(await publicPayload(await getPublishedTournament()));
  } catch (error) {
    return next(error);
  }
});

router.get("/tournaments/:identifier", async (req, res, next) => {
  try {
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    return res.json(await publicPayload(data, req.params.identifier));
  } catch (error) {
    return next(error);
  }
});

router.get("/tournaments/:identifier/register/session", async (req, res, next) => {
  try {
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    assertPublishedOpen(data);
    const email = req.query.email;
    const code = req.query.code;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Query parameter email is required" });
    }
    const session = await getPublicRegistrationSession(data.tournament.id, email, code || "");
    if (!session) return res.status(404).json({ message: "Registration session not found" });
    return res.json({ session });
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register/lookup-email", async (req, res, next) => {
  try {
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    assertPublishedOpen(data);
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const { stage } = await lookupRegistrationFlowStage(data.tournament.id, body.email);
    return res.json({ stage });
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register/request-otp", async (req, res, next) => {
  try {
    if (!env.emailSkipSend && !env.smtpConfigured) {
      return res.status(503).json({
        message:
          "Registration emails are not configured. Set EMAIL_USER and EMAIL_PASS (and SMTP_*), or EMAIL_SKIP_SEND=true for local development.",
      });
    }
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    assertPublishedOpen(data);
    const body = registerFormSchema.extend({ termsAcceptedAt: z.string().min(1) }).parse(req.body);
    const { registrationId, otp } = await requestRegistrationOtp(data.tournament.id, body, body.termsAcceptedAt);
    const tournamentName = data.tournament.name || DEFAULT_PUBLIC_TOURNAMENT_NAME;
    try {
      await sendPlayerRegistrationOtpEmail({
        to: body.email.toLowerCase(),
        name: body.name,
        tournamentName,
        otp,
      });
    } catch (err) {
      console.error("[email] OTP send failed:", err?.message || err);
      const e = new Error(err?.message || "Failed to send verification email");
      e.status = 502;
      throw e;
    }
    const out = { ok: true, registrationId };
    if (env.emailSkipSend) out.devOtp = otp;
    return res.status(202).json(out);
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register/verify-otp", async (req, res, next) => {
  try {
    if (!env.emailSkipSend && !env.smtpConfigured) {
      return res.status(503).json({
        message:
          "Registration emails are not configured. Set EMAIL_USER and EMAIL_PASS (and SMTP_*), or EMAIL_SKIP_SEND=true for local development.",
      });
    }
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    assertPublishedOpen(data);
    const body = z
      .object({
        email: z.string().email(),
        otp: z.string().min(4).max(8),
      })
      .parse(req.body);
    const { registration, publicCode } = await verifyRegistrationOtp(data.tournament.id, body.email, body.otp);
    const tournamentName = data.tournament.name || DEFAULT_PUBLIC_TOURNAMENT_NAME;
    const contUrl = continueRegisterUrl(req.params.identifier, registration.email, publicCode);
    try {
      await sendPlayerRegistrationVerifiedEmail({
        to: registration.email,
        name: registration.name,
        tournamentName,
        registration: { ...registration, publicCode },
        continueUrl: contUrl,
      });
    } catch (err) {
      console.error("[email] verified registration mail failed:", err?.message || err);
    }
    return res.status(200).json({ registration, publicCode, continueUrl: contUrl });
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register/complete", async (req, res, next) => {
  try {
    if (!env.emailSkipSend && !env.smtpConfigured) {
      return res.status(503).json({
        message:
          "Registration emails are not configured. Set EMAIL_USER and EMAIL_PASS (and SMTP_*), or EMAIL_SKIP_SEND=true for local development.",
      });
    }
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    assertPublishedOpen(data);
    const body = z
      .object({
        email: z.string().email(),
        publicCode: z.string().min(1),
        paymentScreenshot: z.string().min(1),
        notes: z.string().optional().default(""),
      })
      .parse(req.body);
    const registration = await completeRegistrationPayment(
      data.tournament.id,
      body.email,
      body.publicCode,
      body.paymentScreenshot,
      body.notes,
    );
    const tournamentName = data.tournament.name || DEFAULT_PUBLIC_TOURNAMENT_NAME;
    try {
      await sendPlayerRegistrationSubmittedEmail({
        to: registration.email,
        name: registration.name,
        tournamentName,
        publicCode: registration.publicCode,
      });
    } catch (err) {
      console.error("[email] submitted registration mail failed:", err?.message || err);
    }
    return res.status(200).json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register", async (_req, res) => {
  return res.status(410).json({
    message:
      "This registration endpoint is retired. Use POST .../register/request-otp, verify-otp, and complete in order.",
  });
});

export default router;
