import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { logAction } from "../utils/serverLogger.js";

export async function writeAuditLog({ adminUserId, action, entityType = "", entityId = "", payload = {} }) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO audit_log (id, admin_user_id, action, entity_type, entity_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [id, adminUserId || null, action, entityType, String(entityId || ""), JSON.stringify(payload || {})],
  );
  logAction("admin", action, { adminUserId, entityType, entityId, payload });
  return { id };
}

export async function listAuditLog({ limit = 50, offset = 0, entityType, entityId } = {}) {
  const params = [];
  const clauses = [];
  if (entityType) {
    params.push(entityType);
    clauses.push(`entity_type = $${params.length}`);
  }
  if (entityId) {
    params.push(String(entityId));
    clauses.push(`entity_id = $${params.length}`);
  }
  params.push(Math.min(Math.max(1, limit), 200));
  params.push(Math.max(0, offset));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT a.*, u.email AS admin_email, u.name AS admin_name
     FROM audit_log a
     LEFT JOIN admin_users u ON u.id = a.admin_user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}
