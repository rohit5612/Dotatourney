import express from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../../services/authService.js";
import { adminGrantCoins } from "../../services/paymentService.js";
import {
  getPlayerAccountAdminDetail,
  listPlayerAccountsAdmin,
  patchPlayerAccountAdmin,
  uploadPlayerCardAdmin,
  removePlayerCardAdmin,
} from "../../services/adminPlayerAccountService.js";
import { findAccountById } from "../../services/playerAccountRepository.js";
import { listHostedPortraitGifs, saveCatalogPortraitGif, savePlayerPortraitGif } from "../../services/portraitGifService.js";
import { writeAuditLog } from "../../services/auditLogService.js";
import { publicPlayerAccount } from "../../services/playerAccountRepository.js";

const router = express.Router();

router.get("/portrait-gifs", requireAdmin, async (_req, res, next) => {
  try {
    const gifs = await listHostedPortraitGifs();
    return res.json({ gifs });
  } catch (error) {
    return next(error);
  }
});

router.post("/portrait-gifs", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        dataUrl: z.string().min(32).max(12_000_000),
        filename: z.string().max(120).optional(),
      })
      .parse(req.body);
    const saved = await saveCatalogPortraitGif(body.dataUrl, body.filename);
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "portrait_gif_catalog.upload",
      entityType: "player_account",
      entityId: null,
      payload: { filename: saved.filename, bytes: saved.bytes },
    });
    return res.status(201).json(saved);
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const query = z
      .object({
        search: z.string().optional().default(""),
        verified: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
        offset: z.coerce.number().int().min(0).optional().default(0),
      })
      .parse(req.query);
    const result = await listPlayerAccountsAdmin(query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const detail = await getPlayerAccountAdminDetail(req.params.id);
    if (!detail) return res.status(404).json({ message: "Player account not found" });
    return res.json(detail);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        adminNotes: z.string().max(2000).optional(),
        displayName: z.string().max(80).optional(),
        avatarUrl: z.string().max(4_000_000).optional(),
      })
      .parse(req.body);
    const account = await patchPlayerAccountAdmin(req.params.id, body);
    if (!account) return res.status(404).json({ message: "Player account not found" });
    await writeAuditLog({ adminUserId: req.adminUser.id, action: "player_account.patch", entityType: "player_account", entityId: req.params.id, payload: { ...body, avatarUrl: body.avatarUrl ? "[set]" : body.avatarUrl } });
    return res.json({ account: publicPlayerAccount(account) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/portrait-gif", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        dataUrl: z.string().min(32).max(12_000_000),
      })
      .parse(req.body);
    const account = await findAccountById(req.params.id);
    if (!account) return res.status(404).json({ message: "Player account not found" });
    const saved = await savePlayerPortraitGif(account, body.dataUrl);
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "player_portrait_gif.upload",
      entityType: "player_account",
      entityId: req.params.id,
      payload: { filename: saved.filename, bytes: saved.bytes },
    });
    return res.status(201).json(saved);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/card", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const result = await removePlayerCardAdmin(req.params.id);
    if (!result) return res.status(404).json({ message: "Player account not found" });
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "player_card.remove",
      entityType: "player_account",
      entityId: req.params.id,
      payload: {},
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/card", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        tier: z.enum(["player", "gold", "holo"]),
        manifestJson: z.any().optional(),
        manifest: z.any().optional(),
        assetUrl: z.string().max(2000).optional(),
        tagline: z.string().max(120).optional(),
        seasonId: z.string().uuid().optional(),
        tournamentId: z.string().uuid().optional(),
        tournamentSlug: z.string().max(120).optional(),
        approve: z.boolean().optional().default(true),
        applyProfileTier: z.boolean().optional().default(true),
      })
      .refine((data) => data.manifestJson || data.manifest || data.assetUrl, {
        message: "Provide manifestJson or assetUrl",
      })
      .parse(req.body);
    const result = await uploadPlayerCardAdmin(req.params.id, body, req.adminUser.id);
    if (!result) return res.status(404).json({ message: "Player account not found" });
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "player_card.upload",
      entityType: "player_account",
      entityId: req.params.id,
      payload: { tier: body.tier, approve: body.approve, applyProfileTier: body.applyProfileTier },
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/coins", requireAdmin, requirePermission("playerCrm.accounts.update"), async (req, res, next) => {
  try {
    const body = z
      .object({
        delta: z.number().int().refine((n) => n !== 0, { message: "delta must be non-zero" }),
        reason: z.string().max(500).optional().default("Admin grant"),
      })
      .parse(req.body);
    const entry = await adminGrantCoins(req.adminUser.id, req.params.id, body);
    await writeAuditLog({
      adminUserId: req.adminUser.id,
      action: "coins.grant",
      entityType: "player_account",
      entityId: req.params.id,
      payload: body,
    });
    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
});

export default router;
