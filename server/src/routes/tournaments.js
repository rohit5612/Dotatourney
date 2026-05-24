import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { persistBlastGroupSeedingIfReady } from "../services/blastSeeding.js";
import { generateMatches, getFormatTeamCountMessage, stageTabsForFormat } from "../services/formatGenerator.js";
import { buildGroupIndices, formatUsesGroupAssignment, validateGroupAssignment } from "../services/groupAssignment.js";
import { applyProgression } from "../services/progressionEngine.js";
import { archivePlayerRegistration, getPlayerRegistrationById, listPlayerRegistrations, updatePlayerRegistration } from "../services/registrationRepository.js";
import { sendPlayerRegistrationDecisionEmail } from "../services/emailService.js";
import { buildGroupedStandings, buildStandings } from "../services/standingsEngine.js";
import { requireAdmin } from "../services/authService.js";
import { syncCrmRegistrationsToGoogleSheet } from "../services/googleSheetsSync.js";
import { invalidatePublicCache } from "../services/publicCache.js";
import {
  approveRosterSnapshot,
  createRosterSnapshot,
  createTournament,
  deleteDraftTournament,
  deleteRosterSnapshot,
  getRosterSnapshot,
  getTournament,
  listRosterSnapshots,
  listTournaments,
  publishTournament,
  replaceMatches,
  replaceSchedule,
  replaceTeamsAndPlayers,
  unpublishTournament,
  updateMatch,
  updateRosterSnapshot,
  updateRosterGroupAssignments,
  updateScheduleStatusByMatchId,
  updateTournament,
} from "../services/tournamentRepository.js";

const router = express.Router();

const tournamentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).nullable().optional(),
  format: z.enum(["dse", "se", "gsl", "rr", "swiss", "hybrid", "blast"]),
  seriesType: z.enum(["bo1", "bo2", "bo3", "bo5"]),
  teamCount: z.number().int().min(2).max(64),
  seriesRules: z.record(z.string(), z.enum(["bo1", "bo2", "bo3", "bo5"])).optional().default({}),
  darkMode: z.boolean().optional(),
  description: z.string().optional().default(""),
  prizePool: z.string().optional().default(""),
  prizePoolBreakdown: z
    .union([
      z.string(),
      z.array(
        z.object({
          placement: z.number().int().min(1),
          label: z.string().optional().default(""),
          amount: z.string().optional().default(""),
        }),
      ),
    ])
    .optional()
    .default([]),
  entryFee: z.string().optional().default(""),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  registrationDeadline: z.string().nullable().optional(),
  discordUrl: z.string().optional().default(""),
  rulebook: z.string().optional().default(""),
  liveYoutubeUrl: z.string().optional().default(""),
  announcements: z
    .array(
      z.union([
        z.string(),
        z.object({
          body: z.string(),
          postedAt: z.union([z.string(), z.null()]).optional(),
        }),
      ]),
    )
    .optional()
    .default([]),
  bannerAnnouncements: z
    .array(
      z.object({
        body: z.string(),
        postedAt: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .optional()
    .default([]),
  visibilityMode: z.enum(["demo", "tournament"]).optional().default("demo"),
  bracketActive: z.boolean().optional().default(false),
  status: z.enum(["draft", "approved", "published", "archived"]).optional().default("draft"),
  registrationCodePrefix: z.string().max(12).optional().default("BPC"),
  paymentQrImage: z.string().optional().default(""),
  paymentUpiId: z.string().optional().default(""),
  registrationsOpen: z.boolean().optional().default(false),
});

async function validateRosterRegistrations(tournamentId, players) {
  if (players.some((player) => !player.registrationId)) {
    return "Only registered players can be assigned to teams";
  }

  const registrations = await listPlayerRegistrations(tournamentId);
  const readyRegistrationIds = new Set(
    registrations
      .filter(
        (registration) =>
          registration.paymentStatus === "paid" &&
          registration.registrationStatus === "approved" &&
          !registration.archivedAt,
      )
      .map((registration) => registration.id),
  );

  if (players.some((player) => !readyRegistrationIds.has(player.registrationId))) {
    return "Team rosters can only include paid, approved, active registrations";
  }

  return "";
}

router.use(requireAdmin);

router.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePublicCache();
    }
  });
  next();
});

