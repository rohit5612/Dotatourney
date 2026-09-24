import express from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../../services/authService.js";
import { writeAuditLog } from "../../services/auditLogService.js";
import { invalidatePublicCache } from "../../services/publicCache.js";
import {
  createLeagueTeam,
  listLeagueTeamsAdmin,
  updateLeagueTeam,
  getLeagueTeamById,
} from "../../services/leagueTeamService.js";

const router = express.Router();

const artSchema = z
  .object({
    gallery: z
      .array(
        z.object({
          url: z.string().min(1),
          caption: z.string().optional().default(""),
          credit: z.string().optional().default(""),
        }),
      )
      .optional()
      .default([]),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(64).optional(),
  abbr: z.string().max(8).optional().default(""),
  logoUrl: z.string().optional().default(""),
  accentColor: z.string().optional().default(""),
  tagline: z.string().max(240).optional().default(""),
  lore: z.string().max(50_000).optional().default(""),
  history: z.string().max(50_000).optional().default(""),
  art: artSchema,
  foundedSeasonNumber: z.number().int().positive().nullable().optional(),
  status: z.enum(["active", "dormant", "retired"]).optional().default("active"),
  sortOrder: z.number().int().optional().default(0),
});

const patchSchema = createSchema.partial();

router.get("/", requireAdmin, requirePermission("teams.read"), async (_req, res, next) => {
  try {
    const teams = await listLeagueTeamsAdmin();
    return res.json({ teams });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAdmin, requirePermission("teams.update"), async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);
    const team = await createLeagueTeam(payload);
    invalidatePublicCache();
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "league_team.create",
      entityType: "league_team",
      entityId: team.id,
      payload: { slug: team.slug, name: team.name },
    });
    return res.status(201).json({ team });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", requireAdmin, requirePermission("teams.update"), async (req, res, next) => {
  try {
    const payload = patchSchema.parse(req.body);
    const team = await updateLeagueTeam(req.params.id, payload);
    if (!team) return res.status(404).json({ message: "League team not found" });
    invalidatePublicCache();
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "league_team.update",
      entityType: "league_team",
      entityId: team.id,
      payload: { name: team.name },
    });
    return res.json({ team });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", requireAdmin, requirePermission("teams.read"), async (req, res, next) => {
  try {
    const team = await getLeagueTeamById(req.params.id);
    if (!team) return res.status(404).json({ message: "League team not found" });
    return res.json({ team });
  } catch (error) {
    return next(error);
  }
});

export default router;
