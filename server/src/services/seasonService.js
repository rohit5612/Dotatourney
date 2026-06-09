import { pool } from "../db/pool.js";
import { getTournament, hydrateMatchRow } from "./tournamentRepository.js";
import { buildMatchRosterCards } from "./cardManifestService.js";
import { buildPublicHonorsPayload } from "./bracketHonorsEngine.js";
import { buildStandings } from "./standingsEngine.js";

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
    trophyEngraving: row.trophy_engraving || {},
    hasSnapshot: Boolean(row.snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSeasons() {
  const { rows } = await pool.query(`SELECT * FROM seasons ORDER BY number ASC`);
  return rows.map(mapSeasonRow);
}

export async function getSeasonBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM seasons WHERE slug = $1`, [slug]);
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
  } else if (season.tournament_id) {
    const data = await getTournament(season.tournament_id);
    if (data) {
      tournamentPayload = {
        tournament: data.tournament,
        teams: data.teams,
        matches: (data.matches || []).map(hydrateMatchRow),
        honors: buildPublicHonorsPayload(data.matches, data.tournament.format, data.tournament.tournament_honors),
        standings: buildStandings(data.teams, data.matches, data.tournament.format),
      };
    }
  }

  return {
    season: mapSeasonRow(season),
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

  const slice = items.slice(offset, offset + Math.min(Math.max(1, limit), 100));
  return { announcements: slice, total: items.length, limit, offset };
}
