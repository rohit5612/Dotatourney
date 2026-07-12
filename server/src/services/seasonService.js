import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import {
  normalizeArchiveEmbeds,
  normalizeSponsorsConfig,
  parseSponsorsConfigLenient,
} from "./seasonContentSchema.js";
import { applyBlastGroupSeeding } from "./blastSeeding.js";
import { getTournament, hydrateMatchRow } from "./tournamentRepository.js";
import { resolveSeasonStatusFromTournament } from "./seasonUpsert.js";
import { buildMatchRosterCards } from "./cardManifestService.js";
import { buildPublicHonorsPayload } from "./bracketHonorsEngine.js";
import { buildGroupedStandings, buildStandings } from "./standingsEngine.js";
import { buildTeamsWithActivePlayers, mergeSnapshotTeamsWithRoster } from "./rosterMembershipService.js";

function parseSponsorsConfig(raw) {
  return parseSponsorsConfigLenient(raw);
}

function parseArchiveEmbeds(raw) {
  if (!Array.isArray(raw)) return [];
  try {
    return normalizeArchiveEmbeds(raw);
  } catch {
    return [];
  }
}

function sponsorsConfigFromSeason(season) {
  const live = parseSponsorsConfig(season.sponsors_config);
  if (live.sponsors?.length > 0) return live;

  if (season.status === "concluded" && season.snapshot) {
    try {
      const snapshot = typeof season.snapshot === "object" ? season.snapshot : JSON.parse(season.snapshot || "{}");
      if (snapshot?.sponsorsConfig) return parseSponsorsConfig(snapshot.sponsorsConfig);
    } catch {
      // fall through
    }
  }
  return live;
}

function mapSeasonRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    slug: row.slug,
    themeKey: row.theme_key,
    name: row.name,
    status: row.status,
    tournamentId: row.tournament_id,
    heroMedia: row.hero_media || {},
    sponsorsConfig: parseSponsorsConfig(row.sponsors_config),
    archiveEmbeds: parseArchiveEmbeds(row.archive_embeds),
    trophyEngraving: row.trophy_engraving || {},
    hasSnapshot: Boolean(row.snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tournamentFromSeasonRow(row) {
  if (row.status === "concluded" && row.snapshot) {
    const snapshot = typeof row.snapshot === "object" ? row.snapshot : JSON.parse(row.snapshot || "{}");
    return snapshot?.tournament || null;
  }
  if (row.prize_pool != null || row.start_date != null) {
    return {
      prize_pool: row.prize_pool,
      start_date: row.start_date,
      end_date: row.end_date,
      description: row.description,
      team_count: row.team_count,
      format: row.format,
    };
  }
  return null;
}

function championNameFromRow(row) {
  const engraving = row.trophy_engraving && typeof row.trophy_engraving === "object" ? row.trophy_engraving : {};
  const direct = String(engraving.teamName || "").trim();
  if (direct) return direct;
  if (row.status === "concluded" && row.snapshot) {
    try {
      const snapshot = typeof row.snapshot === "object" ? row.snapshot : JSON.parse(row.snapshot || "{}");
      const honors = snapshot?.honors;
      const fromHonors =
        String(honors?.podiumTeams?.[0]?.teamName || "").trim() ||
        String(honors?.champion?.teamName || "").trim();
      if (fromHonors) return fromHonors;
    } catch {
      // Ignore malformed snapshot payloads.
    }
  }
  return "";
}

function buildSeasonTagline(row, tournament, championName) {
  const desc = String(tournament?.description || row.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (desc) {
    return desc.length > 110 ? `${desc.slice(0, 107)}…` : desc;
  }

  if (championName) return `Champions — ${championName}`;
  const isLive =
    row.status === "active" ||
    Boolean(row.is_published) ||
    String(row.tournament_status || "").toLowerCase() === "published";
  if (isLive) return "Live season — standings, rosters, and honors.";
  if (row.status === "upcoming") return "Upcoming BPC League season.";
  return "Teams, honors, prize pool, and bracket archive.";
}

function mapSeasonListRow(row) {
  const base = mapSeasonRow(row);
  const tournament = tournamentFromSeasonRow(row);
  const playerCount = Number(row.player_count) || 0;
  const teamCount = Number(row.team_count_live) || tournament?.team_count || 0;
  const championName = championNameFromRow(row);

  return {
    ...base,
    tournamentCardBg: String(row.season_card_bg || "").trim(),
    tournamentCardBadge: String(row.season_card_badge || "").trim(),
    summary: {
      prizePool: tournament?.prize_pool || "",
      startDate: tournament?.start_date || null,
      endDate: tournament?.end_date || null,
      playerCount,
      teamCount,
      matchCount: Number(row.match_count) || 0,
      completedMatchCount: Number(row.completed_match_count) || 0,
      championName,
      isPublished: Boolean(row.is_published),
      tournamentStatus: row.tournament_status || "",
      registrationsOpen: Boolean(row.registrations_open),
      tagline: buildSeasonTagline(row, tournament, championName),
      format: tournament?.format || "",
    },
  };
}

const SEASON_LIST_SELECT = `
  SELECT s.*,
         t.prize_pool,
         t.start_date,
         t.end_date,
         t.description,
         t.team_count,
         t.format,
         t.season_card_bg,
         t.season_card_badge,
         t.is_published,
         t.status AS tournament_status,
         t.registrations_open,
         (SELECT COUNT(*)::int FROM season_participations sp WHERE sp.season_id = s.id) AS player_count,
         (SELECT COUNT(*)::int FROM teams tm WHERE tm.tournament_id = s.tournament_id) AS team_count_live,
         (SELECT COUNT(*)::int FROM matches m WHERE m.tournament_id = s.tournament_id) AS match_count,
         (SELECT COUNT(*)::int FROM matches m WHERE m.tournament_id = s.tournament_id AND m.status = 'completed') AS completed_match_count
  FROM seasons s
  LEFT JOIN tournaments t ON t.id = s.tournament_id`;

export function isSeasonPubliclyVisible(season, tournamentMeta = {}) {
  const status = String(season?.status || "").toLowerCase();
  if (status === "concluded") return true;
  return Boolean(
    tournamentMeta.isPublished || String(tournamentMeta.tournamentStatus || "").toLowerCase() === "published",
  );
}

export async function listSeasons() {
  const { rows } = await pool.query(`${SEASON_LIST_SELECT} ORDER BY s.number ASC`);
  return rows.map(mapSeasonListRow);
}

/** Public /seasons — concluded archives + any published live tournament. */
export async function listPublicSeasons() {
  const { rows } = await pool.query(
    `${SEASON_LIST_SELECT}
     WHERE s.status = 'concluded'
        OR COALESCE(t.is_published, FALSE) = TRUE
        OR t.status = 'published'
     ORDER BY s.number ASC`,
  );
  return rows.map(mapSeasonListRow);
}

export async function updateSeasonHeroMedia(seasonId, patch) {
  const { rows } = await pool.query(`SELECT hero_media FROM seasons WHERE id = $1`, [seasonId]);
  const row = rows[0];
  if (!row) return null;

  const current = row.hero_media && typeof row.hero_media === "object" ? row.hero_media : {};
  const next = { ...current, ...patch };
  if (patch.cardBg === null || patch.cardBg === "") {
    delete next.cardBg;
    delete next.card_bg;
  }
  const { rows: updated } = await pool.query(
    `UPDATE seasons SET hero_media = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [seasonId, JSON.stringify(next)],
  );
  return mapSeasonRow(updated[0]);
}

export async function updateSeasonContent(seasonId, patch) {
  const { rows } = await pool.query(
    `SELECT sponsors_config, archive_embeds, status, snapshot FROM seasons WHERE id = $1`,
    [seasonId],
  );
  const row = rows[0];
  if (!row) return null;

  const nextSponsors =
    patch.sponsorsConfig !== undefined
      ? normalizeSponsorsConfig(patch.sponsorsConfig)
      : parseSponsorsConfig(row.sponsors_config);
  const nextEmbeds =
    patch.archiveEmbeds !== undefined ? normalizeArchiveEmbeds(patch.archiveEmbeds) : parseArchiveEmbeds(row.archive_embeds);

  const sponsorsJson = JSON.stringify(nextSponsors);
  const { rows: updated } = await pool.query(
    `UPDATE seasons
     SET sponsors_config = $2::jsonb,
         archive_embeds = $3::jsonb,
         snapshot = CASE
           WHEN status = 'concluded' AND snapshot IS NOT NULL
           THEN jsonb_set(COALESCE(snapshot, '{}'::jsonb), '{sponsorsConfig}', $2::jsonb, true)
           ELSE snapshot
         END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [seasonId, sponsorsJson, JSON.stringify(nextEmbeds)],
  );
  return mapSeasonRow(updated[0]);
}

export async function getArchiveEmbedsForTournament(tournamentId) {
  if (!tournamentId) return [];
  const { rows } = await pool.query(
    `SELECT archive_embeds FROM seasons WHERE tournament_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [tournamentId],
  );
  return parseArchiveEmbeds(rows[0]?.archive_embeds);
}

export async function getSponsorsConfigForTournament(tournamentId) {
  if (!tournamentId) return { section: {}, sponsors: [] };
  const { rows } = await pool.query(
    `SELECT sponsors_config FROM seasons WHERE tournament_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [tournamentId],
  );
  return parseSponsorsConfig(rows[0]?.sponsors_config);
}

/** Landing page sponsors — follows whichever season is tied to the currently published tournament. */
export async function getLandingSponsorsConfig() {
  const { rows } = await pool.query(
    `SELECT s.sponsors_config
     FROM seasons s
     INNER JOIN tournaments t ON t.id = s.tournament_id
     WHERE COALESCE(t.is_published, FALSE) = TRUE
        OR LOWER(t.status) = 'published'
     ORDER BY t.published_at DESC NULLS LAST, s.number DESC
     LIMIT 1`,
  );
  if (!rows[0]) {
    return { section: {}, sponsors: [] };
  }
  return parseSponsorsConfig(rows[0].sponsors_config);
}

export async function getSeasonBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT s.*, t.season_card_bg, t.season_card_badge
     FROM seasons s
     LEFT JOIN tournaments t ON t.id = s.tournament_id
     WHERE s.slug = $1`,
    [slug],
  );
  const season = rows[0];
  if (!season) return null;

  const { rows: participations } = await pool.query(
    `SELECT sp.*, pa.slug AS player_slug, pa.display_name, pa.bpc_id, pa.steam_avatar_url
     FROM season_participations sp
     LEFT JOIN player_accounts pa ON pa.id = sp.player_account_id
     WHERE sp.season_id = $1
     ORDER BY sp.placement ASC NULLS LAST, sp.team_name ASC`,
    [season.id],
  );

  let tournamentPayload = null;
  if (season.status === "concluded" && season.snapshot) {
    tournamentPayload = typeof season.snapshot === "object" ? season.snapshot : JSON.parse(season.snapshot || "{}");
    const format = tournamentPayload?.tournament?.format;
    if (season.tournament_id) {
      const data = await getTournament(season.tournament_id);
      const rosterTeams = buildTeamsWithActivePlayers(data?.approvedRoster);
      if (rosterTeams.length) {
        tournamentPayload.teams = mergeSnapshotTeamsWithRoster(tournamentPayload.teams, rosterTeams);
      }
      if (!tournamentPayload.honors && data?.tournament) {
        const matches = (tournamentPayload.matches || data.matches || []).map(hydrateMatchRow);
        tournamentPayload.honors = buildPublicHonorsPayload(
          matches,
          format,
          data.tournament.tournament_honors,
        );
      }
    }
    if (format && tournamentPayload?.teams?.length && tournamentPayload?.matches?.length && !tournamentPayload.groupedStandings?.length) {
      tournamentPayload.groupedStandings = buildGroupedStandings(
        tournamentPayload.teams,
        tournamentPayload.matches,
        format,
      );
    }
  } else if (season.tournament_id) {
    const data = await getTournament(season.tournament_id);
    if (data) {
      const tournament = data.tournament;
      const visibilityMode = tournament.visibility_mode || "demo";
      const format = tournament.format;
      const teams =
        data.approvedRoster?.teams?.length > 0
          ? buildTeamsWithActivePlayers(data.approvedRoster)
          : data.teams || [];
      const hasApprovedRoster = Boolean(data.approvedRoster?.teams?.length);
      const exposeTeamsPublicly = hasApprovedRoster || visibilityMode !== "demo";
      let matches = (data.matches || []).map(hydrateMatchRow);
      if (format === "blast" && visibilityMode !== "demo" && teams.length > 0) {
        matches = applyBlastGroupSeeding(teams, matches).matches;
      }
      const standingsTeams =
        visibilityMode === "demo"
          ? Array.from({ length: tournament.team_count || 0 }, (_, index) => ({ name: `Team ${index + 1}` }))
          : teams.length > 0
            ? teams
            : Array.from(
                new Set(matches.flatMap((m) => [m.team1, m.team2]).filter((n) => typeof n === "string" && n.trim())),
              ).map((name) => ({ name }));

      const resolvedStatus = resolveSeasonStatusFromTournament(tournament);
      if (resolvedStatus !== season.status && season.status !== "concluded") {
        season.status = resolvedStatus;
        await pool.query(`UPDATE seasons SET status = $2, updated_at = NOW() WHERE id = $1`, [
          season.id,
          resolvedStatus,
        ]);
      }

      tournamentPayload = {
        tournament,
        teams: exposeTeamsPublicly ? teams : [],
        matches,
        honors: buildPublicHonorsPayload(matches, format, tournament.tournament_honors),
        standings: buildStandings(standingsTeams, matches, format),
        groupedStandings: buildGroupedStandings(standingsTeams, matches, format),
      };
    }
  }

  const sponsorsConfig = sponsorsConfigFromSeason(season);

  return {
    season: {
      ...mapSeasonRow(season),
      sponsorsConfig,
      tournamentCardBg: String(season.season_card_bg || "").trim(),
      tournamentCardBadge: String(season.season_card_badge || "").trim(),
    },
    sponsorsConfig,
    participations: participations.map((p) => ({
      playerSlug: p.player_slug,
      displayName: p.display_name,
      bpcId: p.bpc_id,
      avatarUrl: p.steam_avatar_url,
      teamName: p.team_name,
      placement: p.placement,
      role: p.role,
      honors: p.honors,
      stats: p.stats,
    })),
    snapshot: season.snapshot || null,
    trophyEngraving: season.trophy_engraving || {},
    tournament: tournamentPayload,
  };
}

export async function getPublicMatchDetail(matchId) {
  const { rows } = await pool.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
  const match = hydrateMatchRow(rows[0]);
  if (!match) return null;

  const { rows: scheduleRows } = await pool.query(
    `SELECT * FROM schedule_slots WHERE match_id = $1 ORDER BY start_at ASC LIMIT 1`,
    [matchId],
  );
  const schedule = scheduleRows[0];

  const { rows: tourRows } = await pool.query(`SELECT * FROM tournaments WHERE id = $1`, [match.tournament_id]);
  const tournament = tourRows[0];

  const rosterCards = await buildMatchRosterCards(matchId);

  return {
    match: {
      ...match,
      schedule: schedule
        ? {
            startAt: schedule.start_at,
            stream: schedule.stream,
            status: schedule.status,
            notes: schedule.notes,
          }
        : null,
    },
    tournament: tournament
      ? {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          format: tournament.format,
          seriesType: tournament.series_type,
          liveYoutubeUrl: tournament.live_youtube_url || "",
        }
      : null,
    rosterCards,
  };
}

export async function listAnnouncements({ category, limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, announcements, banner_announcements, is_published, published_at
     FROM tournaments
     WHERE is_published = TRUE OR status = 'published'
     ORDER BY published_at DESC NULLS LAST`,
  );

  const items = [];
  for (const row of rows) {
    const anns = Array.isArray(row.announcements) ? row.announcements : [];
    for (let i = 0; i < anns.length; i += 1) {
      const raw = anns[i];
      const normalized =
        typeof raw === "string"
          ? { body: raw, category: "general", pinned: false }
          : {
              body: raw.body || raw.text || "",
              category: raw.category || "general",
              pinned: Boolean(raw.pinned),
              postedAt: raw.postedAt || raw.posted_at || null,
              title: raw.title || "",
            };
      if (category && normalized.category !== category) continue;
      items.push({
        id: `${row.id}-${i}`,
        tournamentId: row.id,
        tournamentSlug: row.slug,
        tournamentName: row.name,
        ...normalized,
      });
    }
  }

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return tb - ta;
  });

  const chronology = [...items].sort((a, b) => {
    const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  const referenceById = new Map(chronology.map((item, index) => [item.id, index + 1]));

  const slice = items.slice(offset, offset + Math.min(Math.max(1, limit), 100)).map((item) => ({
    ...item,
    referenceNumber: referenceById.get(item.id) ?? null,
  }));
  return { announcements: slice, total: items.length, limit, offset };
}
