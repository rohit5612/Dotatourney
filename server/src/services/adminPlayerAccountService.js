import { pool } from "../db/pool.js";
import { publicPlayerAccount, findAccountById } from "./playerAccountRepository.js";
import { getCoinBalance } from "./playerAccountRepository.js";
import { buildCardManifest, listCardAssetsForAccount } from "./cardManifestService.js";
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
      cardTierOverride: account.card_tier_override || null,
      clips: Array.isArray(account.clips) ? account.clips : [],
      achievements: Array.isArray(account.achievements) ? account.achievements : [],
    },
    card,
    cardAssets: await listCardAssetsForAccount(id),
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

export async function uploadPlayerCardAdmin(accountId, body, adminUserId) {
  const account = await findAccountById(accountId);
  if (!account) return null;

  const tier = body.tier;
  if (!["player", "gold", "holo"].includes(tier)) {
    const err = new Error("tier must be player, gold, or holo");
    err.status = 400;
    throw err;
  }

  let seasonId = body.seasonId || null;
  let tournamentId = body.tournamentId || null;
  if (!tournamentId && body.tournamentSlug) {
    const { rows } = await pool.query(`SELECT id FROM tournaments WHERE slug = $1`, [body.tournamentSlug]);
    tournamentId = rows[0]?.id || null;
  }
  if (!seasonId && tournamentId) {
    const { rows } = await pool.query(
      `SELECT id FROM seasons WHERE tournament_id = $1 ORDER BY number DESC LIMIT 1`,
      [tournamentId],
    );
    seasonId = rows[0]?.id || null;
  }

  const { upsertCardAsset } = await import("./paymentService.js");
  const asset = await upsertCardAsset(accountId, {
    tier,
    assetUrl: body.assetUrl || "",
    tagline: body.tagline || "",
    manifestJson: body.manifestJson || body.manifest || null,
    seasonId,
    tournamentId,
    status: body.approve === false ? "pending" : "approved",
  });

  if (body.approve !== false && asset) {
    await pool.query(
      `UPDATE player_card_assets SET approved_at = NOW(), approved_by = $2 WHERE id = $1`,
      [asset.id, adminUserId],
    );
  }

  const applyProfileTier = body.applyProfileTier !== false;
  if (applyProfileTier) {
    await pool.query(
      `UPDATE player_accounts SET card_tier_override = $2, updated_at = NOW() WHERE id = $1`,
      [accountId, tier],
    );
    account.card_tier_override = tier;
  }

  const card = await buildCardManifest(account, { tournamentId });
  const cardAssets = await listCardAssetsForAccount(accountId);
  return { asset, card, cardAssets };
}

export async function removePlayerCardAdmin(accountId) {
  const account = await findAccountById(accountId);
  if (!account) return null;

  await pool.query(`DELETE FROM player_card_assets WHERE player_account_id = $1`, [accountId]);
  await pool.query(
    `UPDATE player_accounts SET card_tier_override = NULL, updated_at = NOW() WHERE id = $1`,
    [accountId],
  );
  account.card_tier_override = null;

  const card = await buildCardManifest(account);
  const cardAssets = await listCardAssetsForAccount(accountId);
  return { card, cardAssets };
}

export async function patchPlayerAccountAdmin(id, { adminNotes, displayName, avatarUrl }) {
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
  if (avatarUrl !== undefined) {
    values.push(avatarUrl);
    fields.push(`avatar_url = $${values.length}`);
  }
  if (!fields.length) return findAccountById(id);
  const { rows } = await pool.query(
    `UPDATE player_accounts SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values,
  );
  return rows[0] || null;
}
