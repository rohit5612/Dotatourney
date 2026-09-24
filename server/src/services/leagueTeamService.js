import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { getRosterSnapshot, getApprovedRosterSnapshot, getTournament } from "./tournamentRepository.js";
import { buildPublicHonorsPayload } from "./bracketHonorsEngine.js";
import { buildSeasonTeamRosterForDisplay } from "./rosterMembershipService.js";
import { buildSeasonPlayerCardManifest } from "./cardManifestService.js";
import { resolvePublicTeamLogo } from "../utils/teamLogoUrl.js";

async function computeTeamSeasonRecord(tournamentId, teamName) {
  const norm = normalizeTeamName(teamName);
  if (!tournamentId || !norm) {
    return { wins: 0, losses: 0, played: 0, winRate: null };
  }

  const { rows } = await pool.query(
    `SELECT team1, team2, winner FROM matches WHERE tournament_id = $1`,
    [tournamentId],
  );

  let wins = 0;
  let losses = 0;
  for (const match of rows) {
    const winner = String(match.winner || "").trim();
    if (!winner) continue;
    const t1 = normalizeTeamName(match.team1);
    const t2 = normalizeTeamName(match.team2);
    if (t1 !== norm && t2 !== norm) continue;
    if (normalizeTeamName(winner) === norm) wins += 1;
    else losses += 1;
  }

  const played = wins + losses;
  return {
    wins,
    losses,
    played,
    winRate: played > 0 ? Math.round((wins / played) * 100) : null,
  };
}

function placementFromHonorsPayload(honors, teamName) {
  const norm = normalizeTeamName(teamName);
  if (!norm || !honors) return null;
  const lists = [...(honors.podiumTeams || []), ...(honors.placementTeams || [])];
  const hit = lists.find((row) => normalizeTeamName(row.teamName) === norm);
  return hit?.placement != null ? Number(hit.placement) : null;
}

function bracketBadgeForTeam(honorsPayload, teamName) {
  const map = honorsPayload?.badgesByTeam;
  if (!map || typeof map !== "object") return null;
  const direct = teamName && map[teamName];
  if (direct) return direct;
  const norm = normalizeTeamName(teamName);
  if (!norm) return null;
  for (const [key, badge] of Object.entries(map)) {
    if (normalizeTeamName(key) === norm) return badge;
  }
  return null;
}

function resolveSeasonPlacement(entry) {
  if (entry.placement != null && entry.placement !== "") return Number(entry.placement);
  const podium = entry.honors?.podium;
  if (podium?.placement != null) return Number(podium.placement);
  if (entry.honorsFromTournament) {
    return placementFromHonorsPayload(entry.honorsFromTournament, entry.teamNameForPlacement || "");
  }
  return null;
}

async function loadTournamentHonorsCache() {
  const cache = new Map();
  return {
    async get(tournamentId) {
      if (!tournamentId) return null;
      if (cache.has(tournamentId)) return cache.get(tournamentId);
      const data = await getTournament(tournamentId);
      if (!data?.tournament) {
        cache.set(tournamentId, null);
        return null;
      }
      const honors = buildPublicHonorsPayload(
        data.matches,
        data.tournament.format,
        data.tournament.tournament_honors,
      );
      const payload = {
        ...honors,
        format: String(data.tournament.format || "").trim().toLowerCase() || null,
      };
      cache.set(tournamentId, payload);
      return payload;
    },
  };
}

export function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function slugifyLeagueTeamName(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "team";
}

/** Accent from the franchise's latest season roster snapshot (falls back to league_teams.accent_color). */
const LAST_SEASON_ACCENT_SELECT = `
  (
    SELECT rst.accent_color
    FROM season_team_entries ste_ls
    JOIN seasons s_ls ON s_ls.id = ste_ls.season_id
    JOIN roster_snapshot_teams rst ON rst.id = ste_ls.roster_snapshot_team_id
    WHERE ste_ls.league_team_id = lt.id
      AND ste_ls.roster_snapshot_team_id IS NOT NULL
    ORDER BY s_ls.number DESC
    LIMIT 1
  ) AS last_season_accent_color`;

