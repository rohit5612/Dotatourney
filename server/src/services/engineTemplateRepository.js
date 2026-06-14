import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    description: row.description || "",
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEngineTemplates() {
  const { rows } = await pool.query(
    `SELECT id, label, description, config, created_at, updated_at
     FROM engine_templates
     ORDER BY updated_at DESC, label ASC`,
  );
  return rows.map(mapRow);
}

export async function getEngineTemplate(id) {
  const { rows } = await pool.query(
    `SELECT id, label, description, config, created_at, updated_at
     FROM engine_templates
     WHERE id = $1`,
    [id],
  );
  return mapRow(rows[0]);
}

export async function createEngineTemplate({ label, description = "", config }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO engine_templates (id, label, description, config)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, label, description, config, created_at, updated_at`,
    [id, label, description, JSON.stringify(config || {})],
  );
  return mapRow(rows[0]);
}

export async function updateEngineTemplate(id, { label, description, config }) {
  const { rows } = await pool.query(
    `UPDATE engine_templates
     SET label = COALESCE($2, label),
         description = COALESCE($3, description),
         config = COALESCE($4::jsonb, config),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, label, description, config, created_at, updated_at`,
    [
      id,
      label ?? null,
      description ?? null,
      config != null ? JSON.stringify(config) : null,
    ],
  );
  if (!rows[0]) {
    const err = new Error("Engine template not found");
    err.status = 404;
    throw err;
  }
  return mapRow(rows[0]);
}

export async function deleteEngineTemplate(id) {
  const { rowCount } = await pool.query(`DELETE FROM engine_templates WHERE id = $1`, [id]);
  if (!rowCount) {
    const err = new Error("Engine template not found");
    err.status = 404;
    throw err;
  }
  await pool.query(`UPDATE tournaments SET engine_template_id = NULL WHERE engine_template_id = $1`, [id]);
}
