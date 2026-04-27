import express from "express";
import { z } from "zod";
import { createPlayerRegistration } from "../services/registrationRepository.js";
import { getPublishedTournament, getPublicTournament } from "../services/tournamentRepository.js";
import { buildGroupedStandings, buildStandings } from "../services/standingsEngine.js";
import { stageTabsForFormat } from "../services/formatGenerator.js";

const router = express.Router();

const registrationSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().default(""),
  roles: z.array(z.string().min(1)).min(1),
  mmr: z.number().int().min(0).max(15000),
  steamName: z.string().min(1),
  steamProfile: z.string().min(1),
  discordHandle: z.string().min(1),
  phoneNumber: z.string().min(1),
  paymentScreenshot: z.string().min(1),
  notes: z.string().optional().default(""),
});

function fallbackTournament(identifier) {
  return {
    id: null,
    name: "The Forge",
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
    discord_url: "https://discord.gg/NmC2Xqnb",
    rulebook: "Rules will be published before tournament lock-in.",
    announcements: ["Tournament setup is in progress."],
    visibility_mode: "demo",
  };
}

function publicMatch(match, visibilityMode) {
  if (visibilityMode !== "demo") return match;
  return {
    ...match,
    team1: match.meta?.demoTeam1 || match.team1,
    team2: match.meta?.demoTeam2 || match.team2,
    winner: null,
  };
}

function publicPayload(data, fallbackIdentifier = "the-forge") {
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
    };
  }

  const visibilityMode = data.tournament.visibility_mode || "demo";
  const matches = data.matches.map((match) => publicMatch(match, visibilityMode));
  const publicTeams = data.approvedRoster
    ? data.approvedRoster.teams.map((team) => ({
        ...team,
        players: data.approvedRoster.players.filter((player) =>
          data.approvedRoster.teamPlayers.some((record) => record.team_id === team.id && record.player_id === player.id),
        ),
      }))
    : data.teams;
  const standingsTeams =
    visibilityMode === "demo"
      ? Array.from({ length: data.tournament.team_count }, (_, index) => ({ name: `Team ${index + 1}` }))
      : publicTeams;
  return {
    tournament: data.tournament,
    teams: visibilityMode === "demo" ? [] : publicTeams,
    matches,
    schedule: data.schedule,
    tabs: stageTabsForFormat(data.tournament.format),
    standings: visibilityMode === "demo" ? [] : buildStandings(publicTeams, data.matches, data.tournament.format),
    groupedStandings: buildGroupedStandings(standingsTeams, matches, data.tournament.format),
  };
}

router.get("/tournament", async (_req, res, next) => {
  try {
    return res.json(publicPayload(await getPublishedTournament()));
  } catch (error) {
    return next(error);
  }
});

router.get("/tournaments/:identifier", async (req, res, next) => {
  try {
    return res.json(publicPayload((await getPublishedTournament()) || (await getPublicTournament(req.params.identifier)), req.params.identifier));
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register", async (req, res, next) => {
  try {
    const data = await getPublishedTournament();
    if (!data) {
      return res.status(404).json({ message: "No tournament is currently published for registration" });
    }
    if (data.tournament.registration_deadline && new Date(data.tournament.registration_deadline) <= new Date()) {
      return res.status(403).json({ message: "Registration is closed for this tournament" });
    }
    const payload = registrationSchema.parse(req.body);
    const registration = await createPlayerRegistration(data.tournament.id, payload);
    return res.status(201).json({ registration });
  } catch (error) {
    return next(error);
  }
});

export default router;