function resolveDisplayAccentColor(row) {
  const lastSeason = String(row.last_season_accent_color || "").trim();
  const canonical = String(row.accent_color || row.accentColor || "").trim();
  return lastSeason || canonical;
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT id FROM league_teams WHERE slug = $1${excludeId ? " AND id <> $2" : ""} LIMIT 1`,
      excludeId ? [slug, excludeId] : [slug],
    );
    if (!rows[0]) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

function mapLeagueTeamRow(row) {
  if (!row) return null;
  const art = row.art && typeof row.art === "object" ? row.art : { gallery: [] };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    abbr: row.abbr || "",
    logoUrl: resolvePublicTeamLogo(row.logo_url || row.logoUrl || ""),
    accentColor: resolveDisplayAccentColor(row),
    canonicalAccentColor: String(row.accent_color || row.accentColor || "").trim(),
    tagline: row.tagline || "",
    lore: row.lore || "",
    history: row.history || "",
    art,
    foundedSeasonNumber: row.founded_season_number ?? row.foundedSeasonNumber ?? null,
    status: row.status || "active",
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    seasonsPlayed: row.seasons_played || row.seasonsPlayed || [],
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export async function listLeagueTeamsAdmin() {
  const { rows } = await pool.query(
    `SELECT lt.*,
            ${LAST_SEASON_ACCENT_SELECT},
            COALESCE(
              array_agg(DISTINCT s.number ORDER BY s.number)
              FILTER (WHERE s.number IS NOT NULL),
              '{}'
            ) AS seasons_played
     FROM league_teams lt
     LEFT JOIN season_team_entries ste ON ste.league_team_id = lt.id
     LEFT JOIN seasons s ON s.id = ste.season_id
     GROUP BY lt.id
     ORDER BY lt.sort_order ASC, lt.name ASC`,
  );
  return rows.map(mapLeagueTeamRow);
}

export async function listLeagueTeamsPublic() {
  const { rows } = await pool.query(
    `SELECT lt.*,
            ${LAST_SEASON_ACCENT_SELECT},
            COALESCE(
              array_agg(DISTINCT s.number ORDER BY s.number)
              FILTER (WHERE s.number IS NOT NULL),
              '{}'
            ) AS seasons_played,
            COALESCE(
              array_agg(DISTINCT s.number ORDER BY s.number)
              FILTER (WHERE ste.placement = 1),
              '{}'
            ) AS championship_seasons
     FROM league_teams lt
     LEFT JOIN season_team_entries ste ON ste.league_team_id = lt.id
     LEFT JOIN seasons s ON s.id = ste.season_id
     GROUP BY lt.id
     ORDER BY lt.sort_order ASC, lt.name ASC`,
  );
  return rows.map((row) => {
    const team = mapLeagueTeamRow(row);
    const championshipSeasons = row.championship_seasons || row.championshipSeasons || [];
    return {
      id: team.id,
      slug: team.slug,
      name: team.name,
      abbr: team.abbr,
      logoUrl: team.logoUrl,
      accentColor: team.accentColor,
      tagline: team.tagline,
      status: team.status,
      foundedSeasonNumber: team.foundedSeasonNumber,
      seasonsPlayed: team.seasonsPlayed,
      championshipSeasons: Array.isArray(championshipSeasons) ? championshipSeasons : [],
    };
  });
}

async function loadAliases(leagueTeamId) {
  const { rows } = await pool.query(
    `SELECT alias, alias_normalized AS "aliasNormalized", effective_from AS "effectiveFrom", effective_to AS "effectiveTo"
     FROM league_team_aliases
     WHERE league_team_id = $1
     ORDER BY created_at ASC`,
    [leagueTeamId],
  );
  return rows;
}

async function loadSeasonDetailsForLeagueTeam(leagueTeamId) {
  const { rows } = await pool.query(
    `SELECT ste.id,
            ste.display_name AS "displayName",
            ste.placement,
            ste.honors,
            ste.stats,
            ste.roster_snapshot_team_id AS "rosterSnapshotTeamId",
            s.id AS "seasonId",
            s.number AS "seasonNumber",
            s.slug AS "seasonSlug",
            s.name AS "seasonName",
            s.status AS "seasonStatus",
            s.tournament_id AS "tournamentId"
     FROM season_team_entries ste
     JOIN seasons s ON s.id = ste.season_id
     WHERE ste.league_team_id = $1
     ORDER BY s.number ASC`,
    [leagueTeamId],
  );

  const seasons = [];
  const honorsCache = await loadTournamentHonorsCache();
  for (const entry of rows) {
    let roster = null;
    let rosterPending = !entry.rosterSnapshotTeamId;
    let snapshotMeta = null;
    const teamNameForMatches = String(entry.displayName || "").trim();

    if (entry.tournamentId && entry.rosterSnapshotTeamId) {
      const metaResult = await pool.query(
        `SELECT name, accent_color, seed, group_key FROM roster_snapshot_teams WHERE id = $1`,
        [entry.rosterSnapshotTeamId],
      );
      snapshotMeta = metaResult.rows[0] || null;

      const approved = await getApprovedRosterSnapshot(entry.tournamentId);
      if (approved) {
        const teamDisplay = buildSeasonTeamRosterForDisplay(approved, entry.rosterSnapshotTeamId);
        if (teamDisplay) {
          const matchName = teamNameForMatches || teamDisplay.name || snapshotMeta?.name || "";
          const players = [];
          for (const player of teamDisplay.players || []) {
            const playerAccountId = player.playerAccountId || player.player_account_id || null;
            let card = null;
            if (playerAccountId) {
              card = await buildSeasonPlayerCardManifest(playerAccountId, {
                seasonId: entry.seasonId,
                tournamentId: entry.tournamentId,
                seasonStatus: entry.seasonStatus,
              });
            }
            players.push({
              name: player.displayName || player.name,
              role: player.role,
              roles: player.roles,
              isCaptain: Boolean(player.isCaptain),
              slug: player.slug || null,
              bpcId: player.bpcId || null,
              playerAccountId,
              card,
            });
          }
          roster = {
            players,
            eliminatedAt: teamDisplay.eliminatedAt || null,
            seed: teamDisplay.seed ?? snapshotMeta?.seed ?? null,
            groupKey: teamDisplay.groupKey || snapshotMeta?.group_key || null,
          };
        }
      }
    }

    const recordName = teamNameForMatches || snapshotMeta?.name || "";
    const record = entry.tournamentId && recordName
      ? await computeTeamSeasonRecord(entry.tournamentId, recordName)
      : { wins: 0, losses: 0, played: 0, winRate: null };

    const honorsFromTournament = entry.tournamentId ? await honorsCache.get(entry.tournamentId) : null;
    const storedHonors = entry.honors && typeof entry.honors === "object" ? entry.honors : {};
    const liveBracketBadge = bracketBadgeForTeam(honorsFromTournament, recordName);
    const honors = {
      ...storedHonors,
      ...(liveBracketBadge && !storedHonors.bracketBadge ? { bracketBadge: liveBracketBadge } : {}),
    };
    const placementEntry = {
      placement: entry.placement,
      honors,
      honorsFromTournament,
      teamNameForPlacement: recordName,
    };

    seasons.push({
      seasonId: entry.seasonId,
      seasonNumber: entry.seasonNumber,
      seasonSlug: entry.seasonSlug,
      seasonName: entry.seasonName,
      seasonStatus: entry.seasonStatus,
      displayName: entry.displayName || snapshotMeta?.name || "",
      placement: resolveSeasonPlacement(placementEntry),
      honors,
      tournamentFormat: honorsFromTournament?.format || null,
      stats: entry.stats || {},
      record,
      accentColor: snapshotMeta?.accent_color || "",
      rosterPending,
      roster,
    });
  }
  return seasons.reverse();
}

export async function getLeagueTeamBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT lt.*, ${LAST_SEASON_ACCENT_SELECT} FROM league_teams lt WHERE lt.slug = $1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;

  const team = mapLeagueTeamRow(row);
  const aliases = await loadAliases(team.id);
  const seasons = await loadSeasonDetailsForLeagueTeam(team.id);
  return { ...team, aliases, seasons };
}

export async function getLeagueTeamById(id) {
  const { rows } = await pool.query(
    `SELECT lt.*, ${LAST_SEASON_ACCENT_SELECT} FROM league_teams lt WHERE lt.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return mapLeagueTeamRow(row);
}

