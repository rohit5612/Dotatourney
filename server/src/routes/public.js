import express from "express";
import { z } from "zod";
import { createPlayerRegistration } from "../services/registrationRepository.js";
import { getPublicTournament } from "../services/tournamentRepository.js";
import { buildStandings } from "../services/standingsEngine.js";
import { stageTabsForFormat } from "../services/formatGenerator.js";

const router = express.Router();

const registrationSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().default(""),
  roles: z.array(z.string().min(1)).min(1),
  mmr: z.number().int().min(0).max(15000).nullable().optional(),
  steamName: z.string().min(1),
  steamProfile: z.string().min(1),
  discordHandle: z.string().optional().default(""),
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
    start_date: null,
    end_date: null,
    registration_deadline: null,
    discord_url: "",
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

router.get("/tournaments/:identifier", async (req, res, next) => {
  try {
    const data = await getPublicTournament(req.params.identifier);
    if (!data) {
      return res.json({
        tournament: fallbackTournament(req.params.identifier),
        teams: [],
        matches: [],
        schedule: [],
        tabs: stageTabsForFormat("dse"),
        standings: [],
        isPlaceholder: true,
      });
    }

    const visibilityMode = data.tournament.visibility_mode || "demo";
    const matches = data.matches.map((match) => publicMatch(match, visibilityMode));
    return res.json({
      tournament: data.tournament,
      teams: visibilityMode === "demo" ? [] : data.teams,
      matches,
      schedule: data.schedule,
      tabs: stageTabsForFormat(data.tournament.format),
      standings: visibilityMode === "demo" ? [] : buildStandings(data.teams, data.matches, data.tournament.format),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tournaments/:identifier/register", async (req, res, next) => {
  try {
    const data = await getPublicTournament(req.params.identifier);
    if (!data) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    const payload = registrationSchema.parse(req.body);
    const registration = await createPlayerRegistration(data.tournament.id, payload);
    return res.status(201).json({ registration });
  } catch (error) {
    return next(error);
  }
});

export default router;
