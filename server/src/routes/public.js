import express from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  completeRegistrationPayment,
  getPublicRegistrationSession,
  lookupRegistrationFlowStage,
  requestRegistrationOtp,
  syncRegistrationCapState,
  substitutePoolIsOpen,
  verifyRegistrationOtp,
} from "../services/registrationRepository.js";
import {
  getCachedPublicPayload,
  invalidatePublicCache,
  setCachedPublicPayload,
} from "../services/publicCache.js";
import { getPublishedTournament, getPublishedTournamentForPublicRequest } from "../services/tournamentRepository.js";
import { applyBlastGroupSeeding } from "../services/blastSeeding.js";
import { buildPublicHonorsPayload } from "../services/bracketHonorsEngine.js";
import { buildGroupedStandings, buildStandings } from "../services/standingsEngine.js";
import { buildTeamsWithActivePlayers } from "../services/rosterMembershipService.js";
import { stageTabsForFormat } from "../services/formatGenerator.js";
import { engineBracketTabs } from "../services/tournamentEngineService.js";
import {
  sendPlayerRegistrationOtpEmail,
  sendPlayerRegistrationSubmittedEmail,
  sendPlayerRegistrationVerifiedEmail,
} from "../services/emailService.js";
import { resolvePublicTeamLogo } from "../utils/teamLogoUrl.js";
import { getOrCreateCommerceConfig, publicCommerceConfig } from "../services/commerceConfigRepository.js";
import { getPublicPlayerProfile, getCommunityDirectory } from "../services/playerProfileService.js";
import {
  isSeasonPubliclyVisible,
  listPublicSeasons,
  getSeasonBySlug,
  getPublicMatchDetail,
  listAnnouncements,
  getArchiveEmbedsForTournament,
  getLandingSponsorsConfig,
} from "../services/seasonService.js";
import { getPublicSiteContent } from "../services/siteContentService.js";
import {
  buildCardManifestBySlug,
  buildMatchRosterCards,
  CARD_PNG_STUB,
} from "../services/cardManifestService.js";

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
    live_youtube_url: "",
    announcements: ["Tournament setup is in progress."],
    banner_announcements: [],
    visibility_mode: "demo",
    payment_qr_image: "",
    payment_upi_id: "",
    registration_code_prefix: DEFAULT_REG_PREFIX,
    registrations_open: false,
    registration_cap: null,
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
      setupTeams: [],
      matches: [],
      schedule: [],
      tabs: stageTabsForFormat("dse"),
      standings: [],
      groupedStandings: [],
      isPlaceholder: true,
      approvedRegistrationCount: 0,
      substitutePoolOpen: false,
      archiveEmbeds: [],
      sponsorsConfig: { section: {}, sponsors: [] },
    };
  }

  const capState = await syncRegistrationCapState(data.tournament.id);
  const approvedRegistrationCount = capState.count;
  if (capState.changed) {
    data.tournament.registrations_open = false;
  }
  const substitutePoolOpen = substitutePoolIsOpen(capState);
  const commerceRow = await getOrCreateCommerceConfig(data.tournament.id);
  const commerce = publicCommerceConfig(commerceRow);
  const [archiveEmbeds, sponsorsConfig] = await Promise.all([
    getArchiveEmbedsForTournament(data.tournament.id),
    getLandingSponsorsConfig(),
  ]);

  const visibilityMode = data.tournament.visibility_mode || "demo";
  const format = data.tournament.format;
  const workingTeamLogos = new Map(
    (data.teams || []).flatMap((team) => {
      const logo = resolvePublicTeamLogo(team.logoUrl || team.logo_url || "");
      if (!logo) return [];
      return [
        [team.id, logo],
        [String(team.name || "").trim().toLowerCase(), logo],
      ];
    }),
  );
  const workingTeamAccents = new Map(
    (data.teams || []).flatMap((team) => {
      const accent = team.accentColor || team.accent_color || "";
      if (!accent) return [];
      return [
        [team.id, accent],
        [String(team.name || "").trim().toLowerCase(), accent],
      ];
    }),
  );
  const resolveTeamLogo = (team) =>
    resolvePublicTeamLogo(
      team.logoUrl || team.logo_url || "",
      workingTeamLogos.get(team.sourceTeamId) || "",
      workingTeamLogos.get(String(team.name || "").trim().toLowerCase()) || "",
    );
  const resolveTeamAccent = (team) =>
    team.accentColor ||
    team.accent_color ||
    workingTeamAccents.get(team.sourceTeamId) ||
    workingTeamAccents.get(String(team.name || "").trim().toLowerCase()) ||
    "";
  const mapPublicTeam = (team) => ({
    ...team,
    logoUrl: resolveTeamLogo(team),
    accentColor: resolveTeamAccent(team),
  });
  const publicTeams = data.approvedRoster
    ? buildTeamsWithActivePlayers(data.approvedRoster).map((team) => mapPublicTeam(team))
    : (data.teams || []).map((team) => mapPublicTeam(team));
  const standingsTeams =
    visibilityMode === "demo"
      ? Array.from({ length: data.tournament.team_count }, (_, index) => ({ name: `Team ${index + 1}` }))
      : publicTeams.length > 0
        ? publicTeams
        : Array.from(
            new Set(data.matches.flatMap((m) => [m.team1, m.team2]).filter((n) => typeof n === "string" && n.trim() !== "")),
          ).map((name) => ({ name }));

  let bracketMatches = data.matches;
  if (format === "blast" && visibilityMode !== "demo") {
    bracketMatches = applyBlastGroupSeeding(standingsTeams, bracketMatches).matches;
  }
  const matches = bracketMatches.map((match) => publicMatch(match, visibilityMode));
  const honors = buildPublicHonorsPayload(matches, format, data.tournament.tournament_honors);
  return {
    tournament: data.tournament,
    teams: visibilityMode === "demo" ? [] : publicTeams,
    /** Admin team-setup logos/accent — used to resolve approved-roster teams on the public site. */
    setupTeams:
      visibilityMode === "demo"
        ? []
        : (data.teams || []).map((team) => ({
            id: team.id,
            name: team.name,
            logoUrl: resolvePublicTeamLogo(team.logoUrl || team.logo_url || ""),
            accentColor: team.accentColor || team.accent_color || "",
          })),
    matches,
    honors,
    schedule: data.schedule,
    tabs:
      engineBracketTabs(data.tournament.engine_config) ||
      stageTabsForFormat(format, { teamCount: data.tournament.team_count }),
    standings: buildStandings(standingsTeams, matches, format),
    groupedStandings: buildGroupedStandings(standingsTeams, matches, format),
    approvedRegistrationCount,
    substitutePoolOpen,
    commerce,
    archiveEmbeds,
    sponsorsConfig,
  };
}

