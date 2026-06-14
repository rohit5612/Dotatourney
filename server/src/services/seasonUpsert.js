import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { parseSeasonLabelFromName, seasonSlugFromLabel } from "../utils/tournamentNaming.js";

function parseLocalDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function todayLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function resolveSeasonStatusFromTournament(tournamentRow) {
  if (!tournamentRow) return "upcoming";
  if (tournamentRow.status === "concluded") return "concluded";
  // Published tournaments are always a live public season, even before the start date.
  if (tournamentRow.is_published || tournamentRow.status === "published") return "active";
  const start = parseLocalDateOnly(tournamentRow.start_date);
  const today = todayLocalDate();
  if (start && start > today) return "upcoming";
  if (tournamentRow.status === "approved") return "upcoming";
  return "upcoming";
}

/** Keep a seasons row in sync when a tournament is approved or published. */
export async function upsertSeasonForTournament(tournamentRow, { client = null } = {}) {
  const db = client || pool;
  if (!tournamentRow?.id) return null;
  if (["draft", "archived"].includes(tournamentRow.status)) return null;

  const { rows: existing } = await db.query(`SELECT id, status FROM seasons WHERE tournament_id = $1`, [tournamentRow.id]);
  if (existing[0]?.status === "concluded") return existing[0];

  const status = resolveSeasonStatusFromTournament(tournamentRow);
  const name = tournamentRow.name || "Season";
  const slug = seasonSlugFromLabel(parseSeasonLabelFromName(name) || tournamentRow.slug || "season");

  if (existing[0]) {
    const { rows } = await db.query(
      `UPDATE seasons SET name = $2, slug = $3, status = $4, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [existing[0].id, name, slug, status],
    );
    return rows[0];
  }

  const { rows: maxNum } = await db.query(`SELECT COALESCE(MAX(number), 0) + 1 AS n FROM seasons`);
  const { rows } = await db.query(
    `INSERT INTO seasons (id, number, slug, theme_key, name, status, tournament_id)
     VALUES ($1, $2, $3, 'emerald', $4, $5, $6)
     RETURNING *`,
    [randomUUID(), maxNum[0].n, slug, name, status, tournamentRow.id],
  );
  return rows[0];
}
