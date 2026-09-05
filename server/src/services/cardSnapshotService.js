import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { buildCardManifest } from "./cardManifestService.js";
import { findAccountById } from "./playerAccountRepository.js";
import { getActiveSeasonTournamentId } from "./paymentService.js";
import { parseTournamentDeckTheme, hasDeckBadgeTheme } from "../utils/tournamentDeckTheme.js";

const PREMIUM_TIERS = new Set(["player", "gold", "holo"]);
const TIER_RANK = { holo: 0, gold: 1, player: 2, default: 3 };

function normalizeTier(tier) {
  const value = String(tier || "default").trim().toLowerCase();
  return PREMIUM_TIERS.has(value) || value === "default" ? value : "default";
}

function pickHighestTier(tiers) {
  const ranked = tiers.map(normalizeTier).filter(Boolean);
  if (!ranked.length) return "default";
  return ranked.sort((a, b) => (TIER_RANK[a] ?? 3) - (TIER_RANK[b] ?? 3))[0];
}

/**
 * Resolve vault tier from purchase, admin override, and season-scoped uploaded assets.
 */
export function resolveSeasonSnapshotTier(account, registration, asset) {
  return pickHighestTier([
    registration?.card_tier,
    account?.card_tier_override,
    asset?.tier,
  ]);
}

function isSnapshotWorthyAsset(asset) {
  if (!asset) return false;
  if (asset.status === "approved") return true;
  if (String(asset.asset_url || "").trim()) return true;
  const manifest = parseManifestJson(asset.manifest_json);
  return Boolean(manifest && Object.keys(manifest).length > 0);
}

