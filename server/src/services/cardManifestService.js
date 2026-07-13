import { pool } from "../db/pool.js";
import { findAccountByBpcId, findAccountBySlug } from "./playerAccountRepository.js";
import { demoAccessCardTier, isDemoAccessAccount } from "../utils/demoAccessAccount.js";

const PREMIUM_TIERS = new Set(["player", "gold", "holo"]);

function seasonBadgeFromSeason(season, tournament) {
  if (tournament?.season_card_badge) return String(tournament.season_card_badge).trim();
  if (!season) return null;
  const num = season.number != null ? `S${season.number}` : "";
  const theme = season.theme_key ? String(season.theme_key).replace(/_/g, " ") : "";
  const label = [num, theme].filter(Boolean).join(" ");
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : season.name || null;
}

async function findBestRegistration(accountId, tournamentId) {
  if (tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM player_registrations
       WHERE player_account_id = $1 AND tournament_id = $2 AND archived_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [accountId, tournamentId],
    );
    return rows[0] || null;
  }
  const { rows } = await pool.query(
    `SELECT * FROM player_registrations
     WHERE player_account_id = $1 AND archived_at IS NULL
     ORDER BY CASE COALESCE(NULLIF(TRIM(card_tier), ''), 'default')
       WHEN 'holo' THEN 0 WHEN 'gold' THEN 1 WHEN 'player' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT 1`,
    [accountId],
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

async function findCurrentSeason() {
  const { rows } = await pool.query(
    `SELECT * FROM seasons
     WHERE status IN ('active', 'upcoming')
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, number DESC
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function findTournament(tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(`SELECT * FROM tournaments WHERE id = $1`, [tournamentId]);
  return rows[0] || null;
}

async function findCardAsset(accountId, tier) {
  if (!tier || tier === "default") return null;
  const { rows } = await pool.query(
    `SELECT * FROM player_card_assets WHERE player_account_id = $1 AND tier = $2`,
    [accountId, tier],
  );
  return rows[0] || null;
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

function seasonValidityFromContext({ season, tournament, asset }) {
  const badge = seasonBadgeFromSeason(season, tournament);
  const validFrom =
    tournament?.registrations_open_at ||
    tournament?.published_at ||
    season?.starts_at ||
    season?.created_at ||
    null;
  const revoked = asset?.status === "rejected";
  const seasonEnded = season?.status === "concluded";
  return {
    badge,
    seasonName: season?.name || tournament?.name || null,
    seasonSlug: season?.slug || null,
    seasonNumber: season?.number ?? null,
    validFrom,
    validUntil: null,
    active: !revoked && !seasonEnded,
    label: badge ? `Valid for ${badge}` : "Season card",
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

function buildCardPayload(asset, account, registration, roles) {
  const stored = parseManifestJson(asset?.manifest_json);
  if (stored && Object.keys(stored).length > 0) {
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

  const registration =
    options.registration ||
    (await findBestRegistration(account.id, tournamentId || season?.tournament_id || null));

  if (!season && registration?.tournament_id) {
    tournamentId = registration.tournament_id;
    season = await findActiveSeasonForTournament(tournamentId);
  }
  if (!season) {
    season = await findCurrentSeason();
    if (season?.tournament_id) tournamentId = season.tournament_id;
  }
  if (!season && options.seasonSlug) {
    const { rows } = await pool.query(`SELECT * FROM seasons WHERE slug = $1`, [options.seasonSlug]);
    season = rows[0] || null;
    if (season?.tournament_id) tournamentId = season.tournament_id;
  }

  if (tournamentId) {
    tournament = await findTournament(tournamentId);
  }

  const registrationTier =
    registration?.card_tier ||
    options.cardTier ||
    "default";
  const purchasedTier =
    (isDemoAccessAccount(account) ? demoAccessCardTier(account) : null) ||
    registrationTier;
  const adminOverride = String(account.card_tier_override || "").trim() || null;
  const effectiveTier = adminOverride || purchasedTier || "default";
  const asset = PREMIUM_TIERS.has(effectiveTier)
    ? await findCardAsset(account.id, effectiveTier)
    : null;
  const assetApproved = isApprovedCardAsset(asset);
  const cardPending = PREMIUM_TIERS.has(effectiveTier) && !assetApproved;
  const usesPremiumTemplate = PREMIUM_TIERS.has(effectiveTier);

  const renderTier = usesPremiumTemplate ? effectiveTier : "default";
  const roles = parseRoles(registration, account);
  const primaryRole = roles[0] || "";
  const seasonValidity = seasonValidityFromContext({ season, tournament, asset });
  const cardPayload = assetApproved
    ? buildCardPayload(asset, account, registration, roles)
    : usesPremiumTemplate
      ? buildTemplateCardPayload(effectiveTier, account, registration, roles)
      : null;

  const manifest = {
    tier: effectiveTier,
    purchasedTier,
    tierOverride: adminOverride,
    renderTier,
    template: usesPremiumTemplate
      ? parseManifestJson(asset?.manifest_json)?.template || effectiveTier
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
    customImage: assetApproved ? asset.asset_url || null : null,
    tagline: assetApproved ? asset.tagline || null : null,
    frameTheme: season?.theme_key || "emerald",
    assetStatus: asset?.status || (PREMIUM_TIERS.has(effectiveTier) ? "pending" : null),
    cardPending,
    cardPayload,
  };

  return manifest;
}

export async function buildCardManifestBySlug(slug, options = {}) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return buildCardManifest(account, options);
}

export async function buildCardManifestByBpcId(bpcId, options = {}) {
  const account = await findAccountByBpcId(bpcId);
  if (!account) return null;
  return buildCardManifest(account, options);
}

export async function listCardAssetsForAccount(accountId) {
  const { rows } = await pool.query(
    `SELECT id, tier, asset_url, tagline, status, manifest_json, season_id, tournament_id, created_at, updated_at, approved_at
     FROM player_card_assets WHERE player_account_id = $1 ORDER BY tier`,
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
