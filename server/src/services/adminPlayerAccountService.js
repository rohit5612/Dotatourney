import { pool } from "../db/pool.js";
import { publicPlayerAccount, findAccountById } from "./playerAccountRepository.js";
import { getCoinBalance } from "./playerAccountRepository.js";
import { buildCardManifest, listCardAssetsForAccount } from "./cardManifestService.js";
import { getPublicPlayerProfile } from "./playerProfileService.js";
import { demoAccessCardTier, isDemoAccessAccount } from "../utils/demoAccessAccount.js";

const CARD_TIER_RANK_SQL = `CASE COALESCE(NULLIF(TRIM(pr.card_tier), ''), 'default')
  WHEN 'holo' THEN 0
  WHEN 'gold' THEN 1
  WHEN 'player' THEN 2
  ELSE 3
END`;

async function getActiveSeasonContext() {
  const { rows } = await pool.query(
    `SELECT id, tournament_id, name, number
     FROM seasons
     WHERE status = 'active'
     ORDER BY number DESC
     LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    seasonId: row.id,
    tournamentId: row.tournament_id,
    seasonName: row.name || `Season ${row.number}`,
    seasonNumber: row.number,
  };
}

function buildActiveSeasonCardStatusSql(activeSeason, tournamentParamIndex, seasonParamIndex) {
  const activeTournamentId = activeSeason?.tournamentId || null;
  const activeSeasonId = activeSeason?.seasonId || null;

  const bestRegJoin = activeTournamentId
    ? `LEFT JOIN LATERAL (
      SELECT pr.card_tier
      FROM player_registrations pr
      WHERE pr.player_account_id = pa.id
        AND pr.tournament_id = $${tournamentParamIndex}
        AND pr.archived_at IS NULL
      ORDER BY ${CARD_TIER_RANK_SQL}, pr.created_at DESC
      LIMIT 1
    ) best_reg ON TRUE`
    : `LEFT JOIN LATERAL (
      SELECT NULL::text AS card_tier
    ) best_reg ON TRUE`;

  const purchasedTierExpr = `COALESCE(NULLIF(TRIM(best_reg.card_tier), ''), 'default')`;
  const cardPurchasedExpr = `${purchasedTierExpr} IN ('player', 'gold', 'holo')`;

  let cardAssetSeasonScope = "FALSE";
  if (activeSeasonId && activeTournamentId) {
    cardAssetSeasonScope = `pca.season_id = $${seasonParamIndex} AND pca.tournament_id = $${tournamentParamIndex}`;
  } else if (activeTournamentId) {
    cardAssetSeasonScope = `pca.tournament_id = $${tournamentParamIndex}`;
  }

  const cardIssuedExpr = `EXISTS (
    SELECT 1 FROM player_card_assets pca
    WHERE pca.player_account_id = pa.id
      AND pca.tier = ${purchasedTierExpr}
      AND pca.status = 'approved'
      AND ${cardAssetSeasonScope}
      AND (
        NULLIF(TRIM(pca.asset_url), '') IS NOT NULL
        OR (
          pca.manifest_json->>'version' IS NOT NULL
          AND pca.manifest_json->>'template' IS NOT NULL
        )
      )
  )`;

  return {
    bestRegJoin,
    purchasedTierExpr,
    cardPurchasedExpr,
    cardIssuedExpr,
  };
}

function mapAdminListCardStatus(row) {
  let cardPurchased = Boolean(row.card_purchased);
  let purchasedTier = row.purchased_tier || "default";
  if (!cardPurchased && isDemoAccessAccount(row)) {
    const demoTier = demoAccessCardTier(row);
    if (demoTier) {
      cardPurchased = true;
      purchasedTier = demoTier;
    }
  }
  return {
    cardPurchased,
    cardIssued: cardPurchased ? Boolean(row.card_issued) : false,
    purchasedTier: cardPurchased ? purchasedTier : null,
  };
}

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

export async function listPlayerAccountsAdmin({
  search = "",
  verified,
  cardStatus = "",
  limit = 50,
  offset = 0,
} = {}) {
  const activeSeason = await getActiveSeasonContext();
  const params = [];
  let tournamentParamIndex = null;
  let seasonParamIndex = null;
  if (activeSeason?.tournamentId) {
    params.push(activeSeason.tournamentId);
    tournamentParamIndex = params.length;
  }
  if (activeSeason?.seasonId) {
    params.push(activeSeason.seasonId);
    seasonParamIndex = params.length;
  }

  const { bestRegJoin, purchasedTierExpr, cardPurchasedExpr, cardIssuedExpr } = buildActiveSeasonCardStatusSql(
    activeSeason,
    tournamentParamIndex,
    seasonParamIndex,
  );

  const where = ["1=1"];
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where.push(`(lower(email) LIKE $${params.length} OR lower(bpc_id) LIKE $${params.length} OR lower(display_name) LIKE $${params.length} OR lower(slug) LIKE $${params.length})`);
  }
  if (verified === "true") where.push("email_verified_at IS NOT NULL");
  if (verified === "false") where.push("email_verified_at IS NULL");
  if (cardStatus === "not_purchased") where.push(`NOT (${cardPurchasedExpr})`);
  if (cardStatus === "purchased") where.push(`(${cardPurchasedExpr})`);
  if (cardStatus === "pending_issue") where.push(`(${cardPurchasedExpr}) AND NOT (${cardIssuedExpr})`);
  if (cardStatus === "issued") where.push(`(${cardPurchasedExpr}) AND (${cardIssuedExpr})`);
  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Math.max(Number(offset) || 0, 0));
  const { rows } = await pool.query(
    `SELECT pa.*,
            (SELECT COUNT(*)::int FROM player_registrations pr
             WHERE pr.player_account_id = pa.id AND pr.archived_at IS NULL) AS registration_count,
            ${purchasedTierExpr} AS purchased_tier,
            (${cardPurchasedExpr}) AS card_purchased,
            (${cardIssuedExpr}) AS card_issued
     FROM player_accounts pa
     ${bestRegJoin}
     WHERE ${where.join(" AND ")}
     ORDER BY pa.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM (
       SELECT pa.id,
              (${cardPurchasedExpr}) AS card_purchased,
              (${cardIssuedExpr}) AS card_issued
       FROM player_accounts pa
       ${bestRegJoin}
       WHERE ${where.join(" AND ")}
     ) scoped_accounts`,
    params.slice(0, -2),
  );
  return {
    accounts: rows.map((row) => ({
      ...publicPlayerAccount(row),
      adminNotes: row.admin_notes || "",
      googleLinked: Boolean(row.google_sub),
      registrationCount: row.registration_count ?? 0,
      ...mapAdminListCardStatus(row),
    })),
    total: countRows[0]?.total || 0,
    cardStatusSeason: activeSeason
      ? {
          seasonId: activeSeason.seasonId,
          seasonName: activeSeason.seasonName,
          seasonNumber: activeSeason.seasonNumber,
          tournamentId: activeSeason.tournamentId,
        }
      : null,
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

async function resolveAdminCardSeasonContext(accountId, body) {
  let tournamentId = body.tournamentId || null;
  let seasonId = body.seasonId || null;

  if (!tournamentId && body.tournamentSlug) {
    const { rows } = await pool.query(`SELECT id FROM tournaments WHERE slug = $1`, [body.tournamentSlug]);
    tournamentId = rows[0]?.id || null;
  }

  if (!tournamentId && !seasonId) {
    const { rows } = await pool.query(
      `SELECT id, tournament_id FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
    );
    seasonId = rows[0]?.id || null;
    tournamentId = rows[0]?.tournament_id || null;
  }

  if (!tournamentId) {
    const { rows } = await pool.query(
      `SELECT tournament_id
       FROM player_registrations
       WHERE player_account_id = $1
         AND archived_at IS NULL
         AND player_account_id IS NOT NULL
       ORDER BY
         CASE WHEN payment_status = 'paid' THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`,
      [accountId],
    );
    tournamentId = rows[0]?.tournament_id || null;
  }

  if (!seasonId && tournamentId) {
    const { rows } = await pool.query(
      `SELECT id FROM seasons WHERE tournament_id = $1 ORDER BY number DESC LIMIT 1`,
      [tournamentId],
    );
    seasonId = rows[0]?.id || null;
  }

  return { tournamentId, seasonId };
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

  const { seasonId, tournamentId } = await resolveAdminCardSeasonContext(accountId, body);
  if (!seasonId && !tournamentId) {
    const err = new Error("Could not resolve an active season for this card upload");
    err.status = 400;
    throw err;
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

  if (body.approve !== false && tournamentId) {
    await pool.query(
      `UPDATE player_registrations
       SET card_tier = $3, updated_at = NOW()
       WHERE player_account_id = $1
         AND tournament_id = $2
         AND archived_at IS NULL`,
      [accountId, tournamentId, tier],
    );
  }

  let seasonRow = null;
  if (seasonId) {
    const { rows } = await pool.query(`SELECT * FROM seasons WHERE id = $1`, [seasonId]);
    seasonRow = rows[0] || null;
  }

  const card = await buildCardManifest(account, { tournamentId, season: seasonRow });
  const cardAssets = await listCardAssetsForAccount(accountId);
  const { syncPlayerCardSnapshotsAfterAdminChange } = await import("./cardSnapshotService.js");
  const snapshotSync = await syncPlayerCardSnapshotsAfterAdminChange(accountId, { tournamentId }).catch(() => []);
  return { asset, card, cardAssets, snapshotSync };
}

