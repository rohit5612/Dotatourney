import express from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../../services/authService.js";
import { writeAuditLog } from "../../services/auditLogService.js";
import { invalidatePublicCache } from "../../services/publicCache.js";
import {
  listSeasons,
  listPublicSeasons,
  updateSeasonHeroMedia,
  updateSeasonContent,
} from "../../services/seasonService.js";
import { seasonContentPatchSchema } from "../../services/seasonContentSchema.js";
import { getOrgRoster } from "../../services/siteContentService.js";

const router = express.Router();

router.get("/", requireAdmin, requirePermission("seasons.read"), async (_req, res, next) => {
  try {
    const seasons = await listSeasons();
    return res.json({ seasons });
  } catch (error) {
    return next(error);
  }
});

router.get("/content", requireAdmin, requirePermission("seasons.read"), async (_req, res, next) => {
  try {
    const [orgRoster, seasons] = await Promise.all([getOrgRoster(), listPublicSeasons()]);
    return res.json({ orgRoster, seasons });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", requireAdmin, requirePermission("seasons.update"), async (req, res, next) => {
  try {
    const payload = z
      .object({
        cardBg: z.string().max(2_500_000).nullable().optional(),
      })
      .parse(req.body);

    const patch = {};
    if (payload.cardBg !== undefined) {
      patch.cardBg = payload.cardBg || null;
    }

    const season = await updateSeasonHeroMedia(req.params.id, patch);
    if (!season) return res.status(404).json({ message: "Season not found" });

    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "season.hero_media.update",
      entityType: "season",
      entityId: season.id,
      payload: { cardBg: patch.cardBg ? "[image]" : null },
    });

    return res.json({ season });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/content", requireAdmin, requirePermission("seasons.update"), async (req, res, next) => {
  try {
    const payload = seasonContentPatchSchema.parse(req.body);
    const season = await updateSeasonContent(req.params.id, payload);
    if (!season) return res.status(404).json({ message: "Season not found" });

    invalidatePublicCache();

    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "season.content.update",
      entityType: "season",
      entityId: season.id,
      payload: {
        sponsorCount: payload.sponsorsConfig?.sponsors?.length,
        embedCount: payload.archiveEmbeds?.length,
      },
    });

    return res.json({ season });
  } catch (error) {
    return next(error);
  }
});

export default router;
