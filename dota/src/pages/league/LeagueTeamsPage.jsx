import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { TeamLogoImg } from "../../components/TeamLogoImg.jsx";
import { SITE_BRAND_FULL } from "../../constants/siteMeta.js";
import { useInView } from "../../hooks/useInView.js";
import { hexToRgbTriplet } from "../../hooks/useLogoAccent.js";
import "../../styles/league-teams-page.css";
import "../../styles/team-logo-img.css";

function statusLabel(status) {
  if (status === "dormant") return "Reserved";
  if (status === "retired") return "Retired";
  return "Active";
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function teamMatchesSearch(team, query) {
  if (!query) return true;
  const haystack = [team.name, team.abbr, team.tagline].map(normalizeSearchText).join(" ");
  return haystack.includes(query);
}

function teamMatchesSeasonFilter(team, seasonFilter) {
  if (!seasonFilter || seasonFilter === "all") return true;
  const seasonNumber = Number(seasonFilter);
  if (!Number.isFinite(seasonNumber)) return true;
  return (team.seasonsPlayed || []).includes(seasonNumber);
}

function teamMatchesChampionFilter(team, championFilter, seasonFilter) {
  if (!championFilter || championFilter === "all") return true;
  const titles = team.championshipSeasons || [];
  if (championFilter === "champions") {
    if (seasonFilter && seasonFilter !== "all") {
      const seasonNumber = Number(seasonFilter);
      return titles.includes(seasonNumber);
    }
    return titles.length > 0;
  }
  if (championFilter === "no-title") {
    return titles.length === 0;
  }
  return true;
}

const LeagueFranchiseCard = memo(function LeagueFranchiseCard({ team, index }) {
  const { ref, inView } = useInView({ rootMargin: "120px 0px", threshold: 0.06 });
  const linkRef = useRef(null);
  const accent = hexToRgbTriplet(team.accentColor) || "134 239 172";
  const logoUrl = team.logoUrl || "";
  const seasons = team.seasonsPlayed || [];
  const abbr = (team.abbr || team.name.slice(0, 3)).toUpperCase();
  const staggerMs = inView && index < 12 ? Math.min(index, 11) * 55 : 0;
  const status = team.status || "active";
  const phase = index % 4;

  const resetTilt = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    el.style.setProperty("--league-tilt-x", "50");
    el.style.setProperty("--league-tilt-y", "50");
  }, []);

  const onPointerMove = useCallback((event) => {
    const el = linkRef.current;
    if (!el || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--league-tilt-x", String(x));
    el.style.setProperty("--league-tilt-y", String(y));
  }, []);

  return (
    <article
      ref={ref}
      className={[
        "league-card",
        "league-card--immersive",
        inView ? "league-card--in-view" : "",
        logoUrl ? "league-card--has-logo" : "",
        `league-card--phase-${phase}`,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--league-accent-rgb": accent,
        "--league-stagger": `${staggerMs}ms`,
        "--league-phase": phase,
      }}
    >
      <Link
        ref={linkRef}
        to={`/league/${team.slug}`}
        className="league-card__link"
        aria-label={`View ${team.name} franchise`}
        onPointerMove={onPointerMove}
        onPointerLeave={resetTilt}
        onBlur={resetTilt}
      >
        <span className="league-card__border-glow" aria-hidden />
        <div className="league-card__aurora" aria-hidden />
        <span className="league-card__orb league-card__orb--a" aria-hidden />
        <span className="league-card__orb league-card__orb--b" aria-hidden />
        <span className="league-card__accent" aria-hidden />
        <span className="league-card__shimmer" aria-hidden />
        {logoUrl ? (
          <div className="league-card__bg" aria-hidden>
            <TeamLogoImg src={logoUrl} alt="" className="league-card__bg-logo" width={320} height={320} loading="lazy" />
          </div>
        ) : null}
        <div className="league-card__scrim" aria-hidden />
        <span className="league-card__scan" aria-hidden />

        <div className="league-card__hero">
          <span className="league-card__abbr" aria-hidden>{abbr}</span>
          <div className="league-card__logo-ring">
            <span className="league-card__ring-track" aria-hidden />
            {logoUrl ? (
              <TeamLogoImg src={logoUrl} alt="" className="league-card__logo" width={120} height={120} loading="lazy" />
            ) : (
              <span className="league-card__initials">{team.abbr || team.name.slice(0, 2)}</span>
            )}
          </div>
          <span className={`league-card__status league-card__status--${status}`}>
            {status === "active" ? <span className="league-card__status-dot" aria-hidden /> : null}
            {statusLabel(status)}
          </span>
        </div>

        <div className="league-card__panel">
          <h2 className="league-card__name">{team.name}</h2>
          {team.tagline ? <p className="league-card__tagline">{team.tagline}</p> : null}
          <div className="league-card__footer">
            {seasons.length ? (
              <ul className="league-card__seasons" aria-label="Seasons competed">
                {seasons.slice(0, 4).map((season) => (
                  <li key={season}>S{season}</li>
                ))}
                {seasons.length > 4 ? (
                  <li className="league-card__seasons-more">+{seasons.length - 4}</li>
                ) : null}
              </ul>
            ) : (
              <p className="league-card__debut">Awaiting debut</p>
            )}
            <span className="league-card__cta">
              View franchise
              <span className="league-card__cta-arrow" aria-hidden>→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
});

export function LeagueTeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [championFilter, setChampionFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await api.getLeagueTeams();
        if (!cancelled) setTeams(payload.teams || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load league teams.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const seasonOptions = useMemo(() => {
    const numbers = new Set();
    for (const team of teams) {
      for (const season of team.seasonsPlayed || []) {
        if (season != null && season !== "") numbers.add(Number(season));
      }
    }
    return [...numbers].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }, [teams]);

  const searchQuery = normalizeSearchText(search);

  const filteredTeams = useMemo(
    () =>
      teams.filter(
        (team) =>
          teamMatchesSearch(team, searchQuery) &&
          teamMatchesSeasonFilter(team, seasonFilter) &&
          teamMatchesChampionFilter(team, championFilter, seasonFilter),
      ),
    [teams, searchQuery, seasonFilter, championFilter],
  );

  const filtersActive = Boolean(searchQuery) || seasonFilter !== "all" || championFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setSeasonFilter("all");
    setChampionFilter("all");
  };

  return (
    <div className="league-page league-page-layout">
      <div className="league-page__ambient" aria-hidden>
        <span className="league-page__orb league-page__orb--a" />
        <span className="league-page__orb league-page__orb--b" />
        <span className="league-page__orb league-page__orb--c" />
      </div>

      <header className="league-hero league-hero--cinematic league-page__hero-band">
        <p className="league-hero__eyebrow">{SITE_BRAND_FULL}</p>
        <h1 className="league-hero__title">
          <span className="league-hero__title-line">The</span>
          <span className="league-hero__title-line league-hero__title-line--accent">League</span>
        </h1>
        <p className="league-hero__subtitle">
          Permanent franchises. Season rosters. Lore, honors, and legacy across every BPCL campaign.
        </p>
      </header>

      {error ? <p className="league-page__message">{error}</p> : null}
      {loading ? (
        <div className="league-loading" aria-busy="true">
          <span className="league-loading__ring" />
          <p>Summoning franchises…</p>
        </div>
      ) : null}

      {!loading && teams.length ? (
        <div className="league-page__body league-grid-wrap">
          <div className="league-toolbar" role="search">
            <div className="league-toolbar__row">
              <label className="league-toolbar__field league-toolbar__field--search">
                <span className="league-toolbar__label">Search</span>
                <input
                  type="search"
                  className="league-toolbar__input"
                  placeholder="Search by team name or tagline…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="league-toolbar__field">
                <span className="league-toolbar__label">Season</span>
                <select
                  className="league-toolbar__select"
                  value={seasonFilter}
                  onChange={(event) => setSeasonFilter(event.target.value)}
                >
                  <option value="all">All seasons</option>
                  {seasonOptions.map((season) => (
                    <option key={season} value={String(season)}>Season {season}</option>
                  ))}
                </select>
              </label>
              <label className="league-toolbar__field">
                <span className="league-toolbar__label">Champions</span>
                <select
                  className="league-toolbar__select"
                  value={championFilter}
                  onChange={(event) => setChampionFilter(event.target.value)}
                >
                  <option value="all">All franchises</option>
                  <option value="champions">
                    {seasonFilter !== "all" ? `Champion of S${seasonFilter}` : "Title winners"}
                  </option>
                  <option value="no-title">No titles yet</option>
                </select>
              </label>
            </div>
            <div className="league-toolbar__meta">
              <p className="league-toolbar__count" aria-live="polite">
                Showing {filteredTeams.length} of {teams.length} franchises
              </p>
              {filtersActive ? (
                <button type="button" className="league-toolbar__clear" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          {filteredTeams.length ? (
            <div className="league-grid">
              {filteredTeams.map((team, index) => (
                <LeagueFranchiseCard key={team.id} team={team} index={index} />
              ))}
            </div>
          ) : (
            <div className="league-empty-filters">
              <p className="league-empty-filters__title">No franchises match</p>
              <p className="league-empty-filters__copy">Try a different search or reset your season and champion filters.</p>
              <button type="button" className="league-toolbar__clear league-toolbar__clear--solo" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