function parseManifestJson(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function markManifestAsCollection(manifest, season) {
  if (!manifest) return null;
  const badge = manifest.seasonValidity?.badge || manifest.seasonBadge;
  const seasonLabel =
    badge ||
    (season?.number != null ? `S${season.number}` : null) ||
    season?.name ||
    "Season";
  return {
    ...manifest,
    seasonValidity: {
      ...(manifest.seasonValidity || {}),
      active: false,
      collectionOnly: true,
      label: `${seasonLabel} · Vault`,
    },
  };
}

export { markManifestAsCollection };

function resolveDeckBadgeTheme(manifest, tournamentThemeRaw) {
  const fromManifest =
    manifest?.tournamentPresentation?.deckBadgeTheme || manifest?.deckBadgeTheme || null;
  const fromTournament = parseTournamentDeckTheme(tournamentThemeRaw);
  if (hasDeckBadgeTheme(fromManifest)) return parseTournamentDeckTheme(fromManifest);
  if (hasDeckBadgeTheme(fromTournament)) return fromTournament;
  return { badgeBackground: "", badgeText: "" };
}

async function findTournament(tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(`SELECT * FROM tournaments WHERE id = $1`, [tournamentId]);
  return rows[0] || null;
}

async function findSeasonForTournament(tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(`SELECT * FROM seasons WHERE tournament_id = $1 ORDER BY number DESC LIMIT 1`, [
    tournamentId,
  ]);
  return rows[0] || null;
}

const CARD_ASSET_ORDER_SQL = `CASE COALESCE(NULLIF(TRIM(tier), ''), 'default')
         WHEN 'holo' THEN 0
         WHEN 'gold' THEN 1
         WHEN 'player' THEN 2
         ELSE 3
       END,
       CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
       updated_at DESC`;

async function findBestSeasonCardAsset(accountId, { tournamentId, seasonId } = {}) {
  if (tournamentId || seasonId) {
    const { rows } = await pool.query(
      `SELECT *
       FROM player_card_assets
       WHERE player_account_id = $1
         AND (
           ($2::uuid IS NOT NULL AND tournament_id = $2)
           OR ($3::uuid IS NOT NULL AND season_id = $3)
         )
         AND status IN ('approved', 'pending')
       ORDER BY ${CARD_ASSET_ORDER_SQL}`,
      [accountId, tournamentId || null, seasonId || null],
    );
    const scoped = rows.find(isSnapshotWorthyAsset);
    if (scoped) return scoped;
  }

  const { rows: fallbackRows } = await pool.query(
    `SELECT *
     FROM player_card_assets
     WHERE player_account_id = $1
       AND status IN ('approved', 'pending')
     ORDER BY ${CARD_ASSET_ORDER_SQL}`,
    [accountId],
  );
  return fallbackRows.find(isSnapshotWorthyAsset) || null;
}

async function listSeasonSnapshotAccountIds(tournamentId, seasonId) {
  const ids = new Set();

  const { rows: registrations } = await pool.query(
    `SELECT DISTINCT player_account_id
     FROM player_registrations
     WHERE tournament_id = $1
       AND archived_at IS NULL
       AND player_account_id IS NOT NULL`,
    [tournamentId],
  );
  for (const row of registrations) ids.add(row.player_account_id);

  const { rows: assetAccounts } = await pool.query(
    `SELECT DISTINCT player_account_id
     FROM player_card_assets
     WHERE (tournament_id = $1 OR season_id = $2)
       AND status IN ('approved', 'pending')
       AND (
         COALESCE(NULLIF(TRIM(asset_url), ''), '') <> ''
         OR manifest_json <> '{}'::jsonb
       )`,
    [tournamentId, seasonId],
  );
  for (const row of assetAccounts) ids.add(row.player_account_id);

  return [...ids];
}

async function findSeasonCardAsset(accountId, tier, { tournamentId, seasonId } = {}) {
  if (!tier || tier === "default") return null;

  if (tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM player_card_assets
       WHERE player_account_id = $1 AND tier = $2 AND tournament_id = $3
       ORDER BY updated_at DESC LIMIT 1`,
      [accountId, tier, tournamentId],
    );
    if (rows[0]) return rows[0];
  }

  if (seasonId) {
    const { rows } = await pool.query(
      `SELECT * FROM player_card_assets
       WHERE player_account_id = $1 AND tier = $2 AND season_id = $3
       ORDER BY updated_at DESC LIMIT 1`,
      [accountId, tier, seasonId],
    );
    if (rows[0]) return rows[0];
  }

  const { rows } = await pool.query(
    `SELECT * FROM player_card_assets
     WHERE player_account_id = $1 AND tier = $2
     ORDER BY
       CASE WHEN tournament_id = $3 THEN 0 WHEN season_id = $4 THEN 1 ELSE 2 END,
       updated_at DESC
     LIMIT 1`,
    [accountId, tier, tournamentId || null, seasonId || null],
  );
  return rows[0] || null;
}

async function loadSeasonRegistration(playerAccountId, tournamentId) {
  const { rows } = await pool.query(
    `SELECT * FROM player_registrations
     WHERE player_account_id = $1
       AND tournament_id = $2
       AND archived_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [playerAccountId, tournamentId],
  );
  return rows[0] || null;
}

/**
 * Build a frozen collection manifest preserving uploaded logos, GIF portraits, and holo config.
 */
export async function buildFrozenSeasonCardManifest(account, registration, season, tournament) {
  const tournamentId = tournament?.id || season?.tournament_id || registration?.tournament_id;
  const seasonId = season?.id || null;
  const bestSeasonAsset = await findBestSeasonCardAsset(account.id, { tournamentId, seasonId });
  const snapshotTier = resolveSeasonSnapshotTier(account, registration, bestSeasonAsset);
  const asset =
    (bestSeasonAsset && normalizeTier(bestSeasonAsset.tier) === snapshotTier
      ? bestSeasonAsset
      : null) ||
    (PREMIUM_TIERS.has(snapshotTier)
      ? await findSeasonCardAsset(account.id, snapshotTier, { tournamentId, seasonId })
      : null) ||
    bestSeasonAsset;

  const registrationForManifest = {
    ...(registration || {}),
    tournament_id: tournamentId,
    card_tier: snapshotTier,
  };

  const manifest = await buildCardManifest(account, {
    season,
    tournamentId,
    registration: registrationForManifest,
    cardTier: snapshotTier,
    historicalContext: true,
    freezeSnapshot: true,
    assetOverride: asset,
  });

  if (!manifest) return null;

  const purchasedTier = normalizeTier(registration?.card_tier || "default");
  const adminGranted =
    Boolean(asset) &&
    (purchasedTier !== snapshotTier ||
      (PREMIUM_TIERS.has(snapshotTier) && purchasedTier === "default"));
  if (adminGranted) {
    manifest.adminGranted = true;
    manifest.grantSource = "admin_card_upload";
  }

  return markManifestAsCollection(manifest, season);
}

async function snapshotPlayerForSeason(accountId, { tournamentId, season, tournament }) {
  const account = await findAccountById(accountId);
  if (!account) return false;

  const registration = await loadSeasonRegistration(accountId, tournamentId);
  const bestSeasonAsset = await findBestSeasonCardAsset(account.id, {
    tournamentId,
    seasonId: season.id,
  });

  if (!registration && !bestSeasonAsset) return false;

  const manifest = await buildFrozenSeasonCardManifest(
    account,
    registration || { tournament_id: tournamentId, card_tier: "default" },
    season,
    tournament,
  );
  if (!manifest) return false;

  await upsertSeasonCardSnapshot({
    playerAccountId: account.id,
    seasonId: season.id,
    tournamentId,
    cardTier: manifest.tier || resolveSeasonSnapshotTier(account, registration, bestSeasonAsset),
    manifest,
  });
  return true;
}

export async function upsertSeasonCardSnapshot({
  playerAccountId,
  seasonId,
  tournamentId,
  cardTier,
  manifest,
}) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO player_season_card_snapshots (
       id, player_account_id, season_id, tournament_id, card_tier, manifest_json
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (player_account_id, season_id)
     DO UPDATE SET
       tournament_id = EXCLUDED.tournament_id,
       card_tier = EXCLUDED.card_tier,
       manifest_json = EXCLUDED.manifest_json,
       snapshot_at = NOW()`,
    [
      id,
      playerAccountId,
      seasonId,
      tournamentId || null,
      cardTier || "default",
      JSON.stringify(manifest || {}),
    ],
  );
}

/**
 * Upsert the live season card snapshot for one player while their season tournament is active.
 */
export async function syncPlayerActiveSeasonCardSnapshot(playerAccountId, { tournamentId = null } = {}) {
  const resolvedTournamentId = tournamentId || (await getActiveSeasonTournamentId());
  if (!resolvedTournamentId || !playerAccountId) return null;

  const season = await findSeasonForTournament(resolvedTournamentId);
  if (!season || season.status !== "active") return null;

  const tournament = await findTournament(resolvedTournamentId);
  const saved = await snapshotPlayerForSeason(playerAccountId, {
    tournamentId: resolvedTournamentId,
    season,
    tournament,
  });
  if (!saved) return null;

  return { seasonId: season.id, tournamentId: resolvedTournamentId, status: "active" };
}

/**
 * Refresh vault/active snapshots after admin card upload or removal.
 * Re-snapshots concluded seasons the player participated in (or was scoped to).
 */
export async function syncPlayerCardSnapshotsAfterAdminChange(playerAccountId, { tournamentId = null } = {}) {
  if (!playerAccountId) return [];

  const synced = [];
  const { rows: concludedSeasons } = await pool.query(
    `SELECT s.*
     FROM seasons s
     WHERE s.status = 'concluded'
       AND (
         EXISTS (
           SELECT 1 FROM player_registrations pr
           WHERE pr.player_account_id = $1
             AND pr.tournament_id = s.tournament_id
             AND pr.archived_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM player_card_assets pca
           WHERE pca.player_account_id = $1
             AND (pca.tournament_id = s.tournament_id OR pca.season_id = s.id)
         )
         OR ($2::uuid IS NOT NULL AND s.tournament_id = $2)
       )
     ORDER BY s.number DESC`,
    [playerAccountId, tournamentId || null],
  );

  for (const season of concludedSeasons) {
    const tournament = await findTournament(season.tournament_id);
    const saved = await snapshotPlayerForSeason(playerAccountId, {
      tournamentId: season.tournament_id,
      season,
      tournament,
    });
    if (saved) {
      synced.push({ seasonId: season.id, tournamentId: season.tournament_id, status: "concluded" });
    }
  }

  const active = await syncPlayerActiveSeasonCardSnapshot(playerAccountId, { tournamentId });
  if (active) synced.push(active);

  return synced;
}

/**
 * Seed or refresh snapshots for every registration on the active season tournament.
 */
export async function syncAllActiveSeasonCardSnapshots(tournamentId) {
  const season = await findSeasonForTournament(tournamentId);
  if (!season || season.status !== "active") return { count: 0 };

  const accountIds = await listSeasonSnapshotAccountIds(tournamentId, season.id);
  const tournament = await findTournament(tournamentId);

  let count = 0;
  for (const accountId of accountIds) {
    const saved = await snapshotPlayerForSeason(accountId, {
      tournamentId,
      season,
      tournament,
    });
    if (saved) count += 1;
  }
  return { count, seasonId: season.id };
}

/**
 * Snapshot all registrations for a concluded season tournament.
 */
export async function snapshotSeasonCardsForTournament(tournamentId) {
  const season = await findSeasonForTournament(tournamentId);
  if (!season) return { count: 0, seasonId: null };

  const tournament = await findTournament(tournamentId);
  const accountIds = await listSeasonSnapshotAccountIds(tournamentId, season.id);

  let count = 0;
  for (const accountId of accountIds) {
    const saved = await snapshotPlayerForSeason(accountId, {
      tournamentId,
      season,
      tournament,
    });
    if (saved) count += 1;
  }

  return { count, seasonId: season.id };
}

/**
 * When a new season goes live: refresh concluded-season vault snapshots,
 * clear stale admin display overrides, and seed default cards for the new season.
 */
export async function finalizeVaultOnNewSeasonPublish(newTournamentId) {
  const newSeason = await findSeasonForTournament(newTournamentId);
  if (!newSeason) return { concludedSnapshots: 0, activeSnapshots: 0 };

  const { rows: concludedSeasons } = await pool.query(
    `SELECT tournament_id FROM seasons WHERE status = 'concluded' ORDER BY number ASC`,
  );

  let concludedSnapshots = 0;
  for (const season of concludedSeasons) {
    if (!season.tournament_id) continue;
    const result = await snapshotSeasonCardsForTournament(season.tournament_id);
    concludedSnapshots += result.count;
  }

  await pool.query(
    `UPDATE player_accounts SET card_tier_override = NULL, updated_at = NOW() WHERE card_tier_override IS NOT NULL`,
  );

  const activeResult = await syncAllActiveSeasonCardSnapshots(newTournamentId);

  return {
    concludedSnapshots,
    activeSnapshots: activeResult.count,
    newSeasonId: newSeason.id,
  };
}

export async function listSeasonCardSnapshotsForAccount(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT ps.*, s.number AS season_number, s.slug AS season_slug, s.name AS season_name, s.status AS season_status,
            t.season_card_deck_theme
     FROM player_season_card_snapshots ps
     JOIN seasons s ON s.id = ps.season_id
     LEFT JOIN tournaments t ON t.id = ps.tournament_id
     WHERE ps.player_account_id = $1
       AND s.status = 'concluded'
     ORDER BY s.number DESC`,
    [playerAccountId],
  );

  return rows.map((row) => {
    const manifest = parseManifestJson(row.manifest_json);
    const deckBadgeTheme = resolveDeckBadgeTheme(manifest, row.season_card_deck_theme);
    return {
      seasonId: row.season_id,
      seasonSlug: row.season_slug,
      seasonNumber: row.season_number,
      seasonName: row.season_name,
      seasonStatus: row.season_status,
      tier: row.card_tier,
      manifest,
      deckBadgeTheme,
      snapshotAt: row.snapshot_at,
      collectionOnly: true,
    };
  });
}
