import { pool } from "../db/pool.js";
import { findAccountByBpcId, findAccountBySlug } from "./playerAccountRepository.js";
import { getActiveSeasonTournamentId, getDisplaySeasonTournamentId } from "./paymentService.js";
import { parseTournamentDeckTheme } from "../utils/tournamentDeckTheme.js";
import { demoAccessCardTier, isDemoAccessAccount } from "../utils/demoAccessAccount.js";

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

function seasonBadgeFromSeason(season, tournament) {
  if (tournament?.season_card_badge) return String(tournament.season_card_badge).trim();
  if (!season) return null;
  const num = season.number != null ? `S${season.number}` : "";
  const theme = season.theme_key ? String(season.theme_key).replace(/_/g, " ") : "";
  const label = [num, theme].filter(Boolean).join(" ");
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : season.name || null;
}

async function findBestRegistration(accountId, tournamentId) {
  const resolvedTournamentId = tournamentId || (await getDisplaySeasonTournamentId());
  if (!resolvedTournamentId) return null;

  const { rows } = await pool.query(
    `SELECT * FROM player_registrations
     WHERE player_account_id = $1 AND tournament_id = $2 AND archived_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [accountId, resolvedTournamentId],
  );
  return rows[0] || null;
}

async function findActiveSeasonForTournament(tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM seasons
     WHERE tournament_id = $1
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, number DESC
     LIMIT 1`,
    [tournamentId],
  );
  return rows[0] || null;
}