export async function removePlayerCardAdmin(accountId) {
  const account = await findAccountById(accountId);
  if (!account) return null;

  const activeSeason = await getActiveSeasonContext();
  if (activeSeason?.seasonId) {
    await pool.query(`DELETE FROM player_card_assets WHERE player_account_id = $1 AND season_id = $2`, [
      accountId,
      activeSeason.seasonId,
    ]);
  } else if (activeSeason?.tournamentId) {
    await pool.query(`DELETE FROM player_card_assets WHERE player_account_id = $1 AND tournament_id = $2`, [
      accountId,
      activeSeason.tournamentId,
    ]);
  }

  let seasonRow = null;
  if (activeSeason?.seasonId) {
    const { rows } = await pool.query(`SELECT * FROM seasons WHERE id = $1`, [activeSeason.seasonId]);
    seasonRow = rows[0] || null;
  }

  const card = await buildCardManifest(account, {
    tournamentId: activeSeason?.tournamentId || null,
    season: seasonRow,
  });
  const cardAssets = await listCardAssetsForAccount(accountId);
  const { syncPlayerCardSnapshotsAfterAdminChange } = await import("./cardSnapshotService.js");
  const snapshotSync = await syncPlayerCardSnapshotsAfterAdminChange(accountId).catch(() => []);
  return { card, cardAssets, snapshotSync };
}

export async function patchPlayerAccountAdmin(id, { adminNotes, displayName, avatarUrl, avatarPortraitCrop }) {
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
  if (avatarPortraitCrop !== undefined) {
    values.push(JSON.stringify(avatarPortraitCrop && typeof avatarPortraitCrop === "object" ? avatarPortraitCrop : {}));
    fields.push(`avatar_portrait_crop = $${values.length}::jsonb`);
  }
  if (!fields.length) return findAccountById(id);
  const { rows } = await pool.query(
    `UPDATE player_accounts SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values,
  );
  if (rows[0] && (avatarUrl !== undefined || avatarPortraitCrop !== undefined)) {
    const { syncPlayerActiveSeasonCardSnapshot } = await import("./cardSnapshotService.js");
    await syncPlayerActiveSeasonCardSnapshot(id).catch(() => {});
  }
  return rows[0] || null;
}