async function assertPublishedOpen(data) {
  if (!data) {
    const err = new Error("No tournament is currently published for registration");
    err.status = 404;
    throw err;
  }
  const capState = await syncRegistrationCapState(data.tournament.id);
  if (capState.changed) {
    data.tournament.registrations_open = false;
  }
  if (capState.reached || data.tournament.registrations_open !== true) {
    const err = new Error(
      capState.reached
        ? "Registration is full. Join the substitute pool from your player dashboard."
        : "Registration is closed. New sign-ups, email verification, continuing from an email link (including Complete payment), and submitting payment online are disabled.",
    );
    err.status = 403;
    throw err;
  }
}

const PUBLIC_HTTP_CACHE = "public, max-age=10, stale-while-revalidate=30";

function publicQueryCacheKey(base, query) {
  const parts = Object.entries(query)
    .filter(([, value]) => value !== "" && value != null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

async function cachedPublicJson(res, cacheKey, loader) {
  let payload = await getCachedPublicPayload(cacheKey);
  if (!payload) {
    payload = await loader();
    await setCachedPublicPayload(cacheKey, payload);
  }
  res.set("Cache-Control", PUBLIC_HTTP_CACHE);
  return res.json(payload);
}

router.get("/tournament", async (_req, res, next) => {
  try {
    return await cachedPublicJson(res, "tournament:published", async () =>
      publicPayload(await getPublishedTournament()),
    );
  } catch (error) {
    return next(error);
  }
});

router.get("/tournaments/:identifier", async (req, res, next) => {
  try {
    const identifier = String(req.params.identifier || "").trim().toLowerCase();
    return await cachedPublicJson(res, `tournament:${identifier}`, async () => {
      const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
      return publicPayload(data, req.params.identifier);
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/tournaments/:identifier/register/session", async (req, res, next) => {
  try {
    const data = await getPublishedTournamentForPublicRequest(req.params.identifier);
    await assertPublishedOpen(data);
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
    await assertPublishedOpen(data);
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
    await assertPublishedOpen(data);
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
    await assertPublishedOpen(data);
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
    await assertPublishedOpen(data);
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
    invalidatePublicCache();
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

router.get("/players/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    return await cachedPublicJson(res, `player:${slug}`, async () => {
      const payload = await getPublicPlayerProfile(slug);
      if (!payload) {
        const err = new Error("Player not found");
        err.status = 404;
        throw err;
      }
      return payload;
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/players/:slug/card", async (req, res, next) => {
  try {
    const manifest = await buildCardManifestBySlug(req.params.slug);
    if (!manifest) return res.status(404).json({ message: "Player not found" });
    return res.json({ card: manifest });
  } catch (error) {
    return next(error);
  }
});

router.get("/players/:slug/card.png", async (req, res, next) => {
  try {
    const manifest = await buildCardManifestBySlug(req.params.slug);
    if (!manifest) return res.status(404).json({ message: "Player not found" });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=60");
    res.set("X-Card-Tier", manifest.tier);
    return res.send(CARD_PNG_STUB);
  } catch (error) {
    return next(error);
  }
});

router.get("/matches/:id/roster-cards", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    return await cachedPublicJson(res, `match-roster:${id}`, async () => {
      const payload = await buildMatchRosterCards(id);
      if (!payload) {
        const err = new Error("Match not found");
        err.status = 404;
        throw err;
      }
      return payload;
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/match/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    return await cachedPublicJson(res, `match:${id}`, async () => {
      const payload = await getPublicMatchDetail(id);
      if (!payload) {
        const err = new Error("Match not found");
        err.status = 404;
        throw err;
      }
      return payload;
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/site-content", async (_req, res, next) => {
  try {
    return await cachedPublicJson(res, "site-content", async () => getPublicSiteContent());
  } catch (error) {
    return next(error);
  }
});

router.get("/seasons", async (_req, res, next) => {
  try {
    return await cachedPublicJson(res, "seasons:list", async () => {
      const seasons = await listPublicSeasons();
      return { seasons };
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/seasons/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    return await cachedPublicJson(res, `seasons:slug:${slug}`, async () => {
      const payload = await getSeasonBySlug(slug);
      if (!payload) {
        const err = new Error("Season not found");
        err.status = 404;
        throw err;
      }
      const tournament = payload.tournament?.tournament || null;
      const visible = isSeasonPubliclyVisible(payload.season, {
        isPublished: Boolean(tournament?.is_published),
        tournamentStatus: tournament?.status,
      });
      if (!visible) {
        const err = new Error("Season not found");
        err.status = 404;
        throw err;
      }
      return payload;
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/community", async (req, res, next) => {
  try {
    const query = z
      .object({
        search: z.string().optional().default(""),
        q: z.string().optional().default(""),
        limit: z.coerce.number().int().min(1).max(100).optional().default(48),
        offset: z.coerce.number().int().min(0).optional().default(0),
      })
      .parse(req.query);
    const cacheKey = publicQueryCacheKey("community", {
      search: query.search || query.q || "",
      limit: query.limit,
      offset: query.offset,
    });
    return await cachedPublicJson(res, cacheKey, async () =>
      getCommunityDirectory({
        search: query.search || query.q || "",
        limit: query.limit,
        offset: query.offset,
      }),
    );
  } catch (error) {
    return next(error);
  }
});

router.get("/announcements", async (req, res, next) => {
  try {
    const query = z
      .object({
        category: z.enum(["registration", "match_day", "general"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional().default(50),
        offset: z.coerce.number().int().min(0).optional().default(0),
      })
      .parse(req.query);
    const cacheKey = publicQueryCacheKey("announcements", query);
    return await cachedPublicJson(res, cacheKey, async () => listAnnouncements(query));
  } catch (error) {
    return next(error);
  }
});

export default router;
