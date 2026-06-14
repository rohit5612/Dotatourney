import { pool } from "../db/pool.js";
import { publicPlayerAccount, findAccountById } from "./playerAccountRepository.js";
import { getCoinBalance } from "./playerAccountRepository.js";
import { buildCardManifest } from "./cardManifestService.js";
import { getPublicPlayerProfile } from "./playerProfileService.js";

function mapRegistrationRow(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    registrationStatus: row.registration_status,
    paymentStatus: row.payment_status,
    substituteFlag: Boolean(row.substitute_flag),
    cardTier: row.card_tier || "default",
    createdAt: row.created_at,
  };
}

function mapLedgerRow(row) {
  return {
    id: row.id,
    delta: row.delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    tournamentId: row.tournament_id,
    createdAt: row.created_at,
  };
}

export async function listPlayerAccountsAdmin({ search = "", verified, limit = 50, offset = 0 } = {}) {
  const params = [];
  const where = ["1=1"];
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where.push(`(lower(email) LIKE $${params.length} OR lower(bpc_id) LIKE $${params.length} OR lower(display_name) LIKE $${params.length} OR lower(slug) LIKE $${params.length})`);
  }
  if (verified === "true") where.push("email_verified_at IS NOT NULL");
  if (verified === "false") where.push("email_verified_at IS NULL");
  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Math.max(Number(offset) || 0, 0));
  const { rows } = await pool.query(
    `SELECT pa.*,
            (SELECT COUNT(*)::int FROM player_registrations pr
             WHERE pr.player_account_id = pa.id AND pr.archived_at IS NULL) AS registration_count
     FROM player_accounts pa
     WHERE ${where.join(" AND ")}
     ORDER BY pa.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM player_accounts WHERE ${where.join(" AND ")}`,
    params.slice(0, -2),
  );
  return {
    accounts: rows.map((row) => ({
      ...publicPlayerAccount(row),
      adminNotes: row.admin_notes || "",
      googleLinked: Boolean(row.google_sub),
      registrationCount: row.registration_count ?? 0,
    })),
    total: countRows[0]?.total || 0,
  };
}

export async function getPlayerAccountAdminDetail(id) {
  const account = await findAccountById(id);
  if (!account) return null;
  const balance = await getCoinBalance(id);
  const card = await buildCardManifest(account);
  const { rows: registrations } = await pool.query(
    `SELECT pr.id, pr.tournament_id, t.name AS tournament_name, pr.registration_status, pr.payment_status,
            pr.substitute_flag, pr.card_tier, pr.created_at
     FROM player_registrations pr
     JOIN tournaments t ON t.id = pr.tournament_id
     WHERE pr.player_account_id = $1 AND pr.archived_at IS NULL
     ORDER BY pr.created_at DESC`,
    [id],
  );
  const { rows: ledger } = await pool.query(
    `SELECT id, delta, balance_after, reason, tournament_id, created_at
     FROM bpc_coin_ledger WHERE player_account_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [id],
  );

  const publicProfile = account.slug ? await getPublicPlayerProfile(account.slug) : null;

  return {
    account: {
      ...publicPlayerAccount(account),
      adminNotes: account.admin_notes || "",
      googleLinked: Boolean(account.google_sub),
      clips: Array.isArray(account.clips) ? account.clips : [],
      achievements: Array.isArray(account.achievements) ? account.achievements : [],
    },
    card,
    coinBalance: balance,
    registrations: registrations.map(mapRegistrationRow),
    ledger: ledger.map(mapLedgerRow),
    profile: publicProfile
      ? {
          currentTeam: publicProfile.currentTeam,
          career: publicProfile.career,
          seasonHistory: publicProfile.seasonHistory,
          teamHistory: publicProfile.teamHistory,
        }
      : null,
  };
}

export async function patchPlayerAccountAdmin(id, { adminNotes, displayName }) {
  const fields = [];
  const values = [id];
  if (adminNotes !== undefined) {
    values.push(adminNotes);
    fields.push(`admin_notes = $${values.length}`);
  }
  if (displayName !== undefined) {
    values.push(displayName);
    fields.push(`display_name = $${values.length}`);
  }
  if (!fields.length) return findAccountById(id);
  const { rows } = await pool.query(
    `UPDATE player_accounts SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values,
  );
  return rows[0] || null;
}
