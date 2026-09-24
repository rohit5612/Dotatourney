import { dotabuffPlayerUrl, resolveHeroImageUrls } from "../../../utils/dotaAssets.js";
import { HeroDigestDotaVisual } from "./HeroDigestDotaVisual.jsx";

function StatPill({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="profile-feed__stat-pill">
      <span className="profile-feed__stat-pill-label">{label}</span>
      <span className="profile-feed__stat-pill-value">{value}</span>
    </div>
  );
}

function heroRowKey(hero, index, prefix) {
  if (hero?.heroId != null && hero.heroId !== "") return `${prefix}-id-${hero.heroId}`;
  if (hero?.heroSlug) return `${prefix}-${hero.heroSlug}`;
  if (hero?.heroName) return `${prefix}-${hero.heroName}`;
  return `${prefix}-idx-${index}`;
}

function HeroRow({ hero }) {
  if (!hero) return null;
  const { portrait, name } = resolveHeroImageUrls(hero);
  return (
    <div className="profile-feed__hero-row" title={name}>
      {portrait ? (
        <img src={portrait} alt="" className="profile-feed__hero-icon" loading="lazy" title={name} />
      ) : (
        <span className="profile-feed__hero-icon profile-feed__hero-icon--fallback" aria-hidden="true" />
      )}
      <div className="profile-feed__hero-copy">
        <span className="profile-feed__hero-name">{name}</span>
        <span className="profile-feed__hero-meta">
          {hero.games}g · {hero.winRate != null ? `${hero.winRate}% WR` : ""}
        </span>
      </div>
    </div>
  );
}

function dotaStatsMeta(dotaStats) {
  const global = dotaStats?.global;
  const leagueEntries = (dotaStats?.leagues || []).filter((entry) => entry?.stats?.games > 0);
  const updated = dotaStats?.lastUpdated
    ? new Date(dotaStats.lastUpdated).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const hasGlobal =
    global &&
    (global.rankLabel ||
      global.mmrEstimate != null ||
      global.wins + global.losses > 0 ||
      global.avgKda ||
      global.topHeroes?.length);

  return { global, leagueEntries, updated, hasGlobal, hasLeague: leagueEntries.length > 0 };
}

function DotaGlobalStatsBody({ global, updated, hasGlobal, layout }) {
  const titleClass =
    layout === "hero" ? "player-profile__hero-dota-title" : "profile-feed__post-title";
  const headClass =
    layout === "hero"
      ? "player-profile__hero-dota-head"
      : "profile-feed__post-head profile-feed__post-head--compact";

  return (
    <>
      <header className={headClass}>
        <div>
          <h2 className={titleClass}>Dota stats</h2>
          {updated ? (
            <p className={layout === "hero" ? "player-profile__hero-dota-sub" : "profile-feed__post-sub"}>
              Updated {updated}
            </p>
          ) : null}
        </div>
        {global?.rankLabel ? (
          <span className="profile-feed__rank-medal" title="Rank medal">
            {global.rankLabel}
          </span>
        ) : null}
      </header>

      {!hasGlobal ? (
        <p className="profile-feed__muted">Profile stats will appear after OpenDota sync.</p>
      ) : (
        <>
          <div className="profile-feed__stat-grid profile-feed__stat-grid--visual profile-feed__stat-grid--hero">
            <StatPill label="MMR est." value={global.mmrEstimate != null ? global.mmrEstimate : null} />
            <StatPill
              label="Overall"
              value={global.wins + global.losses > 0 ? `${global.wins}W · ${global.losses}L` : null}
            />
          </div>
          {global?.topHeroes?.length ? (
            <section className="profile-feed__heroes-all profile-feed__heroes-all--hero">
              <h3 className="profile-feed__league-title">Most played</h3>
              <div className="profile-feed__hero-grid profile-feed__hero-grid--visual profile-feed__hero-grid--hero">
                {global.topHeroes.slice(0, layout === "hero" ? 4 : 6).map((h, index) => (
                  <HeroRow key={heroRowKey(h, index, "global")} hero={h} />
                ))}
              </div>
            </section>
          ) : null}
          {global?.opendotaProfileUrl ? (
            <a href={global.opendotaProfileUrl} className="profile-feed__ext-link" target="_blank" rel="noreferrer">
              OpenDota profile
            </a>
          ) : null}
        </>
      )}
    </>
  );
}

