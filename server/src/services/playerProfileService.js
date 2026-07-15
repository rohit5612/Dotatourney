import { pool } from "../db/pool.js";
import { steam64ToSteam32 } from "../utils/steamId.js";
import { syncRegistrationCapState } from "./registrationRepository.js";
import {
  findAccountBySlug,
  publicPlayerProfileAccount,
  publicSteamOnlyProfile,
  getCoinBalance,
} from "./playerAccountRepository.js";
import { buildCardManifest } from "./cardManifestService.js";
import { getOrCreateCommerceConfig, publicCommerceConfig } from "./commerceConfigRepository.js";
import { getPlayerMatchAppearances, getPlayerMatchSchedule } from "./matchSubstitutionService.js";
import { findActivePlayerTeamOnTournament } from "./rosterMembershipService.js";
import {
  buildPlayerRecognitions,
  buildGlobalRecognitionIndex,
  buildPublicMatchHistory,
  buildTeamStintHistory,
  resolveTeamHighestStage,
} from "./playerRecognitionService.js";

export async function getPublicPlayerProfileSteamOnly(slug) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return { profile: publicSteamOnlyProfile(account) };
}

export async function findPlayerTeamOnTournament(playerAccountId, tournamentId) {
  return findActivePlayerTeamOnTournament(playerAccountId, tournamentId);
}

async function enrichSeasonHistory(participations) {
  const enriched = [];
  for (const row of participations) {
    let highestStage = null;
    let teamLogoUrl = "";
    if (row.tournament_id && row.team_name) {
      const { rows: tourRows } = await pool.query(`SELECT format FROM tournaments WHERE id = $1`, [
        row.tournament_id,
      ]);
      highestStage = await resolveTeamHighestStage(row.tournament_id, row.team_name, tourRows[0]?.format);

      const { rows: logoRows } = await pool.query(
        `SELECT rst.logo_url
         FROM roster_snapshot_teams rst
         JOIN roster_snapshots rs ON rs.id = rst.roster_snapshot_id AND rs.status = 'approved'
         WHERE rs.tournament_id = $1 AND lower(rst.name) = lower($2)
         ORDER BY rs.approved_at DESC NULLS LAST
         LIMIT 1`,
        [row.tournament_id, row.team_name],
      );
      teamLogoUrl = logoRows[0]?.logo_url || "";
    }

    enriched.push({
      seasonSlug: row.season_slug,
      seasonName: row.season_name,
      seasonNumber: row.season_number,
      seasonStatus: row.season_status,
      teamName: row.team_name,
      teamLogoUrl,
      placement: row.placement,
      highestStage,
      role: row.role,
      honors: row.honors,
      stats: row.stats,
    });
  }
  return enriched;
}

export async function getPublicPlayerProfile(slug) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;

  const card = await buildCardManifest(account);

  const { rows: participations } = await pool.query(
    `SELECT sp.*, s.slug AS season_slug, s.name AS season_name, s.number AS season_number, s.status AS season_status
     FROM season_participations sp
     JOIN seasons s ON s.id = sp.season_id
     WHERE sp.player_account_id = $1
     ORDER BY s.number DESC`,
    [account.id],
  );

  const { rows: registrations } = await pool.query(
    `SELECT r.*, t.name AS tournament_name, t.slug AS tournament_slug
     FROM player_registrations r
     JOIN tournaments t ON t.id = r.tournament_id
     WHERE r.player_account_id = $1 AND r.archived_at IS NULL
     ORDER BY r.created_at DESC`,
    [account.id],
  );

  let currentTeam = null;
  const activeSeason = await pool.query(
    `SELECT * FROM seasons WHERE status IN ('active', 'upcoming') ORDER BY number DESC LIMIT 1`,
  );
  const season = activeSeason.rows[0];
  if (season?.tournament_id) {
    currentTeam = await findActivePlayerTeamOnTournament(account.id, season.tournament_id);
  }

  const teamHistory = await buildTeamStintHistory(account.id);
  const matchHistory = await buildPublicMatchHistory(account.id);
  const recognitions = await buildPlayerRecognitions(account.id);
  const seasonHistory = await enrichSeasonHistory(participations);

  const approvedCount = registrations.filter((r) => r.registration_status === "approved").length;
  const substituteAppearances = matchHistory.filter((entry) => entry.playedAsSub).length;

  return {
    account: publicPlayerProfileAccount(account),
    card,
    currentTeam,
    career: {
      approvedRegistrations: approvedCount,
      totalRegistrations: registrations.length,
      substituteAppearances,
      matchesPlayed: matchHistory.filter((entry) => !entry.wasReplaced).length,
    },
    seasonHistory,
    teamHistory,
    matchHistory,
    recognitions,
    registrations: registrations.map((r) => ({
      id: r.id,
      tournamentName: r.tournament_name,
      tournamentSlug: r.tournament_slug,
      status: r.registration_status,
      paymentStatus: r.payment_status,
      cardTier: r.card_tier,
      substitute: r.substitute_flag,
      createdAt: r.created_at,
    })),
    clips: Array.isArray(account.clips) ? account.clips : [],
    achievements: Array.isArray(account.achievements) ? account.achievements : [],
  };
}

