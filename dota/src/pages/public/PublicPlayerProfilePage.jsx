import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { BpclCard } from "../../components/cards/BpclCard.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { api } from "../../lib/api";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import "../../components/cards/CardTierStyles.css";

const TIER_LABELS = {
  holo: "Holo",
  gold: "Gold",
  player: "Player",
  default: "Standard",
};

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tierBadgeClass(tier) {
  if (tier === "gold") return "player-profile__tier-badge player-profile__tier-badge--gold";
  if (tier === "holo") return "player-profile__tier-badge player-profile__tier-badge--holo";
  if (tier === "player") return "player-profile__tier-badge player-profile__tier-badge--player";
  return "player-profile__tier-badge";
}

function StatBlock({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="player-profile__stat">
      <span className="player-profile__stat-label">{label}</span>
      <span className="player-profile__stat-value">{value}</span>
    </div>
  );
}

export function PublicPlayerProfilePage() {
  const { slug } = useParams();
  const cacheKey = `public:player:${String(slug || "").trim().toLowerCase()}`;
  const fetchProfile = useMemo(() => () => api.getPublicPlayer(slug), [slug]);
  const { data: profile, loading, error } = usePublicCachedQuery(cacheKey, fetchProfile);

  const account = profile?.account;
  const card = profile?.card;
  const cardTier = card?.tier || "default";
  const memberSince = formatDate(account?.createdAt);
  const roles = account?.preferredRoles?.length ? account.preferredRoles.join(", ") : null;
  const avatarUrl = account?.steamAvatarUrl || account?.avatarUrl || "";

  return (
    <div className="player-profile-layout community-page-layout">
      <section className="community-page__hero-band player-profile__hero-band" aria-labelledby="player-profile-title">
        <div className="community-page__hero-overlay" aria-hidden="true" />
        <div className="community-page__hero-inner player-profile__hero-inner">
          <Link to="/community" className="player-profile__back">
            <HiOutlineArrowLeft aria-hidden="true" />
            Community
          </Link>
          {loading ? (
            <PageLoadingSpinner label="Loading player profile…" compact />
          ) : error ? (
            <>
              <p className="community-page__eyebrow">{SITE_BRAND_SHORT}</p>
              <h1 id="player-profile-title" className="community-page__hero-title">
                Player not found
              </h1>
              <p className="community-page__hero-lead">{error}</p>
            </>
          ) : (
            <>
              <p className="community-page__eyebrow">{SITE_BRAND_SHORT}</p>
              <div className="player-profile__hero-head">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="player-profile__hero-avatar" />
                ) : (
                  <div className="player-profile__hero-avatar player-profile__hero-avatar--fallback" aria-hidden="true">
                    {(account?.displayName || "?")[0]}
                  </div>
                )}
                <div className="player-profile__hero-copy">
                  <h1 id="player-profile-title" className="community-page__hero-title">
                    {account?.displayName || account?.slug}
                  </h1>
                  <div className="player-profile__hero-meta">
                    <span className="player-profile__bpc-id">{account?.bpcId}</span>
                    <span className={tierBadgeClass(cardTier)}>{TIER_LABELS[cardTier] || "Standard"}</span>
                    {memberSince ? <span className="player-profile__member-since">Since {memberSince}</span> : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="community-page player-profile-page">
        {loading ? (
          <section className="community-glass community-glass--liquid player-profile__panel" aria-busy="true">
            <div className="player-profile__loading">
              <div className="player-profile__skeleton player-profile__skeleton--card" />
              <div className="player-profile__skeleton player-profile__skeleton--copy" />
            </div>
          </section>
        ) : null}

        {!loading && !error && profile ? (
          <>
            <section className="community-glass community-glass--liquid player-profile__panel player-profile__panel--hero">
              <div className="player-profile__hero-grid">
                <div className="player-profile__card-wrap">
                  {card ? <BpclCard manifest={card} className="player-profile__card" /> : null}
                </div>
                <div className="player-profile__about">
                  <h2 className="player-profile__section-title">About</h2>
                  {account?.bio ? (
                    <p className="player-profile__bio">{account.bio}</p>
                  ) : (
                    <p className="player-profile__bio player-profile__bio--muted">No bio yet.</p>
                  )}
                  <div className="player-profile__stats-grid">
                    <StatBlock label="MMR" value={account?.mmr != null ? account.mmr : null} />
                    <StatBlock label="Roles" value={roles} />
                    <StatBlock label="Location" value={account?.location} />
                    <StatBlock
                      label="Registrations"
                      value={
                        profile.career?.approvedRegistrations != null
                          ? `${profile.career.approvedRegistrations} approved`
                          : null
                      }
                    />
                  </div>
                  <div className="player-profile__links">
                    {account?.steamProfile ? (
                      <a
                        href={account.steamProfile}
                        className="player-profile__link-btn"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Steam{account.steamPersona ? ` · ${account.steamPersona}` : ""}
                      </a>
                    ) : null}
                    {account?.discordUsername ? (
                      <span className="player-profile__link-chip">Discord · {account.discordUsername}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {profile.currentTeam?.team ? (
              <section className="community-glass player-profile__panel">
                <h2 className="player-profile__section-title">Current team</h2>
                <div className="player-profile__team-card">
                  {profile.currentTeam.team.logoUrl ? (
                    <img src={profile.currentTeam.team.logoUrl} alt="" className="player-profile__team-logo" />
                  ) : (
                    <div className="player-profile__team-logo player-profile__team-logo--fallback" aria-hidden="true">
                      {(profile.currentTeam.team.name || "?")[0]}
                    </div>
                  )}
                  <div>
                    <p className="player-profile__team-name">{profile.currentTeam.team.name}</p>
                    {profile.currentTeam.player?.role ? (
                      <p className="player-profile__team-role">{profile.currentTeam.player.role}</p>
                    ) : null}
                  </div>
                </div>
                {profile.currentTeam.teammates?.length ? (
                  <ul className="player-profile__teammates">
                    {profile.currentTeam.teammates.map((mate) => (
                      <li key={mate.id}>
                        <span>{mate.name}</span>
                        {mate.role ? <span className="player-profile__teammate-role">{mate.role}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {profile.seasonHistory?.length ? (
              <section className="community-glass player-profile__panel">
                <h2 className="player-profile__section-title">Season history</h2>
                <ul className="player-profile__history-list">
                  {profile.seasonHistory.map((entry) => (
                    <li key={`${entry.seasonSlug}-${entry.seasonNumber}`} className="player-profile__history-item">
                      <div>
                        <Link to={`/seasons/${entry.seasonSlug}`} className="player-profile__history-title">
                          {entry.seasonName || `Season ${entry.seasonNumber}`}
                        </Link>
                        {entry.teamName ? <p className="player-profile__history-sub">{entry.teamName}</p> : null}
                      </div>
                      <div className="player-profile__history-meta">
                        {entry.placement ? <span>#{entry.placement}</span> : null}
                        {entry.role ? <span>{entry.role}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {profile.teamHistory?.length ? (
              <section className="community-glass player-profile__panel">
                <h2 className="player-profile__section-title">Tournament teams</h2>
                <ul className="player-profile__history-list">
                  {profile.teamHistory.map((entry) => (
                    <li key={entry.rosterSnapshotId} className="player-profile__history-item">
                      <div className="player-profile__history-team">
                        {entry.logoUrl ? (
                          <img src={entry.logoUrl} alt="" className="player-profile__history-logo" />
                        ) : null}
                        <div>
                          <p className="player-profile__history-title">{entry.teamName}</p>
                          <p className="player-profile__history-sub">
                            {entry.tournamentName}
                            {entry.approvedAt ? ` · ${formatDate(entry.approvedAt)}` : ""}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {profile.achievements?.length ? (
              <section className="community-glass player-profile__panel">
                <h2 className="player-profile__section-title">Achievements</h2>
                <ul className="player-profile__achievements">
                  {profile.achievements.map((item, index) => (
                    <li key={item.id || index}>{typeof item === "string" ? item : item.title || item.label}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer className="community-glass player-profile__footer">
              Browse more players in the{" "}
              <Link to="/community">community directory</Link>.
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}
