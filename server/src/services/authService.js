import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { pool } from "../db/pool.js";

const SESSION_DAYS = 7;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, derived] = String(storedHash || "").split(":");
  if (!salt || !derived) return false;
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(derived, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

export function publicAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    approvedAt: user.approved_at,
  };
}

export async function hasAdminUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM admin_users");
  return rows[0].count > 0;
}

export async function createBootstrapSuperadmin({ email, name, password }) {
  const exists = await hasAdminUsers();
  if (exists) {
    const error = new Error("Superadmin already exists");
    error.status = 409;
    throw error;
  }

  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO admin_users (id, email, name, password_hash, role, status, approved_at)
     VALUES ($1, $2, $3, $4, 'superadmin', 'approved', NOW())
     RETURNING *`,
    [id, email.toLowerCase(), name, hashPassword(password)],
  );
  return rows[0];
}

export async function findAdminByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM admin_users WHERE email = $1", [email.toLowerCase()]);
  return rows[0] || null;
}

export async function createSession(adminUserId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query("INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    adminUserId,
    expiresAt.toISOString(),
  ]);
  return { token, expiresAt };
}

export async function getSessionUser(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.*
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)],
  );
  const user = rows[0] || null;
  if (!user || user.status !== "approved") return null;
  return user;
}

export async function deleteSession(token) {
  if (!token) return;
  await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function requireAdmin(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const user = await getSessionUser(token);
    if (!user) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    req.adminUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireSuperadmin(req, res, next) {
  if (req.adminUser?.role !== "superadmin") {
    return res.status(403).json({ message: "Superadmin access required" });
  }
  return next();
}
