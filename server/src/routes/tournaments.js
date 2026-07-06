import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { persistBlastGroupSeedingIfReady } from "../services/blastSeeding.js";
import { generateMatches, getFormatTeamCountMessage, stageTabsForFormat } from "../services/formatGenerator.js";
import { compileEngineConfigToGenerator, engineBracketTabs, engineStageTabs } from "../services/tournamentEngineService.js";
import { buildGroupIndices, formatUsesGroupAssignment, resolveGroupStageConfig, validateGroupAssignment } from "../services/groupAssignment.js";
import { reapplyAllProgression } from "../services/progressionEngine.js";
import { buildPublicHonorsPayload } from "../services/bracketHonorsEngine.js";
import { applySeriesRulesToMatches } from "../services/seriesRulesEngine.js";
import { archivePlayerRegistration, getPlayerRegistrationById, listPlayerRegistrations, updatePlayerRegistration } from "../services/registrationRepository.js";
import { sendPlayerRegistrationDecisionEmail } from "../services/emailService.js";
import { notifyRegistrationDecision } from "../services/playerNotificationService.js";
import { buildGroupedStandings, buildStandings } from "../services/standingsEngine.js";
import { requireAdmin, requirePermission } from "../services/authService.js";
import { syncCrmRegistrationsToGoogleSheet } from "../services/googleSheetsSync.js";
import { invalidatePublicCache } from "../services/publicCache.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { logAction, logError } from "../utils/serverLogger.js";
import { listTeamProfileHistory, listPlayerTeamStints } from "../services/teamHistoryService.js";
import {
  listSubstitutePool,
  listSubstitutionRequests,
  updateSubstitutePoolRegistration,
  updateSubstitutionRequest,
  assignSubstitutionRequest,
  listEligibleSubstitutes,
} from "../services/substituteAdminService.js";
import {
  approveRosterSnapshot,
  adjustApprovedRoster,
  createRosterSnapshot,
  createTournament,
  deleteDraftTournament,
  deleteRosterSnapshot,
  getRosterSnapshot,
  getTournament,
  listRosterSnapshots,
  listTournaments,
  publishTournament,
  approveTournament,
  completeTournament,
  replaceMatches,
  replaceSchedule,
  replaceTeamsAndPlayers,
  syncApprovedRosterFromTeamSave,
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
  status: z.enum(["draft", "approved", "published", "archived", "concluded"]).optional().default("draft"),
  engineConfig: z.any().nullable().optional(),
  engineTemplateId: z.string().uuid().nullable().optional(),
  registrationCodePrefix: z.string().max(12).optional().default("BPC"),
  paymentQrImage: z.string().optional().default(""),
  paymentUpiId: z.string().optional().default(""),
  googleSheetSpreadsheetId: z.string().optional().default(""),
  googleSheetTabName: z.string().optional().default(""),
  seasonCardBg: z.string().max(2_500_000).optional().default(""),
  seasonCardBadge: z.string().max(16).optional().default(""),
  registrationsOpen: z.boolean().optional().default(false),
  registrationCap: z.union([z.number().int().min(1).max(9999), z.null()]).optional(),
    tournamentHonors: z
    .object({
      displayPodiumCount: z.number().int().min(1).max(12).optional().default(2),
      mvp: z
        .object({
          prize: z.string().optional().default(""),
          teamName: z.string().optional().default(""),
          playerId: z.string().optional().default(""),
          playerName: z.string().optional().default(""),
          notes: z.string().optional().default(""),
        })
        .nullable()
        .optional(),
      customCards: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional().default(""),
            prize: z.string().optional().default(""),
            winnerLabel: z.string().optional().default(""),
            teamName: z.string().optional().default(""),
            playerName: z.string().optional().default(""),
            notes: z.string().optional().default(""),
            sortOrder: z.number().int().optional(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ customCards: [] }),
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
          !registration.archivedAt &&
          registration.registrationStatus === "approved" &&
          (registration.substituteFlag || registration.paymentStatus === "paid"),
      )
      .map((registration) => registration.id),
  );

  if (players.some((player) => !readyRegistrationIds.has(player.registrationId))) {
    return "Team rosters can only include paid, approved, active registrations";
  }

  return "";
}