export async function findLeagueTeamByNormalizedName(normalizedName) {
  if (!normalizedName) return null;
  const direct = await pool.query(`SELECT * FROM league_teams WHERE lower(trim(name)) = $1 LIMIT 1`, [
    normalizedName,
  ]);
  if (direct.rows[0]) return direct.rows[0];

  const alias = await pool.query(
    `SELECT lt.* FROM league_team_aliases a JOIN league_teams lt ON lt.id = a.league_team_id WHERE a.alias_normalized = $1 LIMIT 1`,
    [normalizedName],
  );
  return alias.rows[0] || null;
}

async function insertAlias(client, leagueTeamId, aliasName) {
  const alias = String(aliasName || "").trim();
  if (!alias) return;
  const normalized = normalizeTeamName(alias);
  await client.query(
    `INSERT INTO league_team_aliases (id, league_team_id, alias, alias_normalized)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (alias_normalized) DO NOTHING`,
    [randomUUID(), leagueTeamId, alias, normalized],
  );
}

export async function createLeagueTeam(payload) {
  const id = randomUUID();
  const name = String(payload.name || "").trim();
  const slug = await ensureUniqueSlug(payload.slug?.trim() || slugifyLeagueTeamName(name));
  const art = payload.art && typeof payload.art === "object" ? payload.art : { gallery: [] };

  await pool.query(
    `INSERT INTO league_teams (
      id, slug, name, abbr, logo_url, accent_color, tagline, lore, history, art,
      founded_season_number, status, sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)`,
    [
      id,
      slug,
      name,
      String(payload.abbr || "").trim(),
      payload.logoUrl || payload.logo_url || "",
      payload.accentColor || payload.accent_color || "",
      String(payload.tagline || "").trim(),
      String(payload.lore || "").trim(),
      String(payload.history || "").trim(),
      JSON.stringify(art),
      payload.foundedSeasonNumber ?? payload.founded_season_number ?? null,
      payload.status || "active",
      Number(payload.sortOrder ?? payload.sort_order ?? 0) || 0,
    ],
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertAlias(client, id, name);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getLeagueTeamById(id);
}

export async function updateLeagueTeam(id, payload) {
  const existing = await getLeagueTeamById(id);
  if (!existing) return null;

  const name = payload.name !== undefined ? String(payload.name).trim() : existing.name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (payload.name !== undefined && normalizeTeamName(payload.name) !== normalizeTeamName(existing.name)) {
      await insertAlias(client, id, existing.name);
    }

    const art =
      payload.art !== undefined
        ? payload.art && typeof payload.art === "object"
          ? payload.art
          : { gallery: [] }
        : existing.art;

    await client.query(
      `UPDATE league_teams SET
        name = COALESCE($2, name),
        abbr = COALESCE($3, abbr),
        logo_url = COALESCE($4, logo_url),
        accent_color = COALESCE($5, accent_color),
        tagline = COALESCE($6, tagline),
        lore = COALESCE($7, lore),
        history = COALESCE($8, history),
        art = COALESCE($9::jsonb, art),
        founded_season_number = COALESCE($10, founded_season_number),
        status = COALESCE($11, status),
        sort_order = COALESCE($12, sort_order),
        updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        payload.name !== undefined ? name : null,
        payload.abbr !== undefined ? String(payload.abbr).trim() : null,
        payload.logoUrl !== undefined || payload.logo_url !== undefined
          ? payload.logoUrl ?? payload.logo_url ?? ""
          : null,
        payload.accentColor !== undefined || payload.accent_color !== undefined
          ? payload.accentColor ?? payload.accent_color ?? ""
          : null,
        payload.tagline !== undefined ? String(payload.tagline).trim() : null,
        payload.lore !== undefined ? String(payload.lore).trim() : null,
        payload.history !== undefined ? String(payload.history).trim() : null,
        payload.art !== undefined ? JSON.stringify(art) : null,
        payload.foundedSeasonNumber !== undefined || payload.founded_season_number !== undefined
          ? payload.foundedSeasonNumber ?? payload.founded_season_number
          : null,
        payload.status !== undefined ? payload.status : null,
        payload.sortOrder !== undefined || payload.sort_order !== undefined
          ? Number(payload.sortOrder ?? payload.sort_order ?? 0)
          : null,
      ],
    );

    if (payload.name !== undefined) {
      await insertAlias(client, id, name);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getLeagueTeamById(id);
}

async function getSeasonForTournament(tournamentId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, number, slug, status FROM seasons WHERE tournament_id = $1 LIMIT 1`,
    [tournamentId],
  );
  return rows[0] || null;
}

export async function upsertSeasonTeamEntry({
  leagueTeamId,
  seasonId,
  tournamentId,
  rosterSnapshotTeamId = null,
  displayName = "",
  client = pool,
}) {
  if (!leagueTeamId || !seasonId || !tournamentId) return;

  await client.query(
    `INSERT INTO season_team_entries (
      id, league_team_id, season_id, tournament_id, roster_snapshot_team_id, display_name
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (league_team_id, season_id) DO UPDATE SET
      tournament_id = EXCLUDED.tournament_id,
      roster_snapshot_team_id = COALESCE(EXCLUDED.roster_snapshot_team_id, season_team_entries.roster_snapshot_team_id),
      display_name = CASE
        WHEN EXCLUDED.display_name <> '' THEN EXCLUDED.display_name
        ELSE season_team_entries.display_name
      END,
      updated_at = NOW()`,
    [randomUUID(), leagueTeamId, seasonId, tournamentId, rosterSnapshotTeamId, displayName || ""],
  );

  const season = await client.query(`SELECT number FROM seasons WHERE id = $1`, [seasonId]);
  const seasonNumber = season.rows[0]?.number;
  if (seasonNumber != null) {
    await client.query(
      `UPDATE league_teams SET founded_season_number = LEAST(COALESCE(founded_season_number, $2), $2), updated_at = NOW()
       WHERE id = $1`,
      [leagueTeamId, seasonNumber],
    );
  }
}

export async function syncSeasonTeamEntriesFromApprovedRoster(tournamentId, rosterId) {
  const season = await getSeasonForTournament(tournamentId);
  if (!season) return;

  const roster = await getRosterSnapshot(tournamentId, rosterId);
  if (!roster?.teams?.length) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const team of roster.teams) {
      const leagueTeamId = team.leagueTeamId || team.league_team_id;
      if (!leagueTeamId) continue;
      await upsertSeasonTeamEntry({
        leagueTeamId,
        seasonId: season.id,
        tournamentId,
        rosterSnapshotTeamId: team.id,
        displayName: team.name || "",
        client,
      });
      await client.query(`UPDATE roster_snapshot_teams SET league_team_id = $1 WHERE id = $2`, [
        leagueTeamId,
        team.id,
      ]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function syncWorkingSeasonTeamEntries(tournamentId, teams) {
  const season = await getSeasonForTournament(tournamentId);
  if (!season || season.status === "concluded") return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const team of teams || []) {
      const leagueTeamId = team.leagueTeamId || team.league_team_id;
      if (!leagueTeamId) continue;
      await upsertSeasonTeamEntry({
        leagueTeamId,
        seasonId: season.id,
        tournamentId,
        rosterSnapshotTeamId: null,
        displayName: team.name || "",
        client,
      });
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function placementForTeamName(teamName, honors) {
  const name = normalizeTeamName(teamName);
  const podium = honors?.podiumTeams || [];
  for (let i = 0; i < podium.length; i += 1) {
    if (normalizeTeamName(podium[i]?.teamName) === name) {
      return podium[i].placement ?? i + 1;
    }
  }
  const placements = honors?.placementTeams || [];
  const hit = placements.find((row) => normalizeTeamName(row.teamName) === name);
  return hit?.placement ?? null;
}

export async function syncSeasonTeamHonorsOnComplete(tournamentId, honors) {
  const season = await getSeasonForTournament(tournamentId);
  if (!season) return;

  const { rows } = await pool.query(
    `SELECT id, league_team_id, display_name FROM season_team_entries WHERE season_id = $1`,
    [season.id],
  );

  for (const entry of rows) {
    const teamName = entry.display_name || "";
    const placement = placementForTeamName(teamName, honors);
    const teamHonors = {
      podium: (honors?.podiumTeams || []).find((row) => normalizeTeamName(row.teamName) === normalizeTeamName(teamName)) || null,
      badges: (honors?.placementTeams || []).filter((row) => normalizeTeamName(row.teamName) === normalizeTeamName(teamName)),
      bracketBadge: bracketBadgeForTeam(honors, teamName),
      mvp:
        honors?.mvp && normalizeTeamName(honors.mvp.teamName) === normalizeTeamName(teamName) ? honors.mvp : null,
    };
    await pool.query(
      `UPDATE season_team_entries SET placement = $2, honors = $3::jsonb, updated_at = NOW() WHERE id = $1`,
      [entry.id, placement, JSON.stringify(teamHonors)],
    );
  }
}
