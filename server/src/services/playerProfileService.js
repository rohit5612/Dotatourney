import { pool } from "../db/pool.js";
import {
  findAccountBySlug,
  publicPlayerAccount,
  publicSteamOnlyProfile,
  getCoinBalance,
} from "./playerAccountRepository.js";
import { buildCardManifest } from "./cardManifestService.js";
import { getOrCreateCommerceConfig, publicCommerceConfig } from "./commerceConfigRepository.js";

export async function getPublicPlayerProfileSteamOnly(slug) {
  const account = await findAccountBySlug(slug);
  if (!account) return null;
  return { profile: publicSteamOnlyProfile(account) };
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
    currentTeam = await findPlayerTeamOnTournament(account.id, season.tournament_id);
  }

  const teamHistory = await pool.query(
    `SELECT DISTINCT ON (rs.id)
        rs.id AS roster_snapshot_id,
        rs.name AS roster_name,
        rs.approved_at,
        rst.name AS team_name,
        rst.logo_url,
        t.name AS tournament_name,
        t.slug AS tournament_slug
     FROM roster_snapshot_players rsp
     JOIN roster_snapshots rs ON rs.id = rsp.roster_snapshot_id AND rs.status = 'approved'
     JOIN roster_snapshot_team_players rstp ON rstp.player_id = rsp.id
     JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     JOIN tournaments t ON t.id = rs.tournament_id
     WHERE rsp.player_account_id = $1
     ORDER BY rs.id, rs.approved_at DESC`,
    [account.id],
  );

  const approvedCount = registrations.filter((r) => r.registration_status === "approved").length;

  return {
    account: publicPlayerAccount(account),
    card,
    currentTeam,
    career: {
      approvedRegistrations: approvedCount,
      totalRegistrations: registrations.length,
    },
    seasonHistory: participations.map((row) => ({
      seasonSlug: row.season_slug,
      seasonName: row.season_name,
      seasonNumber: row.season_number,
      seasonStatus: row.season_status,
      teamName: row.team_name,
      placement: row.placement,
      role: row.role,
      honors: row.honors,
      stats: row.stats,
    })),
    teamHistory: teamHistory.rows.map((row) => ({
      rosterSnapshotId: row.roster_snapshot_id,
      rosterName: row.roster_name,
      teamName: row.team_name,
      logoUrl: row.logo_url,
      tournamentName: row.tournament_name,
      tournamentSlug: row.tournament_slug,
      approvedAt: row.approved_at,
    })),
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

export async function findPlayerTeamOnTournament(playerAccountId, tournamentId) {
  const { rows } = await pool.query(
    `SELECT rsp.id AS player_id, rsp.name, rsp.display_name, rsp.role, rsp.roles, rsp.mmr,
            rst.id AS team_id, rst.name AS team_name, rst.logo_url, rst.accent_color, rst.captain
     FROM roster_snapshot_players rsp
     JOIN roster_snapshots rs ON rs.id = rsp.roster_snapshot_id AND rs.status = 'approved'
     JOIN roster_snapshot_team_players rstp ON rstp.player_id = rsp.id
     JOIN roster_snapshot_teams rst ON rst.id = rstp.team_id
     WHERE rs.tournament_id = $1 AND rsp.player_account_id = $2
     ORDER BY rs.approved_at DESC NULLS LAST
     LIMIT 1`,
    [tournamentId, playerAccountId],
  );
  const row = rows[0];
  if (!row) return null;

  const { rows: teammates } = await pool.query(
    `SELECT rsp.id, rsp.display_name, rsp.name, rsp.role, rsp.player_account_id
     FROM roster_snapshot_team_players rstp
     JOIN roster_snapshot_players rsp ON rsp.id = rstp.player_id
     WHERE rstp.team_id = $1
     ORDER BY rsp.is_captain DESC, rsp.display_name ASC NULLS LAST, rsp.name ASC`,
    [row.team_id],
  );

  return {
    tournamentId,
    team: {
      id: row.team_id,
      name: row.team_name,
      logoUrl: row.logo_url || "",
      accentColor: row.accent_color || "",
      captain: row.captain || "",
    },
    player: {
      id: row.player_id,
      name: row.display_name || row.name,
      role: row.role,
      mmr: row.mmr,
    },
    teammates: teammates.map((p) => ({
      id: p.id,
      name: p.display_name || p.name,
      role: p.role,
      playerAccountId: p.player_account_id,
    })),
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
  const team = await findPlayerTeamOnTournament(playerAccountId, tournamentId);
  return { team, tournamentId };
}

export async function getPlayerMatchesForAccount(playerAccountId) {
  const { team: teamInfo, tournamentId } = await getPlayerTeamForAccount(playerAccountId);
  if (!teamInfo?.team?.name || !tournamentId) {
    return { matches: [], teamName: null };
  }

  const teamName = teamInfo.team.name;
  const { rows: matches } = await pool.query(
    `SELECT m.*, ss.start_at, ss.stream AS schedule_stream, ss.status AS schedule_status, ss.notes AS schedule_notes
     FROM matches m
     LEFT JOIN schedule_slots ss ON ss.match_id = m.id
     WHERE m.tournament_id = $1
       AND (lower(m.team1) = lower($2) OR lower(m.team2) = lower($2))
     ORDER BY ss.start_at ASC NULLS LAST, m.round_index ASC, m.match_index ASC`,
    [tournamentId, teamName],
  );

  return {
    teamName,
    tournamentId,
    matches: matches.map((m) => ({
      id: m.id,
      stageKey: m.stage_key,
      roundIndex: m.round_index,
      matchIndex: m.match_index,
      team1: m.team1,
      team2: m.team2,
      winner: m.winner,
      status: m.status,
      opponent: m.team1.toLowerCase() === teamName.toLowerCase() ? m.team2 : m.team1,
      startAt: m.start_at,
      stream: m.schedule_stream || m.stream || "",
      scheduleStatus: m.schedule_status,
      notes: m.schedule_notes,
    })),
  };
}

export async function getCommunityDirectory({ search = "", limit = 48, offset = 0 } = {}) {
  const params = [];
  let where = `WHERE pa.email_verified_at IS NOT NULL`;
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where += ` AND (lower(pa.display_name) LIKE $${params.length} OR lower(pa.slug) LIKE $${params.length} OR lower(pa.bpc_id) LIKE $${params.length})`;
  }
  params.push(Math.min(Math.max(1, limit), 100));
  params.push(Math.max(0, offset));

  const { rows } = await pool.query(
    `SELECT pa.*
     FROM player_accounts pa
     ${where}
     ORDER BY pa.display_name ASC NULLS LAST, pa.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const players = [];
  for (const account of rows) {
    const card = await buildCardManifest(account);
    players.push({
      slug: account.slug,
      bpcId: account.bpc_id,
      displayName: account.display_name || account.slug,
      avatarUrl: account.steam_avatar_url || account.avatar_url || "",
      cardTier: card?.tier || "default",
      card,
    });
  }
  return { players, limit, offset };
}

export async function getPlayerDashboardHistory(playerAccountId) {
  const account = await pool.query(`SELECT id FROM player_accounts WHERE id = $1`, [playerAccountId]);
  if (!account.rows[0]) return null;

  const full = await getPublicPlayerProfile(
    (await pool.query(`SELECT slug FROM player_accounts WHERE id = $1`, [playerAccountId])).rows[0]?.slug,
  );
  if (!full) return null;
  return {
    seasonHistory: full.seasonHistory,
    teamHistory: full.teamHistory,
    registrations: full.registrations,
    career: full.career,
  };
}

export async function getUpcomingTournamentsForPlayer(playerAccountId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.slug, t.name, t.registrations_open, t.start_date, t.end_date,
            t.entry_fee, t.prize_pool
     FROM tournaments t
     WHERE t.is_published = TRUE
     ORDER BY t.registrations_open DESC, t.published_at DESC NULLS LAST`,
  );

  const tournaments = [];
  for (const t of rows) {
    const commerceRow = await getOrCreateCommerceConfig(t.id);
    const commerce = publicCommerceConfig(commerceRow);
    const [{ rows: existing }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT registration_status, payment_status FROM player_registrations
         WHERE tournament_id = $1 AND player_account_id = $2 AND archived_at IS NULL
         LIMIT 1`,
        [t.id, playerAccountId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM player_registrations
         WHERE tournament_id = $1 AND archived_at IS NULL AND substitute_flag = FALSE`,
        [t.id],
      ),
    ]);
    const reg = existing[0];
    const entryFeeText = String(t.entry_fee || "").trim();
    tournaments.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      registrationsOpen: t.registrations_open === true,
      startDate: t.start_date,
      endDate: t.end_date,
      entryFee: commerce?.registrationFeeRupees ?? 300,
      entryFeeLabel: entryFeeText || `₹${commerce?.registrationFeeRupees ?? 300}`,
      prizePool: String(t.prize_pool || "").trim() || null,
      registrationCount: countRows[0]?.count ?? 0,
      // Admin will expose a configured cap later; null until tournament engine ships.
      registrationLimit: null,
      commerce,
      registrationStatus: reg?.registration_status || null,
      paymentStatus: reg?.payment_status || null,
    });
  }
  return { tournaments };
}

export async function getPlayerCoinSummary(playerAccountId) {
  const balance = await getCoinBalance(playerAccountId);
  const { rows } = await pool.query(
    `SELECT id, delta, balance_after, reason, created_at
     FROM bpc_coin_ledger
     WHERE player_account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [playerAccountId],
  );
  return {
    balance,
    recent: rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  };
}
