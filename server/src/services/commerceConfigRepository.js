import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

import { enrichCardTiers } from "./commerceBundle.js";

export const DEFAULT_CARD_TIERS = {
  default: {
    enabled: true,
    registrationCostRupees: 300,
    cardCostRupees: 0,
    bundledPriceRupees: 0,
    label: "Default registration",
    description: "Standard season registration",
    discountPercent: 0,
  },
  player: {
    enabled: true,
    registrationCostRupees: 300,
    cardCostRupees: 240,
    bundledPriceRupees: 240,
    label: "Basic Card Bundle",
    description: "Dark frame + stats",
    discountPercent: 0,
  },
  gold: {
    enabled: true,
    registrationCostRupees: 240,
    cardCostRupees: 300,
    bundledPriceRupees: 400,
    label: "Gold Card Bundle",
    description: "Gold frame + Custom logo slot",
    discountPercent: 0,
  },
  holo: {
    enabled: true,
    registrationCostRupees: 300,
    cardCostRupees: 600,
    bundledPriceRupees: 600,
    label: "Holo Card Bundle",
    description: "Holo frame, Custom Avatar slot + privileges*",
    discountPercent: 0,
  },
};

function mergeCardTiers(stored, registrationFeeRupees = 300) {
  return enrichCardTiers(stored, registrationFeeRupees);
}

export function publicCommerceConfig(row) {
  if (!row) return null;
  const registrationFeeRupees = row.registration_fee_rupees;
  return {
    tournamentId: row.tournament_id,
    registrationFeeRupees,
    cardTiers: mergeCardTiers(row.card_tiers, registrationFeeRupees),
    minCashRupees: row.min_cash_rupees,
    updatedAt: row.updated_at,
  };
}

export async function getCommerceConfigByTournamentId(tournamentId, db = pool) {
  const query = db.query.bind(db);
  const { rows } = await query(`SELECT * FROM tournament_commerce_config WHERE tournament_id = $1`, [tournamentId]);
  return rows[0] || null;
}

export async function getOrCreateCommerceConfig(tournamentId, db = pool) {
  const existing = await getCommerceConfigByTournamentId(tournamentId, db);
  if (existing) return existing;

  const query = db.query.bind(db);
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO tournament_commerce_config (
      id, tournament_id, registration_fee_rupees, card_tiers, min_cash_rupees
    ) VALUES ($1, $2, 300, $3::jsonb, 100)
    RETURNING *`,
    [id, tournamentId, JSON.stringify(DEFAULT_CARD_TIERS)],
  );
  return rows[0];
}

export async function upsertCommerceConfig(tournamentId, patch) {
  await getOrCreateCommerceConfig(tournamentId);
  const fields = [];
  const values = [];
  let i = 1;

  if (patch.registrationFeeRupees !== undefined) {
    fields.push(`registration_fee_rupees = $${i++}`);
    values.push(patch.registrationFeeRupees);
  }
  if (patch.cardTiers !== undefined) {
    fields.push(`card_tiers = $${i++}::jsonb`);
    const regFee =
      patch.registrationFeeRupees ??
      (await getCommerceConfigByTournamentId(tournamentId))?.registration_fee_rupees ??
      300;
    values.push(JSON.stringify(mergeCardTiers(patch.cardTiers, regFee)));
  }
  if (patch.minCashRupees !== undefined) {
    fields.push(`min_cash_rupees = $${i++}`);
    values.push(patch.minCashRupees);
  }

  if (!fields.length) return getCommerceConfigByTournamentId(tournamentId);

  fields.push(`updated_at = NOW()`);
  values.push(tournamentId);
  const { rows } = await pool.query(
    `UPDATE tournament_commerce_config SET ${fields.join(", ")} WHERE tournament_id = $${i} RETURNING *`,
    values,
  );
  return rows[0] || null;
}

export async function listCardAssetsForTournament(tournamentId) {
  const { rows } = await pool.query(
    `SELECT a.*, pa.display_name, pa.bpc_id, pa.slug, pa.email
     FROM player_card_assets a
     JOIN player_accounts pa ON pa.id = a.player_account_id
     JOIN player_registrations r ON r.player_account_id = pa.id AND r.tournament_id = $1 AND r.archived_at IS NULL
     WHERE a.status = 'pending'
     ORDER BY a.created_at ASC`,
    [tournamentId],
  );
  return rows.map((row) => ({
    id: row.id,
    playerAccountId: row.player_account_id,
    displayName: row.display_name,
    bpcId: row.bpc_id,
    slug: row.slug,
    tier: row.tier,
    assetUrl: row.asset_url,
    tagline: row.tagline,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function updateCardAssetStatus(assetId, status) {
  const { rows } = await pool.query(
    `UPDATE player_card_assets SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [assetId, status],
  );
  return rows[0] || null;
}
