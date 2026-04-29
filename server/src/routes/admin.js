import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import {
  sendAdminApprovedEmail,
  sendAdminInviteEmail,
  sendAdminRejectedEmail,
  sendAdminRevokedEmail,
} from "../services/emailService.js";
import {
  createBootstrapSuperadmin,
  createSession,
  deleteSession,
  findAdminByEmail,
  hasAdminUsers,
  hashPassword,
  publicAdminUser,
  requireAdmin,
  requireSuperadmin,
  verifyPassword,
} from "../services/authService.js";

const router = express.Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const adminRegistrationSchema = credentialsSchema.extend({
  name: z.string().min(1),
});

router.get("/bootstrap-state", async (_req, res, next) => {
  try {
    res.json({ hasAdminUsers: await hasAdminUsers() });
  } catch (error) {
    next(error);
  }
});

router.post("/bootstrap", async (req, res, next) => {
  try {
    const payload = adminRegistrationSchema.parse(req.body);
    const user = await createBootstrapSuperadmin(payload);
    const session = await createSession(user.id);
    res.status(201).json({ user: publicAdminUser(user), token: session.token, expiresAt: session.expiresAt });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = credentialsSchema.parse(req.body);
    const user = await findAdminByEmail(payload.email);
    if (!user || !verifyPassword(payload.password, user.password_hash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ message: "Your admin registration was not approved." });
    }
    if (user.status === "revoked") {
      return res.status(403).json({ message: "Your admin access has been revoked." });
    }
    if (user.status !== "approved") {
      return res.status(403).json({ message: "Admin account is waiting for approval" });
    }

    const session = await createSession(user.id);
    return res.json({ user: publicAdminUser(user), token: session.token, expiresAt: session.expiresAt });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", requireAdmin, async (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    await deleteSession(header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ user: publicAdminUser(req.adminUser) });
});

router.get("/users", requireAdmin, requireSuperadmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, name, role, status, created_at, approved_at FROM admin_users ORDER BY created_at DESC",
    );
    res.json({ users: rows.map(publicAdminUser) });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/status", requireAdmin, requireSuperadmin, async (req, res, next) => {
  try {
    const payload = z.object({ status: z.enum(["approved", "pending", "revoked", "rejected"]) }).parse(req.body);
    const before = await pool.query("SELECT * FROM admin_users WHERE id = $1", [req.params.id]);
    const prev = before.rows[0];
    if (!prev) return res.status(404).json({ message: "Admin user not found" });
    if (prev.role === "superadmin") {
      return res.status(400).json({ message: "Superadmin status cannot be changed here" });
    }

    const { rows } = await pool.query(
      `UPDATE admin_users
       SET status = $2,
           approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
           approved_at = CASE
             WHEN $2 = 'approved' THEN NOW()
             WHEN $2 = 'rejected' THEN NULL
             ELSE approved_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, payload.status, req.adminUser.id],
    );
    const updated = rows[0];
    if (!updated) return res.status(404).json({ message: "Admin user not found" });

    if (payload.status === "revoked") {
      await pool.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [req.params.id]);
    }

    if (prev.status !== updated.status) {
      const emailTo = updated.email;
      const name = updated.name;
      const notify = async () => {
        if (updated.status === "approved") await sendAdminApprovedEmail({ to: emailTo, name });
        else if (updated.status === "rejected") await sendAdminRejectedEmail({ to: emailTo, name });
        else if (updated.status === "revoked") await sendAdminRevokedEmail({ to: emailTo, name });
      };
      try {
        await notify();
      } catch (err) {
        console.error("[email] admin status notification failed:", err?.message || err);
      }
    }

    return res.json({ user: publicAdminUser(updated) });
  } catch (error) {
    return next(error);
  }
});

router.post("/invites", requireAdmin, requireSuperadmin, async (req, res, next) => {
  try {
    if (!env.emailSkipSend && !env.smtpConfigured) {
      return res.status(503).json({
        message:
          "Invite email is not configured. Set EMAIL_USER and EMAIL_PASS (and optional SMTP_*), or set EMAIL_SKIP_SEND=true for local development only.",
      });
    }
    const payload = z.object({ email: z.string().email() }).parse(req.body);
    const id = randomUUID();
    const token = randomBytes(24).toString("hex");
    const inviteTtlMs = env.adminInviteExpiryHours * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + inviteTtlMs).toISOString();
    const registerUrl = `${env.appUrl.replace(/\/$/, "")}/admin/invite/${token}`;
    const { rows } = await pool.query(
      `INSERT INTO admin_invites (id, email, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, token, status, expires_at, created_at`,
      [id, payload.email.toLowerCase(), token, req.adminUser.id, expiresAt],
    );
    try {
      await sendAdminInviteEmail({
        to: payload.email.toLowerCase(),
        registerUrl,
        expiresAt,
      });
    } catch (err) {
      await pool.query("DELETE FROM admin_invites WHERE id = $1", [id]);
      const mailError = new Error(err?.message || "Failed to send invite email");
      mailError.status = 502;
      throw mailError;
    }
    res.status(201).json({
      invite: {
        ...rows[0],
        link: registerUrl,
        emailSent: !env.emailSkipSend,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/invites/:token", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, status, expires_at FROM admin_invites WHERE token = $1 AND expires_at > NOW()",
      [req.params.token],
    );
    if (!rows[0] || rows[0].status !== "pending") {
      return res.status(404).json({ message: "Invite is invalid or expired" });
    }
    return res.json({ invite: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/invites/:token/register", async (req, res, next) => {
  try {
    const payload = adminRegistrationSchema.parse(req.body);
    const inviteResult = await pool.query(
      "SELECT * FROM admin_invites WHERE token = $1 AND status = 'pending' AND expires_at > NOW()",
      [req.params.token],
    );
    const invite = inviteResult.rows[0];
    if (!invite || invite.email !== payload.email.toLowerCase()) {
      return res.status(400).json({ message: "Invite email does not match or invite is expired" });
    }

    const id = randomUUID();
    const userResult = await pool.query(
      `INSERT INTO admin_users (id, email, name, password_hash, role, status, invited_by)
       VALUES ($1, $2, $3, $4, 'admin', 'pending', $5)
       RETURNING *`,
      [id, payload.email.toLowerCase(), payload.name, hashPassword(payload.password), invite.invited_by],
    );
    await pool.query("UPDATE admin_invites SET status = 'accepted', accepted_by = $2, updated_at = NOW() WHERE id = $1", [
      invite.id,
      id,
    ]);
    return res.status(201).json({ user: publicAdminUser(userResult.rows[0]) });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "An admin account already exists for this email" });
    }
    return next(error);
  }
});

export default router;