router.post("/:id/google-sheets/sync-registrations", async (req, res, next) => {
  try {
    const payload = z
      .object({
        spreadsheetId: z.string().min(1),
        registrationIds: z.array(z.string().uuid()).optional(),
        sheetName: z.string().min(1).optional(),
      })
      .parse(req.body);
    const result = await syncCrmRegistrationsToGoogleSheet(req.params.id, payload.spreadsheetId.trim(), {
      registrationIds: payload.registrationIds,
      sheetName: payload.sheetName,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    res.json({ tournaments: await listTournaments() });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = tournamentSchema.parse(req.body);
    const tournament = await createTournament(payload);
    res.status(201).json({ tournament });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = tournamentSchema.parse(req.body);
    const tournament = await updateTournament(req.params.id, payload);
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/publish", async (req, res, next) => {
  try {
    const tournament = await publishTournament(req.params.id, req.adminUser.id);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });
    return res.json({ tournament });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/unpublish", async (req, res, next) => {
  try {
    const tournament = await unpublishTournament(req.params.id);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });
    return res.json({ tournament });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const tournament = await deleteDraftTournament(req.params.id);
    if (!tournament) {
      return res.status(409).json({ message: "Only unpublished draft tournaments can be deleted" });
    }
    return res.json({ deleted: true, tournament });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const standingsTeams = data.approvedRoster?.teams || data.teams;
    let matches = data.matches;
    if (data.tournament.format === "blast") {
      const seeded = await persistBlastGroupSeedingIfReady(req.params.id, standingsTeams, matches, updateMatch);
      matches = seeded.matches;
      if (seeded.changed) invalidatePublicCache();
    }

    const standings = buildStandings(standingsTeams, matches, data.tournament.format);
    const groupedStandings = buildGroupedStandings(standingsTeams, matches, data.tournament.format);
    return res.json({
      ...data,
      matches,
      tabs: stageTabsForFormat(data.tournament.format, { teamCount: data.tournament.team_count }),
      standings,
      groupedStandings,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/teams", async (req, res, next) => {
  try {
    const payload = z
      .object({
        teams: z.array(
          z.object({
            id: z.string().uuid().optional(),
            name: z.string().min(1),
            captain: z.string().nullable().optional(),
            abbr: z.string().nullable().optional(),
            seed: z.number().nullable().optional(),
            logoUrl: z.string().optional().default(""),
            accentColor: z.string().optional().default(""),
          }),
        ),
        players: z.array(
          z.object({
            id: z.string().uuid().optional(),
            registrationId: z.string().uuid().nullable().optional(),
            name: z.string().min(1),
            displayName: z.string().optional().default(""),
            role: z.string().min(1),
            roles: z.array(z.string()).optional().default([]),
            mmr: z.number().int().nullable().optional(),
            steamName: z.string().optional().default(""),
            steamProfile: z.string().optional().default(""),
            discordHandle: z.string().optional().default(""),
            location: z.string().optional().default(""),
            isCaptain: z.boolean().optional().default(false),
            teamId: z.string().uuid().nullable().optional(),
          }),
        ),
      })
      .parse(req.body);

    const teams = payload.teams.map((team, index) => ({
      ...team,
      id: team.id || randomUUID(),
      seed: typeof team.seed === "number" ? team.seed : index + 1,
    }));
    const players = payload.players.map((player) => ({ ...player, id: player.id || randomUUID() }));
    const validationMessage = await validateRosterRegistrations(req.params.id, players);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const teamPlayers = players
      .filter((player) => player.teamId)
      .map((player) => ({
        id: randomUUID(),
        teamId: player.teamId,
        playerId: player.id,
      }));

    await replaceTeamsAndPlayers(req.params.id, teams, players, teamPlayers);
    res.json({ teams, players });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/rosters", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });

    return res.json({ rosters: await listRosterSnapshots(req.params.id), approvedRoster: data.approvedRoster });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/rosters/:rosterId", async (req, res, next) => {
  try {
    const roster = await getRosterSnapshot(req.params.id, req.params.rosterId);
    if (!roster) return res.status(404).json({ message: "Roster not found" });

    return res.json({ roster });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/rosters", async (req, res, next) => {
  try {
    const payload = z.object({ name: z.string().min(1) }).parse(req.body);
    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });

    const validationMessage = await validateRosterRegistrations(req.params.id, data.players);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const roster = await createRosterSnapshot(req.params.id, payload.name.trim());
    return res.status(201).json({ roster, rosters: await listRosterSnapshots(req.params.id) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/rosters/:rosterId", async (req, res, next) => {
  try {
    const payload = z
      .object({
        name: z.string().min(1).optional(),
        replaceFromCurrent: z.boolean().optional().default(false),
      })
      .parse(req.body);
    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });

    if (payload.replaceFromCurrent) {
      const validationMessage = await validateRosterRegistrations(req.params.id, data.players);
      if (validationMessage) return res.status(400).json({ message: validationMessage });
    }

    const roster = await updateRosterSnapshot(req.params.id, req.params.rosterId, {
      name: payload.name?.trim(),
      replaceFromCurrent: payload.replaceFromCurrent,
    });
    if (!roster) return res.status(404).json({ message: "Roster not found" });

    return res.json({ roster, rosters: await listRosterSnapshots(req.params.id) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/rosters/:rosterId/approve", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });

    const roster = await getRosterSnapshot(req.params.id, req.params.rosterId);
    if (!roster) return res.status(404).json({ message: "Roster not found" });

    const validationMessage = await validateRosterRegistrations(req.params.id, roster.players);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    if (roster.teams.length !== data.tournament.team_count) {
      return res.status(400).json({ message: `Roster must have exactly ${data.tournament.team_count} teams before approval` });
    }
    const invalidTeam = roster.teams.find((team) => {
      const assignedPlayerIds = new Set(
        roster.teamPlayers.filter((record) => record.team_id === team.id).map((record) => record.player_id),
      );
      return !roster.players.some((player) => assignedPlayerIds.has(player.id) && player.isCaptain);
    });
    if (invalidTeam) {
      return res.status(400).json({ message: `Assign a registered captain for ${invalidTeam.name} before approval` });
    }

    const approvedRoster = await approveRosterSnapshot(req.params.id, req.params.rosterId, req.adminUser.id);
    return res.json({ approvedRoster, rosters: await listRosterSnapshots(req.params.id) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/rosters/:rosterId", async (req, res, next) => {
  try {
    const deleted = await deleteRosterSnapshot(req.params.id, req.params.rosterId);
    if (!deleted) return res.status(404).json({ message: "Roster not found" });

    return res.json({
      deleted: true,
      roster: deleted,
      rosters: await listRosterSnapshots(req.params.id),
      approvedRoster: await getTournament(req.params.id).then((data) => data?.approvedRoster || null),
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/group-assignments", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });
    if (!formatUsesGroupAssignment(data.tournament.format)) {
      return res.status(400).json({ message: "This tournament format does not use group assignment" });
    }
    if (data.tournament.bracket_active) {
      return res.status(400).json({ message: "Deactivate the live bracket before changing group assignments" });
    }
    if (!data.approvedRoster) {
      return res.status(400).json({ message: "Approve a roster before assigning groups" });
    }

    const payload = z
      .object({
        assignments: z.array(
          z.object({
            teamId: z.string().uuid(),
            groupKey: z.enum(["A", "B"]),
          }),
        ),
      })
      .parse(req.body);

    const mergedTeams = data.approvedRoster.teams.map((team) => {
      const entry = payload.assignments.find((item) => item.teamId === team.id);
      return entry ? { ...team, groupKey: entry.groupKey } : team;
    });
    const validationMessage = validateGroupAssignment(mergedTeams);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const result = await updateRosterGroupAssignments(req.params.id, payload.assignments);
    if (result.error) return res.status(400).json({ message: result.error });

    return res.json({ approvedRoster: result.approvedRoster });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/generate", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    let names = Array.from({ length: data.tournament.team_count }, (_, index) => `Team ${index + 1}`);
    const teamCountMessage = getFormatTeamCountMessage(data.tournament.format, names.length);
    if (teamCountMessage) {
      return res.status(400).json({ message: teamCountMessage });
    }
    if (data.tournament.visibility_mode !== "demo") {
      if (data.tournament.bracket_active) {
        return res.status(400).json({ message: "Deactivate the live bracket before regenerating tournament matches" });
      }
      if (!data.approvedRoster) {
        return res.status(400).json({ message: "Approve a tournament roster before generating the bracket" });
      }
      if (data.approvedRoster.teams.length !== data.tournament.team_count) {
        return res.status(400).json({ message: `Approved roster must have exactly ${data.tournament.team_count} teams` });
      }
      names = data.approvedRoster.teams.map((team) => team.name);
    }

    const generateOptions = {};
    if (formatUsesGroupAssignment(data.tournament.format) && data.tournament.visibility_mode !== "demo") {
      const teamsForGroups = data.approvedRoster?.teams || [];
      const validationMessage = validateGroupAssignment(teamsForGroups);
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      generateOptions.groupIndices = buildGroupIndices(teamsForGroups);
    }

    const matches = generateMatches(data.tournament.format, names, data.tournament.series_rules || {}, generateOptions);
    await replaceMatches(req.params.id, matches);
    res.json({ matches, tabs: stageTabsForFormat(data.tournament.format, { teamCount: data.tournament.team_count }) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/matches/:matchId/result", async (req, res, next) => {
  try {
    const payload = z
      .object({
        winner: z.string().min(1),
        score: z.string().optional().default(""),
        team1Score: z.preprocess(
          (v) => (typeof v === "string" && /^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : v),
          z.number().int().min(0).nullable().optional(),
        ),
        team2Score: z.preprocess(
          (v) => (typeof v === "string" && /^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : v),
          z.number().int().min(0).nullable().optional(),
        ),
      })
      .parse(req.body);
    const snapshot = await getTournament(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    const resMatchId = String(req.params.matchId);
    const changed = snapshot.matches.find((m) => String(m.id) === resMatchId);
    if (!changed) {
      return res.status(404).json({ message: "Match not found" });
    }

    const prev = changed.meta || {};
    const updatedMatch = {
      ...changed,
      winner: payload.winner,
      status: "finished",
      meta: {
        ...prev,
        score:
          payload.score ||
          [payload.team1Score, payload.team2Score].filter((value) => value !== undefined && value !== null).join("-"),
        team1Score: "team1Score" in payload ? payload.team1Score : (prev.team1Score ?? null),
        team2Score: "team2Score" in payload ? payload.team2Score : (prev.team2Score ?? null),
      },
    };
    const baseMatches = snapshot.matches.map((m) => (String(m.id) === resMatchId ? updatedMatch : m));
    const progressed = applyProgression(baseMatches, updatedMatch);

    for (const match of progressed) {
      const saved = await updateMatch(req.params.id, String(match.id), match);
      if (!saved) {
        return res.status(500).json({ message: "Failed to save match result" });
      }
    }

    await updateScheduleStatusByMatchId(req.params.id, resMatchId, "finished");

    const standingsTeams = snapshot.approvedRoster?.teams || snapshot.teams;
    let afterSeeding = progressed;
    if (snapshot.tournament.format === "blast") {
      const seeded = await persistBlastGroupSeedingIfReady(req.params.id, standingsTeams, progressed, updateMatch);
      afterSeeding = seeded.matches;
    }

    const standings = buildStandings(standingsTeams, afterSeeding, snapshot.tournament.format);
    const groupedStandings = buildGroupedStandings(standingsTeams, afterSeeding, snapshot.tournament.format);
    res.json({ matches: afterSeeding, standings, groupedStandings });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/matches/:matchId", async (req, res, next) => {
  try {
    const payload = z
      .object({
        team1: z.string().min(1).optional(),
        team2: z.string().min(1).optional(),
        winner: z.string().nullable().optional(),
        status: z.enum(["upcoming", "live", "finished"]).optional(),
        stream: z.string().nullable().optional(),
        slotAt: z.string().nullable().optional(),
        score: z.string().optional(),
        team1Score: z.preprocess(
          (v) => (typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : v),
          z.number().int().min(0).nullable().optional(),
        ),
        team2Score: z.preprocess(
          (v) => (typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : v),
          z.number().int().min(0).nullable().optional(),
        ),
      })
      .parse(req.body);
    const snapshot = await getTournament(req.params.id);
    if (!snapshot) return res.status(404).json({ message: "Tournament not found" });
    const matchIdParam = String(req.params.matchId);
    const match = snapshot.matches.find((entry) => String(entry.id) === matchIdParam);
    if (!match) return res.status(404).json({ message: "Match not found" });

    const nextMeta = { ...(match.meta || {}) };
    if ("team1Score" in payload) nextMeta.team1Score = payload.team1Score;
    if ("team2Score" in payload) nextMeta.team2Score = payload.team2Score;
    if ("score" in payload) nextMeta.score = payload.score;

    const nextStatus =
      "status" in payload ? payload.status : payload.winner ? "finished" : match.status;

    const updated = await updateMatch(req.params.id, matchIdParam, {
      ...match,
      ...payload,
      status: nextStatus,
      meta: nextMeta,
    });
    if (!updated) {
      return res.status(404).json({ message: "Match not found or could not be updated" });
    }
    if (nextStatus === "finished" || payload.winner) {
      await updateScheduleStatusByMatchId(req.params.id, matchIdParam, "finished");
    }
    return res.json({ match: updated });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/registrations", async (req, res, next) => {
  try {
    res.json({ registrations: await listPlayerRegistrations(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/registrations/:registrationId", async (req, res, next) => {
  try {
    const payload = z
      .object({
        paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
        registrationStatus: z.enum(["pending", "approved", "waitlisted", "rejected"]).optional(),
        adminNotes: z.string().optional(),
        displayName: z.string().optional(),
      })
      .parse(req.body);
    const prev = await getPlayerRegistrationById(req.params.id, req.params.registrationId);
    const registration = await updatePlayerRegistration(req.params.id, req.params.registrationId, payload);
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    const registrationStatusChanged =
      payload.registrationStatus && payload.registrationStatus !== prev?.registrationStatus;
    const paymentStatusChanged = payload.paymentStatus && payload.paymentStatus !== prev?.paymentStatus;
    const shouldNotifyRegistration =
      registrationStatusChanged &&
      ["approved", "rejected", "waitlisted"].includes(payload.registrationStatus);
    const shouldNotifyPayment =
      paymentStatusChanged && ["paid", "unpaid", "refunded"].includes(payload.paymentStatus);
    if (
      prev &&
      registration.email &&
      !registration.email.includes("@migrated.") &&
      (shouldNotifyRegistration || shouldNotifyPayment)
    ) {
      try {
        const tour = await getTournament(req.params.id);
        const tournamentName = tour?.tournament?.name || "BPC League — Bharat Pro Circuit League";
        await sendPlayerRegistrationDecisionEmail({
          to: registration.email,
          name: registration.name,
          tournamentName,
          publicCode: registration.publicCode || registration.id?.slice(0, 8) || "",
          registrationStatus: registration.registrationStatus,
          paymentStatus: registration.paymentStatus,
        });
      } catch (err) {
        console.error("[email] player registration status update failed:", err?.message || err);
      }
    }
    return res.json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/registrations/:registrationId/archive", async (req, res, next) => {
  try {
    const payload = z.object({ reason: z.string().min(1) }).parse(req.body);
    const registration = await archivePlayerRegistration(req.params.id, req.params.registrationId, {
      reason: payload.reason,
      adminUserId: req.adminUser.id,
    });
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    return res.json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/schedule", async (req, res, next) => {
  try {
    const payload = z
      .object({
        schedule: z.array(
          z.object({
            id: z.string().uuid().optional(),
            matchId: z.string().uuid(),
            startAt: z.string(),
            stream: z.string().min(1),
            streamUrl: z
              .string()
              .nullish()
              .transform((v) => (v && String(v).trim() ? String(v).trim() : undefined)),
            status: z.enum(["upcoming", "live", "finished"]),
            notes: z.string().optional().default(""),
          }),
        ),
      })
      .parse(req.body);

    const schedule = payload.schedule.map((slot) => ({
      ...slot,
      id: slot.id || randomUUID(),
    }));
    await replaceSchedule(req.params.id, schedule);
    res.json({ schedule });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export", async (req, res, next) => {
  try {
    const data = await getTournament(req.params.id);
    if (!data) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    res.json({
      schemaVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/import", async (req, res, next) => {
  try {
    const payload = z
      .object({
        data: z.object({
          teams: z.array(z.any()),
          players: z.array(z.any()),
          teamPlayers: z.array(z.any()).optional().default([]),
          matches: z.array(z.any()),
          schedule: z.array(z.any()).optional().default([]),
        }),
      })
      .parse(req.body);

    const teams = payload.data.teams.map((team) => ({ ...team, id: team.id || randomUUID() }));
    const players = payload.data.players.map((player) => ({ ...player, id: player.id || randomUUID() }));
    const teamPlayers = (payload.data.teamPlayers || []).map((record) => ({
      id: record.id || randomUUID(),
      teamId: record.teamId,
      playerId: record.playerId,
    }));
    const matches = payload.data.matches.map((match) => ({ ...match, id: match.id || randomUUID() }));
    const schedule = (payload.data.schedule || []).map((slot) => ({
      ...slot,
      id: slot.id || randomUUID(),
    }));

    await replaceTeamsAndPlayers(req.params.id, teams, players, teamPlayers);
    await replaceMatches(req.params.id, matches);
    await replaceSchedule(req.params.id, schedule);
    res.json({ imported: true });
  } catch (error) {
    next(error);
  }
});

export default router;
