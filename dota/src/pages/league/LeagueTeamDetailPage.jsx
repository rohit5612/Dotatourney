import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { TeamLogoImg } from "../../components/TeamLogoImg.jsx";
import { LeagueFranchiseHero } from "../../components/league/LeagueFranchiseHero.jsx";
import { LeagueFranchiseRoster } from "../../components/league/LeagueFranchiseRoster.jsx";
import { LeaguePastSeasonRosters } from "../../components/league/LeaguePastSeasonRosters.jsx";
import { hexToRgbTriplet } from "../../hooks/useLogoAccent.js";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import "../../styles/league-teams-page.css";
import "../../styles/team-logo-img.css";

export function LeagueTeamDetailPage() {
  const { slug } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await api.getLeagueTeam(slug);
        if (!cancelled) setTeam(payload.team || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Franchise not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const seasons = team?.seasons || [];
  const activeSeason = useMemo(() => seasons.find((s) => s.seasonStatus === "active") || null, [seasons]);
  const pastSeasons = useMemo(() => seasons.filter((s) => s.seasonStatus !== "active"), [seasons]);

  const appearanceSeasons = useMemo(() => {
    const fromTeam = team?.seasonsPlayed || [];
    const fromEntries = seasons.map((s) => s.seasonNumber);
    const merged = [...new Set([...fromTeam, ...fromEntries].filter((n) => n != null && n !== ""))];
    return merged.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  }, [team?.seasonsPlayed, seasons]);

  const placementRows = useMemo(() => {
    return [...seasons].sort((a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
  }, [seasons]);

  const accentRgb = team ? hexToRgbTriplet(team.accentColor) || "233 168 74" : "233 168 74";
  const detailStyle = { "--league-accent-rgb": accentRgb };
  const logoUrl = team?.logoUrl ? normalizeTeamLogoUrl(team.logoUrl) : "";

  const shellClass = `league-page league-detail${logoUrl ? " league-detail--has-logo" : ""}`;

  if (loading) {
    return (
      <div className={shellClass} style={detailStyle}>
        <div className="league-loading" aria-busy="true">
          <span className="league-loading__ring" />
          <p>Loading franchise…</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className={shellClass} style={detailStyle}>
        <div className="league-detail__content">
          <p className="league-page__message">{error || "Franchise not found."}</p>
          <Link to="/league" className="league-back-link">← The League</Link>
        </div>
      </div>
    );
  }

  const gallery = team.art?.gallery || [];
  const championshipCount =
    (team.championshipSeasons || []).length || seasons.filter((s) => s.placement === 1).length;

  return (
    <div className={shellClass} style={detailStyle}>
      {logoUrl ? (
        <div className="league-detail__bg" aria-hidden>
          <TeamLogoImg src={team.logoUrl} alt="" className="league-detail__bg-logo" width={1200} height={1200} loading="eager" />
          <div className="league-detail__bg-scrim" />
          <div className="league-detail__bg-tint" />
        </div>
      ) : null}

      <section
        className="community-page__hero-band league-detail-hero-shell"
        aria-labelledby="franchise-showcase-title"
      >
        <div className="franchise-showcase__backdrop" aria-hidden>
          <span className="franchise-showcase__grid" />
          <span className="franchise-showcase__orb franchise-showcase__orb--a" />
          <span className="franchise-showcase__orb franchise-showcase__orb--b" />
        </div>
        <div className="community-page__hero-overlay league-detail-hero-shell__overlay" aria-hidden="true" />
        <div className="community-page__hero-inner league-detail-hero-shell__inner">
          <Link to="/league" className="league-back-link league-detail__back">← The League</Link>
          <LeagueFranchiseHero
            team={team}
            appearanceSeasons={appearanceSeasons}
            placementRows={placementRows}
            championshipCount={championshipCount}
          />
        </div>
      </section>

      <div className="league-detail__content league-detail__content--body">
        <section className="league-detail-section" aria-labelledby="league-active-roster-title">
          <header className="league-detail-section__head">
            <h2 id="league-active-roster-title" className="league-detail-section__title">Active roster</h2>
            {activeSeason ? (
              <p className="league-detail-section__subtitle">
                Season {activeSeason.seasonNumber}
                {activeSeason.displayName && activeSeason.displayName !== team.name ? ` · ${activeSeason.displayName}` : ""}
                {activeSeason.seasonSlug ? (
                  <>
                    {" · "}
                    <Link to={`/seasons/${activeSeason.seasonSlug}`} className="league-detail-section__season-link">
                      View season
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="league-detail-section__subtitle">No live season right now.</p>
            )}
          </header>
          {activeSeason ? (
            <LeagueFranchiseRoster
              players={activeSeason.roster?.players || []}
              rosterPending={activeSeason.rosterPending}
              seasonNumber={activeSeason.seasonNumber}
              className="league-detail-roster--featured"
            />
          ) : (
            <p className="league-season__copy">This franchise is between seasons — check past rosters below.</p>
          )}
        </section>

        {pastSeasons.length ? (
          <LeaguePastSeasonRosters pastSeasons={pastSeasons} franchiseName={team.name} />
        ) : null}

        {team.history ? (
          <section className="league-detail-section league-detail-section--muted" aria-labelledby="league-history-title">
            <h2 id="league-history-title" className="league-detail-section__title">History</h2>
            <div className="league-section__prose">{team.history}</div>
          </section>
        ) : null}

        {gallery.length ? (
          <section className="league-detail-section league-detail-section--muted" aria-labelledby="league-art-title">
            <h2 id="league-art-title" className="league-detail-section__title">Art</h2>
            <div className="league-art-grid">
              {gallery.map((item, index) => (
                <figure key={`${item.url}-${index}`} className="league-art-item">
                  <img src={item.url} alt={item.caption || ""} loading="lazy" />
                  {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