async function findActiveSeason() {
  const { rows } = await pool.query(
    `SELECT * FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
  );
  return rows[0] || null;
}

async function findLatestConcludedSeason() {
  const { rows } = await pool.query(
    `SELECT * FROM seasons WHERE status = 'concluded' ORDER BY number DESC LIMIT 1`,
  );
  return rows[0] || null;
}

async function resolvePublicDisplaySeasonContext() {
  const active = await findActiveSeason();
  if (active) return { season: active, graceDisplay: false };
  const concluded = await findLatestConcludedSeason();
  if (concluded) return { season: concluded, graceDisplay: true };
  const { rows } = await pool.query(
    `SELECT * FROM seasons WHERE status = 'upcoming' ORDER BY number DESC LIMIT 1`,
  );
  return { season: rows[0] || null, graceDisplay: false };
}

async function findFrozenSnapshotManifest(accountId, seasonId) {
  const { rows } = await pool.query(
    `SELECT manifest_json FROM player_season_card_snapshots
     WHERE player_account_id = $1 AND season_id = $2`,
    [accountId, seasonId],
  );
  return parseManifestJson(rows[0]?.manifest_json);
}

function manifestForMainDisplay(manifest) {
  if (!manifest) return null;
  const badge = manifest.seasonValidity?.badge || manifest.seasonBadge;
  return {
    ...manifest,
    frozenSnapshot: false,
    seasonValidity: {
      ...(manifest.seasonValidity || {}),
      collectionOnly: false,
      active: true,
      label: badge ? `Valid for ${badge}` : manifest.seasonValidity?.label || "Season card",
    },
  };
}

async function findTournament(tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(`SELECT * FROM tournaments WHERE id = $1`, [tournamentId]);
  return rows[0] || null;
}

async function findSeasonScopedCardAsset(accountId, { tournamentId = null, seasonId = null } = {}) {
  if (!seasonId && !tournamentId) return null;

  const conditions = ["player_account_id = $1"];
  const params = [accountId];

  if (seasonId) {
    params.push(seasonId);
    conditions.push(`season_id = $${params.length}`);
  }
  if (tournamentId) {
    params.push(tournamentId);
    conditions.push(`tournament_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM player_card_assets
     WHERE ${conditions.join(" AND ")}
       AND status IN ('approved', 'pending')
     ORDER BY
       CASE COALESCE(NULLIF(TRIM(tier), ''), 'default')
         WHEN 'holo' THEN 0
         WHEN 'gold' THEN 1
         WHEN 'player' THEN 2
         ELSE 3
       END,
       CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
       updated_at DESC
     LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

function assetMatchesSeasonScope(asset, { seasonId = null, tournamentId = null } = {}) {
  if (!asset) return false;
  if (seasonId && asset.season_id !== seasonId) return false;
  if (tournamentId && asset.tournament_id !== tournamentId) return false;
  return true;
}

async function findCardAsset(accountId, tier, { tournamentId = null, seasonId = null } = {}) {
  if (!tier || tier === "default") return null;
  if (!tournamentId && !seasonId) return null;

  if (tournamentId) {
    const scoped = await pool.query(
      `SELECT * FROM player_card_assets
       WHERE player_account_id = $1 AND tier = $2 AND tournament_id = $3
       ORDER BY updated_at DESC
       LIMIT 1`,
      [accountId, tier, tournamentId],
    );
    if (scoped.rows[0]) return scoped.rows[0];
  }

  if (seasonId) {
    const scoped = await pool.query(
      `SELECT * FROM player_card_assets
       WHERE player_account_id = $1 AND tier = $2 AND season_id = $3
       ORDER BY updated_at DESC
       LIMIT 1`,
      [accountId, tier, seasonId],
    );
    if (scoped.rows[0]) return scoped.rows[0];
  }

  return null;
}

function parseRoles(registration, account) {
  if (registration) {
    const roles = registration.roles;
    if (Array.isArray(roles)) return roles;
    if (typeof roles === "string") {
      try {
        return JSON.parse(roles);
      } catch {
        return [];
      }
    }
  }
  const preferred = account?.preferred_roles;
  if (Array.isArray(preferred)) return preferred;
  return [];
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

function isApprovedCardAsset(asset) {
  if (!asset || asset.status !== "approved") return false;
  if (String(asset.asset_url || "").trim()) return true;
  const manifest = parseManifestJson(asset.manifest_json);
  return Boolean(manifest?.version && manifest?.template);
}

function seasonValidityFromContext({ season, tournament, asset, collectionOnly = false, graceDisplay = false }) {
  const badge = seasonBadgeFromSeason(season, tournament);
  const validFrom =
    tournament?.registrations_open_at ||
    tournament?.published_at ||
    season?.starts_at ||
    season?.created_at ||
    null;
  const revoked = asset?.status === "rejected";
  const seasonEnded = season?.status === "concluded";
  const active = !collectionOnly && !revoked && (!seasonEnded || graceDisplay);
  const label = collectionOnly
    ? badge
      ? `${badge} · Vault`
      : "Vault"
    : badge
      ? `Valid for ${badge}`
      : "Season card";
  return {
    badge,
    seasonName: season?.name || tournament?.name || null,
    seasonSlug: season?.slug || null,
    seasonNumber: season?.number ?? null,
    validFrom,
    validUntil: null,
    active,
    collectionOnly,
    label,
  };
}

function resolveAccountPortraitUrl(account) {
  return String(account.avatar_url || account.steam_avatar_url || "").trim();
}

function applyAccountPortraitToPayload(payload, account) {
  const customAvatar = String(account.avatar_url || "").trim();
  if (customAvatar) {
    payload.avatarUrl = customAvatar;
    return payload;
  }
  if (!String(payload.avatarUrl || "").trim()) {
    payload.avatarUrl = resolveAccountPortraitUrl(account);
  }
  return payload;
}

function buildTemplateCardPayload(tier, account, registration, roles) {
  const primaryRole = roles[0] || "";
  return {
    version: 1,
    template: tier,
    tier,
    playerName: account.display_name || account.steam_persona || account.slug,
    avatarUrl: resolveAccountPortraitUrl(account),
    stats: {
      kda: "--",
      gpm: "--",
      xpm: "--",
      winrate: "--",
      role: primaryRole,
      mmr: registration?.mmr ?? account.mmr ?? null,
    },
  };
}

function buildCardPayload(asset, account, registration, roles, { freeze = false } = {}) {
  const stored = parseManifestJson(asset?.manifest_json);
  if (stored && Object.keys(stored).length > 0) {
    if (freeze) return { ...stored };
    return applyAccountPortraitToPayload({ ...stored }, account);
  }
  if (asset?.asset_url) {
    return { template: asset.tier, imageUrl: asset.asset_url };
  }
  return {
    ...buildTemplateCardPayload(asset?.tier || "gold", account, registration, roles),
    tagline: asset?.tagline || null,
  };
}

function freezeManifestVisuals(manifest, { account, asset, tournament, season }) {
  if (!manifest) return null;
  const payload = manifest.cardPayload || {};
  const frozenAvatar =
    String(payload.avatarUrl || "").trim() ||
    String(manifest.customAvatarUrl || "").trim() ||
    String(manifest.avatarUrl || "").trim() ||
    String(account?.avatar_url || "").trim() ||
    String(account?.steam_avatar_url || "").trim();

  manifest.avatarUrl = frozenAvatar;
  manifest.customAvatarUrl = frozenAvatar;
  manifest.steamAvatarUrl = String(account?.steam_avatar_url || "").trim();
  manifest.steamAvatar = manifest.steamAvatarUrl || frozenAvatar;
  manifest.customAvatarCrop =
    account?.avatar_portrait_crop && typeof account.avatar_portrait_crop === "object"
      ? account.avatar_portrait_crop
      : manifest.customAvatarCrop || {};
  if (manifest.cardPayload && typeof manifest.cardPayload === "object") {
    manifest.cardPayload = {
      ...manifest.cardPayload,
      avatarUrl: frozenAvatar,
      playerName: manifest.cardPayload.playerName || manifest.displayName,
    };
  }
  manifest.frozenSnapshot = true;
  manifest.tournamentPresentation = {
    seasonCardBg: tournament?.season_card_bg || null,
    seasonCardBadge: tournament?.season_card_badge || null,
    deckBadgeTheme: parseTournamentDeckTheme(tournament?.season_card_deck_theme),
    themeKey: season?.theme_key || "emerald",
    tournamentName: tournament?.name || season?.name || null,
  };
  if (asset) {
    manifest.frozenAsset = {
      assetUrl: asset.asset_url || "",
      manifestJson: parseManifestJson(asset.manifest_json),
      tagline: asset.tagline || "",
      tier: asset.tier,
      seasonId: asset.season_id || null,
      tournamentId: asset.tournament_id || null,
    };
    manifest.customImage = asset.asset_url || manifest.customImage || null;
    manifest.tagline = asset.tagline || manifest.tagline || null;
  }
  return manifest;
}

/**
 * Build card manifest JSON for web, Discord, and GSI overlay consumers.
 * Default-season card for everyone; premium tiers render built-in templates immediately.
 */
export async function buildCardManifest(accountRow, options = {}) {
  const account = accountRow?.id ? accountRow : await findAccountBySlug(accountRow);
  if (!account) return null;

  let season = options.season || null;
  let tournament = null;
  let tournamentId = options.tournamentId || null;
  let graceDisplay = Boolean(options.graceDisplay);

  const registration =
    options.registration ||
    (await findBestRegistration(account.id, tournamentId || season?.tournament_id || null));

  if (!season && registration?.tournament_id) {
    tournamentId = registration.tournament_id;
    season = await findActiveSeasonForTournament(tournamentId);
  }
  if (!season && tournamentId) {
    season = await findActiveSeasonForTournament(tournamentId);
  }
  if (!season && options.seasonSlug) {
    const { rows } = await pool.query(`SELECT * FROM seasons WHERE slug = $1`, [options.seasonSlug]);
    season = rows[0] || null;
    if (season?.tournament_id) tournamentId = season.tournament_id;
  }
  if (!season && !options.freezeSnapshot) {
    const displayCtx = await resolvePublicDisplaySeasonContext();
    season = displayCtx.season;
    graceDisplay = displayCtx.graceDisplay;
    if (season?.tournament_id) tournamentId = season.tournament_id;
  }

  if (tournamentId) {
    tournament = await findTournament(tournamentId);
  }

  const registrationTier = registration?.card_tier || options.cardTier || "default";
  const purchasedTier =
    (isDemoAccessAccount(account) ? demoAccessCardTier(account) : null) || registrationTier;
  const freezeSnapshot = Boolean(options.freezeSnapshot);
  const directoryDisplay = Boolean(options.directoryDisplay);
  const seasonScope = { tournamentId, seasonId: season?.id || null };
  const asset =
    options.assetOverride !== undefined
      ? options.assetOverride
      : directoryDisplay || PREMIUM_TIERS.has(purchasedTier)
        ? await findSeasonScopedCardAsset(account.id, seasonScope)
        : null;
  const scopedAsset = assetMatchesSeasonScope(asset, seasonScope) ? asset : null;
  const displayAsset =
    directoryDisplay && !PREMIUM_TIERS.has(purchasedTier) ? null : scopedAsset;
  const assetApproved = isApprovedCardAsset(displayAsset);
  const effectiveTier = freezeSnapshot
    ? options.cardTier || purchasedTier || "default"
    : directoryDisplay
      ? purchasedTier || "default"
      : pickHighestTier([purchasedTier, assetApproved ? displayAsset?.tier : null]);
  const cardPending = PREMIUM_TIERS.has(effectiveTier) && !assetApproved;
  const usesPremiumTemplate = PREMIUM_TIERS.has(effectiveTier);

  const renderTier = usesPremiumTemplate ? effectiveTier : "default";
  const roles = parseRoles(registration, account);
  const primaryRole = roles[0] || "";
  const seasonValidity = seasonValidityFromContext({
    season,
    tournament,
    asset: displayAsset,
    collectionOnly: Boolean(options.collectionOnly || options.historicalContext),
    graceDisplay,
  });
  const cardPayload = assetApproved
    ? buildCardPayload(displayAsset, account, registration, roles, { freeze: freezeSnapshot })
    : usesPremiumTemplate
      ? buildTemplateCardPayload(effectiveTier, account, registration, roles)
      : null;

  const manifest = {
    tier: effectiveTier,
    purchasedTier,
    tierOverride: null,
    renderTier,
    template: usesPremiumTemplate
      ? parseManifestJson(displayAsset?.manifest_json)?.template || effectiveTier
      : "default",
    bpcId: account.bpc_id,
    displayName: account.display_name || account.steam_persona || account.slug,
    slug: account.slug,
    seasonBadge: seasonValidity.badge,
    seasonValidity,
    stats: {
      mmr: registration?.mmr ?? account.mmr ?? null,
      role: primaryRole,
      roles,
    },
    avatarUrl: resolveAccountPortraitUrl(account),
    customAvatarUrl: account.avatar_url || "",
    customAvatarCrop:
      account.avatar_portrait_crop && typeof account.avatar_portrait_crop === "object"
        ? account.avatar_portrait_crop
        : {},
    steamAvatarUrl: account.steam_avatar_url || "",
    steamAvatar: resolveAccountPortraitUrl(account),
    customImage: assetApproved ? displayAsset.asset_url || null : null,
    tagline: assetApproved ? displayAsset.tagline || null : null,
    frameTheme: season?.theme_key || "emerald",
    assetStatus: displayAsset?.status || (PREMIUM_TIERS.has(effectiveTier) ? "pending" : null),
    cardPending,
    cardPayload,
  };

  if (!manifest) return null;

  if (freezeSnapshot) {
    manifest.cardPending = false;
    return freezeManifestVisuals(manifest, { account, asset: displayAsset, tournament, season });
  }

  return manifest;
}

/**
 * Public-facing card for profiles, community, and overlays.
 * Keeps the latest concluded season visible until a newer season is published.
 */
export async function buildPublicDisplayCardManifest(accountRow, options = {}) {
  const account = accountRow?.id ? accountRow : await findAccountBySlug(accountRow);
  if (!account) return null;

  const displayCtx = await resolvePublicDisplaySeasonContext();
  if (displayCtx.graceDisplay && displayCtx.season && !options.freezeSnapshot) {
    const frozen = await findFrozenSnapshotManifest(account.id, displayCtx.season.id);
    const fromSnapshot = manifestForMainDisplay(frozen);
    if (fromSnapshot) return fromSnapshot;
  }

  return buildCardManifest(account, {
    ...options,
    season: options.season || displayCtx.season,
    tournamentId: options.tournamentId || displayCtx.season?.tournament_id || null,
    graceDisplay: options.graceDisplay ?? displayCtx.graceDisplay,
  });
}

export async function buildCardManifestBySlug(slug, options = {}) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return buildPublicDisplayCardManifest(account, options);
}

export async function buildCardManifestByBpcId(bpcId, options = {}) {
  const account = await findAccountByBpcId(bpcId);
  if (!account) return null;
  return buildPublicDisplayCardManifest(account, options);
}

export async function listCardAssetsForAccount(accountId) {
  const { rows } = await pool.query(
    `SELECT id, tier, asset_url, tagline, status, manifest_json, season_id, tournament_id, created_at, updated_at, approved_at
     FROM player_card_assets
     WHERE player_account_id = $1
     ORDER BY updated_at DESC, tier`,
    [accountId],
  );
  return rows.map((row) => ({
    id: row.id,
    tier: row.tier,
    assetUrl: row.asset_url,
    tagline: row.tagline,
    status: row.status,
    manifestJson: parseManifestJson(row.manifest_json),
    seasonId: row.season_id,
    tournamentId: row.tournament_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  }));
}

export async function buildMatchRosterCards(matchId) {
  const { rows: matchRows } = await pool.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
  const match = matchRows[0];
  if (!match) return null;

  const roster = await pool.query(
    `SELECT rs.id FROM roster_snapshots rs
     WHERE rs.tournament_id = $1 AND rs.status = 'approved'
     ORDER BY rs.approved_at DESC LIMIT 1`,
    [match.tournament_id],
  );
  const rosterId = roster.rows[0]?.id;
  if (!rosterId) {
    return {
      match: { id: match.id, team1: match.team1, team2: match.team2, stageKey: match.stage_key },
      team1: { name: match.team1, cards: [] },
      team2: { name: match.team2, cards: [] },
    };
  }

  async function cardsForTeamName(teamName) {
    const { rows } = await pool.query(
      `SELECT rsp.*, pa.*, r.card_tier
       FROM roster_snapshot_teams rst
       JOIN roster_snapshot_team_players rstp ON rstp.team_id = rst.id
       JOIN roster_snapshot_players rsp ON rsp.id = rstp.player_id
       LEFT JOIN player_accounts pa ON pa.id = rsp.player_account_id
       LEFT JOIN player_registrations r ON r.player_account_id = pa.id
         AND r.tournament_id = $3 AND r.archived_at IS NULL
       WHERE rst.roster_snapshot_id = $1 AND lower(rst.name) = lower($2)`,
      [rosterId, teamName, match.tournament_id],
    );
    const cards = [];
    for (const row of rows) {
      if (!row.player_account_id) continue;
      const manifest = await buildCardManifest(row, {
        tournamentId: match.tournament_id,
        registration: {
          mmr: row.mmr,
          roles: row.roles,
          card_tier: row.card_tier,
        },
      });
      if (manifest) cards.push(manifest);
    }
    return cards;
  }

  const [team1Cards, team2Cards] = await Promise.all([
    cardsForTeamName(match.team1),
    cardsForTeamName(match.team2),
  ]);

  return {
    match: {
      id: match.id,
      team1: match.team1,
      team2: match.team2,
      stageKey: match.stage_key,
      status: match.status,
    },
    team1: { name: match.team1, cards: team1Cards },
    team2: { name: match.team2, cards: team2Cards },
  };
}

/** Minimal 1×1 PNG stub for overlay integrations until sharp rendering lands. */
export const CARD_PNG_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
