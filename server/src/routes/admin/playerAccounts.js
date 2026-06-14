import express from "express";
import { z } from "zod";
import { requireAdmin, requirePermission } from "../../services/authService.js";
import { adminGrantCoins } from "../../services/paymentService.js";
import {
  getPlayerAccountAdminDetail,
  listPlayerAccountsAdmin,
  patchPlayerAccountAdmin,
} from "../../services/adminPlayerAccountService.js";
import { writeAuditLog } from "../../services/auditLogService.js";

const router = express.Router();

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
    const body = z.object({ adminNotes: z.string().max(2000).optional(), displayName: z.string().max(80).optional() }).parse(req.body);
    const account = await patchPlayerAccountAdmin(req.params.id, body);
    if (!account) return res.status(404).json({ message: "Player account not found" });
    await writeAuditLog({ adminUserId: req.adminUser.id, action: "player_account.patch", entityType: "player_account", entityId: req.params.id, payload: body });
    return res.json({ account });
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