export function DotaGlobalStatsHeroStrip({ dotaStats }) {
  if (!dotaStats?.available) return null;
  const { global, updated, hasGlobal } = dotaStatsMeta(dotaStats);

  if (!hasGlobal) {
    return (
      <p className="hero-digest__dota-hint profile-feed__muted">Dota stats appear after OpenDota sync.</p>
    );
  }

  const wins = global.wins ?? 0;
  const losses = global.losses ?? 0;
  const dotabuffUrl =
    global.dotabuffProfileUrl || dotabuffPlayerUrl(dotaStats.steam32) || null;
  return (
    <div className="hero-digest__dota" aria-label="Dota stats">
      <div className="hero-digest__dota-body">
        <HeroDigestDotaVisual global={global} wins={wins} losses={losses} />
        {global.topHeroes?.length ? (
          <div className="hero-digest__hero-pool-block">
            <p className="hero-digest__hero-pool-label">Top heroes played</p>
            <div className="hero-digest__hero-pool" aria-label="Most played heroes">
              {global.topHeroes.slice(0, 5).map((h, index) => {
              const { minimap: src, name } = resolveHeroImageUrls(h);
              return (
                <div key={heroRowKey(h, index, "hero-strip")} className="hero-digest__hero-cell" title={name}>
                  {src ? (
                    <img src={src} alt="" className="hero-digest__hero-minimap" loading="lazy" title={name} />
                  ) : (
                    <span className="hero-digest__hero-minimap hero-digest__hero-minimap--fallback" aria-hidden="true" />
                  )}
                  <span className="hero-digest__hero-stat">{h.games}g</span>
                  <span className="hero-digest__hero-stat hero-digest__hero-stat--wr">
                    {h.winRate != null ? `${h.winRate}%` : "—"}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        ) : null}
      </div>
      <div className="hero-digest__dota-foot">
        {updated ? <span className="hero-digest__sync">Synced {updated}</span> : null}
        {dotabuffUrl ? (
          <a href={dotabuffUrl} className="hero-digest__ext" target="_blank" rel="noreferrer">
            Dotabuff profile
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function DotaGlobalStatsPanel({ dotaStats, panelClass = "", layout = "panel" }) {
  if (!dotaStats?.available) return null;
  const { global, updated, hasGlobal } = dotaStatsMeta(dotaStats);

  if (layout === "hero") {
    return (
      <section className="player-profile__hero-dota" aria-label="Dota stats">
        <DotaGlobalStatsBody global={global} updated={updated} hasGlobal={hasGlobal} layout="hero" />
      </section>
    );
  }

  return (
    <article
      className={`profile-feed__post profile-feed__post--stats profile-feed__post--stats-global profile-feed__post--wire-row ${panelClass}`.trim()}
    >
      <DotaGlobalStatsBody global={global} updated={updated} hasGlobal={hasGlobal} layout="panel" />
    </article>
  );
}

export function DotaLeagueStatsPanel({ dotaStats, panelClass = "" }) {
  if (!dotaStats?.available) return null;
  const { leagueEntries, hasLeague } = dotaStatsMeta(dotaStats);

  return (
    <article
      className={`profile-feed__post profile-feed__post--stats profile-feed__post--stats-league profile-feed__post--wire-row ${panelClass}`.trim()}
    >
      <header className="profile-feed__post-head profile-feed__post-head--compact">
        <div>
          <h2 className="profile-feed__post-title">League stats</h2>
          <p className="profile-feed__post-sub">OpenDota league stats (Steam + league ID; may differ from BPC match feed)</p>
        </div>
      </header>

      {!hasLeague ? (
        <p className="profile-feed__muted">League stats appear once circuit games are synced.</p>
      ) : (
        <div className="profile-feed__league-stack">
          {leagueEntries.map((primaryLeague) => {
            const leagueStats = primaryLeague.stats;
            const leagueKey = primaryLeague.dotaLeagueId || primaryLeague.tournamentSlug;
            return (
              <section
                key={leagueKey}
                className="profile-feed__league-block profile-feed__league-block--card"
                aria-label={primaryLeague.tournamentName}
              >
                <h3 className="profile-feed__league-title">
                  {primaryLeague.tournamentName || "League"}
                  {leagueStats.winRate != null ? (
                    <span className="profile-feed__league-wr">{leagueStats.winRate}% WR</span>
                  ) : null}
                </h3>
                <div className="profile-feed__stat-grid profile-feed__stat-grid--visual">
                  <StatPill label="League games" value={leagueStats.games} />
                  <StatPill label="Record" value={`${leagueStats.wins}W · ${leagueStats.losses}L`} />
                  {leagueStats.avgKda ? (
                    <StatPill
                      label="Avg KDA"
                      value={`${leagueStats.avgKda.kills} / ${leagueStats.avgKda.deaths} / ${leagueStats.avgKda.assists}`}
                    />
                  ) : null}
                </div>
                {leagueStats.topHeroes?.length ? (
                  <div className="profile-feed__hero-grid profile-feed__hero-grid--visual">
                    {leagueStats.topHeroes.slice(0, 6).map((h, index) => (
                      <HeroRow key={heroRowKey(h, index, `league-${leagueKey}`)} hero={h} />
                    ))}
                  </div>
                ) : null}
                {primaryLeague.dotabuffLeagueUrl ? (
                  <a
                    href={primaryLeague.dotabuffLeagueUrl}
                    className="profile-feed__ext-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Dotabuff league
                  </a>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

/** @deprecated Use DotaGlobalStatsPanel + DotaLeagueStatsPanel for wireframe layout */
export function DotaStatsDigest({ dotaStats, panelClass = "" }) {
  if (!dotaStats?.available) return null;
  const { hasGlobal, hasLeague } = dotaStatsMeta(dotaStats);
  if (!hasGlobal && !hasLeague) {
    return (
      <article className={`profile-feed__post profile-feed__post--stats ${panelClass}`.trim()}>
        <h2 className="profile-feed__post-title">Dota stats</h2>
        <p className="profile-feed__muted">
          Stats are not cached yet. Run an OpenDota sync after match days to populate league and profile data.
        </p>
      </article>
    );
  }
  return (
    <>
      <DotaGlobalStatsPanel dotaStats={dotaStats} panelClass={panelClass} />
      <DotaLeagueStatsPanel dotaStats={dotaStats} panelClass={panelClass} />
    </>
  );
}