async function persistProgressedMatches(tournamentId, snapshot, baseMatches) {
  const progressed = reapplyAllProgression(baseMatches);

  for (const match of progressed) {
    const saved = await updateMatch(tournamentId, String(match.id), match);
    if (!saved) {
      return { error: "Failed to save match progression" };
    }
  }

  let afterSeeding = progressed;
  if (snapshot.tournament.format === "blast") {
    const standingsTeams = snapshot.approvedRoster?.teams || snapshot.teams;
    const seeded = await persistBlastGroupSeedingIfReady(tournamentId, standingsTeams, progressed, updateMatch);
    afterSeeding = seeded.matches;
  }

  const standingsTeams = snapshot.approvedRoster?.teams || snapshot.teams;
  return {
    matches: afterSeeding,
    standings: buildStandings(standingsTeams, afterSeeding, snapshot.tournament.format),
    groupedStandings: buildGroupedStandings(standingsTeams, afterSeeding, snapshot.tournament.format),
  };
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

router.post("/:id/publish", requirePermission("setup.update"), async (req, res, next) => {
  try {
    const tournament = await publishTournament(req.params.id, req.adminUser.id);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });
    invalidatePublicCache();
    return res.json({ tournament });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/approve", requirePermission("setup.update"), async (req, res, next) => {
  try {
    const row = await approveTournament(req.params.id, req.adminUser.id);
    if (!row) return res.status(404).json({ message: "Tournament not found" });
    await writeAuditLog({ adminUserId: req.adminUser.id, action: "tournament.approve", entityType: "tournament", entityId: req.params.id, payload: {} });
    return res.json({ tournament: row });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/complete", requirePermission("setup.update"), async (req, res, next) => {
  try {
    const body = z.object({ force: z.boolean().optional().default(false) }).parse(req.body || {});
    const row = await completeTournament(req.params.id, req.adminUser.id, body);
    await writeAuditLog({ adminUserId: req.adminUser.id, action: "tournament.complete", entityType: "tournament", entityId: req.params.id, payload: body });
    invalidatePublicCache();
    return res.json({ tournament: row });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/substitutes", async (req, res, next) => {
  try {
    const query = z
      .object({
        search: z.string().optional().default(""),
        limit: z.coerce.number().int().min(1).max(100).optional().default(25),
        offset: z.coerce.number().int().min(0).optional().default(0),
        status: z.string().optional(),
      })
      .parse(req.query);
    const poolResult = await listSubstitutePool(req.params.id, query);
    const requests = await listSubstitutionRequests(req.params.id, { status: query.status });
    const eligible = await listEligibleSubstitutes(req.params.id);
    return res.json({ ...poolResult, requests, eligible });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/substitution-requests/:requestId/assign", requirePermission("playerCrm.substitutes.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        substituteRegistrationId: z.string().uuid().optional(),
        substitutePlayerAccountId: z.string().uuid().optional(),
        adminNotes: z.string().optional(),
      })
      .refine((d) => d.substituteRegistrationId || d.substitutePlayerAccountId, {
        message: "substituteRegistrationId or substitutePlayerAccountId required",
      })
      .parse(req.body);
    const result = await assignSubstitutionRequest(req.params.id, req.params.requestId, {
      ...body,
      adminUserId: req.adminUser.id,
    });
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "substitution.assign",
      entityType: "substitution_request",
      entityId: req.params.requestId,
      payload: body,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/substitution-requests/:requestId", requirePermission("playerCrm.substitutes.update"), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(["approved", "rejected", "cancelled"]).optional(), adminNotes: z.string().optional() }).parse(req.body);
    const row = await updateSubstitutionRequest(req.params.id, req.params.requestId, body);
    if (!row) return res.status(404).json({ message: "Request not found" });
    return res.json({ request: row });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/teams/:teamId/history", async (req, res, next) => {
  try {
    const history = await listTeamProfileHistory(req.params.id, req.params.teamId);
    return res.json({ history });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/players/:playerId/stints", async (req, res, next) => {
  try {
    const stints = await listPlayerTeamStints(req.params.id, req.params.playerId);
    return res.json({ stints });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/unpublish", async (req, res, next) => {
  try {
    const tournament = await unpublishTournament(req.params.id);
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });
    invalidatePublicCache();
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
    const honors = buildPublicHonorsPayload(matches, data.tournament.format, data.tournament.tournament_honors);
    return res.json({
      ...data,
      matches,
      tabs: engineBracketTabs(data.tournament.engine_config) || stageTabsForFormat(data.tournament.format, { teamCount: data.tournament.team_count }),
      standings,
      groupedStandings,
      honors,
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
        syncApprovedRosterId: z.string().uuid().optional(),
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

    let approvedRoster = null;
    if (payload.syncApprovedRosterId) {
      const data = await getTournament(req.params.id);
      if (!data?.approvedRoster || data.approvedRoster.id !== payload.syncApprovedRosterId) {
        return res.status(400).json({ message: "Only the approved roster can be updated from team save" });
      }
      const syncResult = await syncApprovedRosterFromTeamSave(
        req.params.id,
        payload.syncApprovedRosterId,
        req.adminUser.id,
        teams,
        players,
      );
      if (syncResult.error) {
        return res.status(400).json({ message: syncResult.error });
      }
      approvedRoster = syncResult.approvedRoster || null;
    }

    res.json({ teams, players, approvedRoster });
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

router.post("/:id/rosters/:rosterId/adjustments", async (req, res, next) => {
  try {
    const payload = z
      .object({
        operations: z
          .array(
            z.discriminatedUnion("type", [
              z.object({
                type: z.literal("remove"),
                playerId: z.string().uuid(),
                teamId: z.string().uuid(),
              }),
              z.object({
                type: z.literal("move"),
                playerId: z.string().uuid(),
                fromTeamId: z.string().uuid(),
                toTeamId: z.string().uuid(),
              }),
              z.object({
                type: z.literal("add"),
                registrationId: z.string().uuid(),
                teamId: z.string().uuid(),
                isCaptain: z.boolean().optional().default(false),
              }),
            ]),
          )
          .min(1),
      })
      .parse(req.body);

    const data = await getTournament(req.params.id);
    if (!data) return res.status(404).json({ message: "Tournament not found" });
    if (!data.approvedRoster || data.approvedRoster.id !== req.params.rosterId) {
      return res.status(400).json({ message: "Only the approved roster can be adjusted" });
    }

    const roster = await getRosterSnapshot(req.params.id, req.params.rosterId);
    if (!roster) return res.status(404).json({ message: "Roster not found" });
    if (roster.status !== "approved") {
      return res.status(400).json({ message: "Only an approved roster can be adjusted" });
    }

    const result = await adjustApprovedRoster(req.params.id, req.params.rosterId, payload.operations, req.adminUser.id);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    invalidatePublicCache();
    return res.json({ approvedRoster: result.approvedRoster });
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
    const engineConfig = data.tournament.engine_config;
    if (!formatUsesGroupAssignment(data.tournament.format, engineConfig)) {
      return res.status(400).json({ message: "This tournament format does not use group assignment" });
    }
    if (data.tournament.bracket_active) {
      return res.status(400).json({ message: "Deactivate the live bracket before changing group assignments" });
    }
    if (!data.approvedRoster) {
      return res.status(400).json({ message: "Approve a roster before assigning groups" });
    }

    const plan = resolveGroupStageConfig(engineConfig || { teamCount: data.tournament.team_count, format: data.tournament.format });
    const allowedKeys = plan.groupKeys;

    const payload = z
      .object({
        assignments: z.array(
          z.object({
            teamId: z.string().uuid(),
            groupKey: z.string().regex(/^[A-H]$/),
          }),
        ),
      })
      .parse(req.body);

    for (const entry of payload.assignments) {
      if (!allowedKeys.includes(entry.groupKey)) {
        return res.status(400).json({ message: `Invalid group key ${entry.groupKey}. Allowed: ${allowedKeys.join(", ")}` });
      }
    }

    const mergedTeams = data.approvedRoster.teams.map((team) => {
      const entry = payload.assignments.find((item) => item.teamId === team.id);
      return entry ? { ...team, groupKey: entry.groupKey } : team;
    });
    const validationMessage = validateGroupAssignment(mergedTeams, engineConfig || { teamCount: data.tournament.team_count, format: data.tournament.format });
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const result = await updateRosterGroupAssignments(req.params.id, payload.assignments, allowedKeys);
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

    const compiled = data.tournament.engine_config
      ? compileEngineConfigToGenerator(data.tournament.engine_config)
      : null;
    const teamCount = compiled?.teamCount || data.tournament.team_count;
    const format = compiled?.format || data.tournament.format;
    const seriesRules = compiled?.seriesRules || data.tournament.series_rules || {};
    const engineConfig = compiled?.engineConfig || data.tournament.engine_config;

    let names = Array.from({ length: teamCount }, (_, index) => `Team ${index + 1}`);
    const teamCountMessage = getFormatTeamCountMessage(format, names.length);
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
      if (data.approvedRoster.teams.length !== teamCount) {
        return res.status(400).json({ message: `Approved roster must have exactly ${teamCount} teams` });
      }
      names = data.approvedRoster.teams.map((team) => team.name);
    }

    const generateOptions = {};
    if (formatUsesGroupAssignment(format, engineConfig) && data.tournament.visibility_mode !== "demo") {
      const teamsForGroups = data.approvedRoster?.teams || [];
      const validationMessage = validateGroupAssignment(
        teamsForGroups,
        engineConfig || { teamCount, format },
      );
      if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
      }
      generateOptions.groupIndices = buildGroupIndices(
        teamsForGroups,
        engineConfig || { teamCount, format },
      );
    }

    if (engineConfig) {
      generateOptions.engineConfig = engineConfig;
    }

    const matches = generateMatches(format, names, seriesRules, generateOptions);
    await replaceMatches(req.params.id, matches);
    const tabs =
      engineBracketTabs(engineConfig) ||
      stageTabsForFormat(format, { teamCount });
    res.json({ matches, tabs });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/bracket/refresh-progression", async (req, res, next) => {
  try {
    const snapshot = await getTournament(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    if (!snapshot.matches?.length) {
      return res.status(400).json({ message: "Generate a bracket before refreshing progression" });
    }

    const beforeById = new Map(snapshot.matches.map((match) => [String(match.id), match]));
    const result = await persistProgressedMatches(req.params.id, snapshot, snapshot.matches);
    if (result.error) {
      return res.status(500).json({ message: result.error });
    }

    let changedCount = 0;
    for (const after of result.matches) {
      const before = beforeById.get(String(after.id));
      if (!before) continue;
      if (before.team1 !== after.team1 || before.team2 !== after.team2 || before.winner !== after.winner) {
        changedCount += 1;
      }
    }

    return res.json({ ...result, changedCount });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/series-rules/apply", async (req, res, next) => {
  try {
    const payload = z
      .object({
        seriesRules: z.record(z.string(), z.enum(["bo1", "bo2", "bo3", "bo5"])).optional(),
      })
      .parse(req.body ?? {});

    const snapshot = await getTournament(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const seriesRules = payload.seriesRules ?? snapshot.tournament.series_rules ?? {};
    const { matches: nextMatches, updatedCount, skippedCount } = applySeriesRulesToMatches(
      snapshot.matches,
      seriesRules,
      { fallbackSeriesType: snapshot.tournament.series_type || "bo3" },
    );

    for (let index = 0; index < snapshot.matches.length; index += 1) {
      const before = snapshot.matches[index];
      const after = nextMatches[index];
      if (before.meta?.seriesType === after.meta?.seriesType) continue;
      const saved = await updateMatch(req.params.id, String(after.id), after);
      if (!saved) {
        return res.status(500).json({ message: "Failed to update match series type" });
      }
    }

    const refreshed = await getTournament(req.params.id);
    return res.json({
      matches: refreshed?.matches ?? nextMatches,
      updatedCount,
      skippedCount,
      tournament: refreshed?.tournament ?? snapshot.tournament,
    });
  } catch (error) {
    return next(error);
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
    if (payload.winner !== updatedMatch.team1 && payload.winner !== updatedMatch.team2) {
      return res.status(400).json({ message: "Winner must match one of the teams in this match" });
    }
    const baseMatches = snapshot.matches.map((m) => (String(m.id) === resMatchId ? updatedMatch : m));
    const result = await persistProgressedMatches(req.params.id, snapshot, baseMatches);
    if (result.error) {
      return res.status(500).json({ message: result.error });
    }

    await updateScheduleStatusByMatchId(req.params.id, resMatchId, "finished");

    res.json(result);
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

    const updatedMatch = {
      ...match,
      ...payload,
      status: nextStatus,
      meta: nextMeta,
    };

    const winnerChanged = "winner" in payload && payload.winner !== match.winner;
    const shouldReprogress = Boolean(updatedMatch.winner && updatedMatch.meta?.winToken && winnerChanged);

    if (shouldReprogress) {
      const baseMatches = snapshot.matches.map((entry) => (String(entry.id) === matchIdParam ? updatedMatch : entry));
      const result = await persistProgressedMatches(req.params.id, snapshot, baseMatches);
      if (result.error) {
        return res.status(500).json({ message: result.error });
      }
      if (nextStatus === "finished" || payload.winner) {
        await updateScheduleStatusByMatchId(req.params.id, matchIdParam, "finished");
      }
      return res.json(result);
    }

    const updated = await updateMatch(req.params.id, matchIdParam, updatedMatch);
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
    res.json({ registrations: await listPlayerRegistrations(req.params.id, { excludeSubstitutes: true }) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/substitutes/:registrationId", requirePermission("playerCrm.substitutes.update"), async (req, res, next) => {
  try {
    const payload = z
      .object({
        registrationStatus: z.enum(["pending", "approved", "waitlisted", "rejected"]).optional(),
        adminNotes: z.string().optional(),
      })
      .parse(req.body);
    const registration = await updateSubstitutePoolRegistration(req.params.id, req.params.registrationId, payload);
    if (!registration) return res.status(404).json({ message: "Substitute pool entry not found" });
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "substitute_pool.update",
      entityType: "player_registration",
      entityId: req.params.registrationId,
      payload,
    });
    return res.json({ registration });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/registrations/:registrationId", requirePermission("playerCrm.registrations.update"), async (req, res, next) => {
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
    if (prev?.substituteFlag) {
      return res.status(403).json({ message: "Substitute pool entries are managed under Player CRM → Substitutes." });
    }
    const registration = await updatePlayerRegistration(req.params.id, req.params.registrationId, payload);
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    logAction("registration", "admin.updated", {
      adminId: req.adminUser.id,
      tournamentId: req.params.id,
      registrationId: registration.id,
      email: registration.email,
      changes: payload,
      previousPaymentStatus: prev?.paymentStatus,
      previousRegistrationStatus: prev?.registrationStatus,
    });
    const registrationStatusChanged =
      payload.registrationStatus && payload.registrationStatus !== prev?.registrationStatus;
    const paymentStatusChanged = payload.paymentStatus && payload.paymentStatus !== prev?.paymentStatus;
    const shouldNotifyRegistration =
      registrationStatusChanged &&
      ["approved", "rejected", "waitlisted"].includes(payload.registrationStatus);
    const shouldNotifyPayment =
      paymentStatusChanged && ["paid", "unpaid", "refunded"].includes(payload.paymentStatus);
    if (prev && (shouldNotifyRegistration || shouldNotifyPayment)) {
      let tournamentName = "BPC League — Bharat Pro Circuit League";
      try {
        const tour = await getTournament(req.params.id);
        tournamentName = tour?.tournament?.name || tournamentName;
      } catch (err) {
        logError("tournament", "load for registration notify failed", err, {
          tournamentId: req.params.id,
          registrationId: registration.id,
        });
      }

      if (registration.email && !registration.email.includes("@migrated.")) {
        try {
          await sendPlayerRegistrationDecisionEmail({
            to: registration.email,
            name: registration.name,
            tournamentName,
            publicCode: registration.publicCode || registration.id?.slice(0, 8) || "",
            registrationStatus: registration.registrationStatus,
            paymentStatus: registration.paymentStatus,
          });
        } catch (err) {
          logError("email", "player registration status update failed", err, {
            registrationId: registration.id,
            email: registration.email,
          });
        }
      }

      if (shouldNotifyRegistration && registration.playerAccountId) {
        try {
          await notifyRegistrationDecision({
            playerAccountId: registration.playerAccountId,
            tournamentName,
            tournamentId: req.params.id,
            registrationId: registration.id,
            registrationStatus: registration.registrationStatus,
            publicCode: registration.publicCode,
          });
        } catch (err) {
          logError("notifications", "registration decision failed", err, {
            playerAccountId: registration.playerAccountId,
            registrationId: registration.id,
          });
        }
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
