import { pool } from "../src/db/pool.js";

/**
 * Copy mmr, preferred_roles, location from each player's latest registration into player_accounts.
 */
async function main() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (r.player_account_id)
        r.player_account_id,
        r.mmr,
        r.roles,
        r.location
     FROM player_registrations r
     WHERE r.player_account_id IS NOT NULL AND r.archived_at IS NULL
     ORDER BY r.player_account_id, r.created_at DESC`,
  );

  let updated = 0;
  for (const row of rows) {
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const result = await pool.query(
      `UPDATE player_accounts
       SET mmr = COALESCE(mmr, $2),
           preferred_roles = CASE WHEN preferred_roles = '[]'::jsonb THEN $3::jsonb ELSE preferred_roles END,
           location = CASE WHEN location = '' THEN COALESCE($4, '') ELSE location END,
           updated_at = NOW()
       WHERE id = $1`,
      [row.player_account_id, row.mmr, JSON.stringify(roles), row.location || ""],
    );
    updated += result.rowCount;
  }

  console.log(`Backfilled profile fields for ${updated} player account(s) from ${rows.length} registration row(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
