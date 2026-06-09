import { pool } from "../db/pool.js";
import { findAccountBySlug } from "./playerAccountRepository.js";

function seasonBadgeFromSeason(season) {
  if (!season) return null;
  const num = season.number != null ? `S${season.number}` : "";
  const theme = season.theme_key ? String(season.theme_key).replace(/_/g, " ") : "";
  const label = [num, theme].filter(Boolean).join(" ");
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : season.name || null;
}

async function findRegistrationForAccount(accountId, tournamentId) {
  if (!tournamentId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM player_registrations
     WHERE player_account_id = $1 AND tournament_id = $2 AND archived_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [accountId, tournamentId],
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

async function findCardAsset(accountId, tier) {
  const { rows } = await pool.query(
    `SELECT * FROM player_card_assets WHERE player_account_id = $1 AND tier = $2`,
    [accountId, tier],
  );
  return rows[0] || null;
}

function parseRoles(registration, fallbackRole = "") {
  if (!registration) return fallbackRole ? [fallbackRole] : [];
  const roles = registration.roles;
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      return JSON.parse(roles);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Build card manifest JSON for web, Discord, and GSI overlay consumers.
 */
export async function buildCardManifest(accountRow, options = {}) {
  const account = accountRow?.id ? accountRow : await findAccountBySlug(accountRow);
  if (!account) return null;

  const tournamentId = options.tournamentId || null;
  let season = options.season || null;
  if (!season && tournamentId) {
    season = await findActiveSeasonForTournament(tournamentId);
  }
  if (!season && options.seasonSlug) {
    const { rows } = await pool.query(`SELECT * FROM seasons WHERE slug = $1`, [options.seasonSlug]);
    season = rows[0] || null;
  }

  const registration =
    options.registration || (await findRegistrationForAccount(account.id, season?.tournament_id || tournamentId));
  const cardTier = registration?.card_tier || options.cardTier || "default";
  const asset = await findCardAsset(account.id, cardTier === "default" ? "gold" : cardTier);

  const roles = parseRoles(registration);
  const primaryRole = roles[0] || "";

  return {
    tier: cardTier,
    bpcId: account.bpc_id,
    displayName: account.display_name || account.steam_persona || account.slug,
    slug: account.slug,
    seasonBadge: seasonBadgeFromSeason(season),
    stats: {
      mmr: registration?.mmr ?? null,
      role: primaryRole,
      roles,
    },
    steamAvatar: account.steam_avatar_url || account.avatar_url || "",
    customImage: asset?.status === "approved" ? asset.asset_url || null : null,
    tagline: asset?.status === "approved" ? asset.tagline || null : null,
    frameTheme: season?.theme_key || "emerald",
    assetStatus: asset?.status || null,
  };
}

export async function buildCardManifestBySlug(slug, options = {}) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return buildCardManifest(account, options);
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