export async function getPlayerTeamForAccount(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT tournament_id FROM seasons WHERE status = 'active' ORDER BY number DESC LIMIT 1`,
  );
  let tournamentId = rows[0]?.tournament_id;
  if (!tournamentId) {
    const pub = await pool.query(
      `SELECT id FROM tournaments WHERE is_published = TRUE ORDER BY published_at DESC LIMIT 1`,
    );
    tournamentId = pub.rows[0]?.id;
  }
  if (!tournamentId) return { team: null };
  const team = await findActivePlayerTeamOnTournament(playerAccountId, tournamentId);
  return { team, tournamentId };
}

export async function getPlayerMatchesForAccount(playerAccountId) {
  return getPlayerMatchSchedule(playerAccountId);
}

function cardTierRankSql(column = "card_tier") {
  return `CASE COALESCE(NULLIF(TRIM(${column}), ''), 'default')
    WHEN 'holo' THEN 0
    WHEN 'gold' THEN 1
    WHEN 'player' THEN 2
    ELSE 3
  END`;
}

export async function getCommunityDirectory({ search = "", tier = "", limit = 48, offset = 0 } = {}) {
  const params = [];
  const lateralJoin = `LEFT JOIN LATERAL (
       SELECT pr.card_tier
       FROM player_registrations pr
       WHERE pr.player_account_id = pa.id AND pr.archived_at IS NULL
       ORDER BY ${cardTierRankSql("pr.card_tier")}, pr.created_at DESC
       LIMIT 1
     ) best_card ON TRUE`;
  const effectiveTierExpr = `COALESCE(NULLIF(TRIM(pa.card_tier_override), ''), best_card.card_tier, 'default')`;

  let where = `WHERE pa.email_verified_at IS NOT NULL
    AND pa.steam_id IS NOT NULL
    AND TRIM(pa.steam_id) <> ''`;
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where += ` AND (lower(pa.display_name) LIKE $${params.length} OR lower(pa.slug) LIKE $${params.length} OR lower(pa.bpc_id) LIKE $${params.length})`;
  }
  const tierFilter = String(tier || "").trim().toLowerCase();
  if (tierFilter === "gold" || tierFilter === "holo") {
    params.push(tierFilter);
    where += ` AND lower(${effectiveTierExpr}) = $${params.length}`;
  }

  const countParams = [...params];
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM player_accounts pa ${lateralJoin} ${where}`,
    countParams,
  );
  const total = countRows[0]?.total ?? 0;

  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);
  params.push(safeLimit);
  params.push(safeOffset);

  const tierRank = cardTierRankSql(effectiveTierExpr);
  const { rows } = await pool.query(
    `SELECT pa.*, best_card.card_tier AS directory_card_tier
     FROM player_accounts pa
     ${lateralJoin}
     ${where}
     ORDER BY ${tierRank}, pa.display_name ASC NULLS LAST, pa.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const recognitionIndex = await buildGlobalRecognitionIndex();
  const players = [];
  for (const account of rows) {
    const registrationTier = account.directory_card_tier || "default";
    const card = await buildCardManifest(account, {
      registration: { card_tier: registrationTier },
    });
    const recognitions = recognitionIndex.get(String(account.id)) || [];
    players.push({
      slug: account.slug,
      bpcId: account.bpc_id,
      displayName: account.display_name || account.slug,
      steam32Id: steam64ToSteam32(account.steam_id),
      avatarUrl: account.avatar_url || account.steam_avatar_url || "",
      cardTier: card?.tier || registrationTier,
      card,
      badges: recognitions.map(({ label, kind }) => ({ label, kind })),
    });
  }
  return { players, total, limit: safeLimit, offset: safeOffset };
}

export async function getPlayerDashboardHistory(playerAccountId) {
  const account = await pool.query(`SELECT id FROM player_accounts WHERE id = $1`, [playerAccountId]);
  if (!account.rows[0]) return null;

  const full = await getPublicPlayerProfile(
    (await pool.query(`SELECT slug FROM player_accounts WHERE id = $1`, [playerAccountId])).rows[0]?.slug,
  );
  if (!full) return null;
  const matchAppearances = await getPlayerMatchAppearances(playerAccountId);
  return {
    seasonHistory: full.seasonHistory,
    teamHistory: full.teamHistory,
    registrations: full.registrations,
    career: full.career,
    matchAppearances,
    matchHistory: full.matchHistory,
    recognitions: full.recognitions,
  };
}

export async function getUpcomingTournamentsForPlayer(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.slug, t.name, t.registrations_open, t.registration_cap, t.start_date, t.end_date,
            t.entry_fee, t.prize_pool, t.season_card_bg, t.season_card_badge
     FROM tournaments t
     WHERE t.is_published = TRUE
     ORDER BY t.registrations_open DESC, t.published_at DESC NULLS LAST`,
  );

  const tournaments = [];
  for (const t of rows) {
    const commerceRow = await getOrCreateCommerceConfig(t.id);
    const commerce = publicCommerceConfig(commerceRow);
    const capState = await syncRegistrationCapState(t.id);
    const [{ rows: existing }] = await Promise.all([
      pool.query(
        `SELECT registration_status, payment_status FROM player_registrations
         WHERE tournament_id = $1 AND player_account_id = $2 AND archived_at IS NULL
         LIMIT 1`,
        [t.id, playerAccountId],
      ),
    ]);
    const reg = existing[0];
    const entryFeeText = String(t.entry_fee || "").trim();
    const registrationsOpen = capState.changed ? false : t.registrations_open === true;
    tournaments.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      registrationsOpen,
      substitutePoolOpen: capState.reached && !registrationsOpen,
      startDate: t.start_date,
      endDate: t.end_date,
      entryFee: commerce?.registrationFeeRupees ?? 300,
      entryFeeLabel: entryFeeText || `₹${commerce?.registrationFeeRupees ?? 300}`,
      prizePool: String(t.prize_pool || "").trim() || null,
      seasonCardBg: String(t.season_card_bg || "").trim() || null,
      seasonCardBadge: String(t.season_card_badge || "").trim() || null,
      registrationCount: capState.count,
      registrationLimit: capState.cap,
      commerce,
      registrationStatus: reg?.registration_status || null,
      paymentStatus: reg?.payment_status || null,
    });
  }
  return { tournaments };
}

export async function getPlayerCoinSummary(playerAccountId, { limit = 30, offset = 0 } = {}) {
  const balance = await getCoinBalance(playerAccountId);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM bpc_coin_ledger WHERE player_account_id = $1`,
    [playerAccountId],
  );

  const { rows } = await pool.query(
    `SELECT id, delta, balance_after, reason, created_at
     FROM bpc_coin_ledger
     WHERE player_account_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [playerAccountId, safeLimit, safeOffset],
  );
  return {
    balance,
    ledger: rows.map((row) => ({
      id: row.id,
      delta: row.delta,
      balanceAfter: row.balance_after,
      reason: row.reason,
      createdAt: row.created_at,
    })),
    total: countRows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}
