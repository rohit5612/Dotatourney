import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineMapPin, HiOutlineTrophy, HiOutlineUserGroup } from "react-icons/hi2";
import { CardDeck } from "../../components/cards/CardDeck.jsx";
import { CardTierBadge } from "../../components/cards/CardTierBadge.jsx";
import { ProfileHonorBadge } from "../../components/honors/ProfileHonorBadge.jsx";
import { PlayerProfileCard } from "../../components/cards/PlayerProfileCard.jsx";
import { HoloProfileViewportFx } from "../../components/player/HoloProfileViewportFx.jsx";
import { PlayerRoleIcons } from "../../components/PlayerRoleIcons.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { TeamLogoImg } from "../../components/TeamLogoImg.jsx";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { api } from "../../lib/api";
import { playerApi } from "../../lib/playerApi";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import { teamLogoForName } from "../player/dashboardTeamCard.js";
import {
  premiumHeroBandClass,
  premiumLayoutClass,
  premiumShineTextClass,
  premiumTierPanelClass,
} from "../../utils/cardTierEffects.js";
import { resolveProfileBack } from "../../utils/profileBackNav.js";
import { rankMedalImageUrl } from "../../utils/dotaAssets.js";
import { mmrFromRankTier } from "../../utils/dotaRankMmr.js";
import {
  DotaGlobalStatsHeroStrip,
  DotaLeagueStatsPanel,
} from "../../components/player-profile/feed/DotaStatsDigest.jsx";
import { MatchActivityFeed } from "../../components/player-profile/feed/MatchActivityFeed.jsx";
import "../../components/cards/CardTierStyles.css";
import "../../styles/card-tier-effects.css";
import "../../styles/card-tier-effects-holo.css";
import "../../styles/seasons-page.css";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRibbonMmr(mmr) {
  if (mmr == null || mmr === "") return null;
  const n = Number(mmr);
  if (!Number.isFinite(n)) return String(mmr);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function HeroDigestRibbonItem({ icon: Icon, label, value, children }) {
  const content = children ?? value;
  if (content == null || content === "") return null;
  const isRich = typeof content !== "string" && typeof content !== "number";
  return (
    <div className="hero-digest__ribbon-item">
      {Icon ? (
        <span className="hero-digest__ribbon-icon" aria-hidden="true">
          <Icon />
        </span>
      ) : null}
      <div className="hero-digest__ribbon-copy">
        <span className="hero-digest__ribbon-k">{label}</span>
        <span
          className={`hero-digest__ribbon-v${isRich ? " hero-digest__ribbon-v--rich" : ""}`}
        >
          {content}
        </span>
      </div>
    </div>
  );
}

function resolveStintStatus(entry) {
  if (entry.status === "active" && entry.seasonStatus === "concluded") {
    return { label: "Former", active: false };
  }
  if (entry.status === "active") return { label: "Active", active: true };
  if (entry.wasTransferred) return { label: "Transferred", active: false };
  if (entry.wasReplaced) return { label: "Replaced", active: false };
  if (entry.teamEliminated) return { label: "Former (eliminated team)", active: false };
  return { label: "Former", active: false };
}

function groupStintsBySeason(teamHistory) {
  const groups = new Map();
  for (const entry of teamHistory || []) {
    const key =
      entry.seasonSlug ||
      String(entry.seasonNumber ?? entry.tournamentSlug ?? entry.tournamentName ?? "");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        seasonNumber: entry.seasonNumber,
        seasonSlug: entry.seasonSlug,
        seasonStatus: entry.seasonStatus,
        seasonLabel: entry.seasonNumber ? `Season ${entry.seasonNumber}` : entry.tournamentName,
        stints: [],
      });
    }
    groups.get(key).stints.push(entry);
  }
  return [...groups.values()].sort((a, b) => (b.seasonNumber ?? 0) - (a.seasonNumber ?? 0));
}

function TeammateChip({ mate, isSelf, linkState }) {
  const content = (
    <>
      <span className="player-profile__teammate-chip-avatar" aria-hidden="true">
        {(mate.name || "?")[0]}
      </span>
      <span className="player-profile__teammate-chip-copy">
        <span className="player-profile__teammate-chip-name">{mate.name}</span>
        <PlayerRoleIcons player={mate} className="player-profile__teammate-chip-roles" size="sm" />
      </span>
    </>
  );

  if (mate.slug && !isSelf) {
    return (
      <Link to={`/player/${mate.slug}`} state={linkState} className="player-profile__teammate-chip">
        {content}
      </Link>
    );
  }
  return <div className={`player-profile__teammate-chip${isSelf ? " player-profile__teammate-chip--self" : ""}`}>{content}</div>;
}

export function PublicPlayerProfilePage() {
  const { slug } = useParams();
  const location = useLocation();
  const profileBack = resolveProfileBack(location.state);
  const cacheKey = `public:player:${String(slug || "").trim().toLowerCase()}`;
  const fetchProfile = useMemo(() => () => api.getPublicPlayer(slug), [slug]);
  const { data: profile, loading, error } = usePublicCachedQuery(cacheKey, fetchProfile);
  const dotaCacheKey = `public:player:${String(slug || "").trim().toLowerCase()}:dota`;
  const fetchDotaStats = useMemo(() => () => api.getPublicPlayerDotaStats(slug), [slug]);
  const { data: dotaStats } = usePublicCachedQuery(dotaCacheKey, fetchDotaStats);
  const [cardDeck, setCardDeck] = useState(null);
  const [cardDeckLoading, setCardDeckLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setCardDeckLoading(true);
    playerApi
      .cardDeck(slug)
      .then((deck) => setCardDeck(deck))
      .catch(() => setCardDeck(null))
      .finally(() => setCardDeckLoading(false));
  }, [slug]);

  const account = profile?.account;
  const card = profile?.card;
  const cardTier = card?.tier || "default";
  const layoutFxClass = premiumLayoutClass(cardTier);
  const profilePanelClass = (extra = "") =>
    premiumTierPanelClass(cardTier, `community-glass player-profile__panel ${extra}`.trim());
  const heroBandClass = premiumHeroBandClass(cardTier);
  const holoCaptionShineClass = cardTier === "holo" ? premiumShineTextClass(cardTier) : "";
  const heroTitleShineClass =
    cardTier === "gold" ? premiumShineTextClass(cardTier, "hero") : holoCaptionShineClass;
  const bpcIdShineClass = holoCaptionShineClass;
  const memberSince = formatDate(account?.createdAt);
  const roles = account?.preferredRoles?.length ? account.preferredRoles.join(", ") : null;
  const recognitions = profile?.recognitions || [];
  const currentTeam = profile?.currentTeam;
  const aboutTeamLogoUrl =
    teamLogoForName(currentTeam?.team?.name) || currentTeam?.team?.logoUrl?.trim() || "";
  const heroTeamLogoStyle = aboutTeamLogoUrl
    ? { "--hero-team-logo": `url("${aboutTeamLogoUrl}")` }
    : undefined;
  const dotaMmr =
    dotaStats?.global?.rankMmr ?? mmrFromRankTier(dotaStats?.global?.rankTier) ?? null;
  const heroDigestRankMedalUrl = useMemo(() => {
    if (dotaStats?.global?.rankTier == null) return null;
    return (
      rankMedalImageUrl(dotaStats.global.rankTier, {
        leaderboardRank: dotaStats.global.leaderboardRank,
      }) || null
    );
  }, [dotaStats?.global?.rankTier, dotaStats?.global?.leaderboardRank]);
  const stintGroups = useMemo(() => groupStintsBySeason(profile?.teamHistory), [profile?.teamHistory]);
  const dotaMatchById = useMemo(() => {
    const byId = new Map();
    for (const row of dotaStats?.matchHistory || []) {
      byId.set(String(row.matchId), row);
    }
    return byId;
  }, [dotaStats?.matchHistory]);
  const profileMatchHistory = profile?.matchHistory || [];

  const rosterMembers = useMemo(() => {
    if (!currentTeam?.team) return [];
    const selfId = currentTeam.player?.id;
    const mates = currentTeam.teammates || [];
    const hasSelf = mates.some((mate) => mate.id === selfId);
    const list = [...mates];
    if (!hasSelf && currentTeam.player?.name) {
      list.unshift({
        id: currentTeam.player.id,
        name: currentTeam.player.name,
        displayName: currentTeam.player.displayName || currentTeam.player.name,
        role: currentTeam.player.role,
        roles: currentTeam.player.roles,
        slug: account?.slug,
        isCaptain: currentTeam.player.isCaptain,
      });
    }
    return list;
  }, [currentTeam, account?.slug]);

  return (
    <div className={`player-profile-layout community-page-layout${layoutFxClass ? ` ${layoutFxClass}` : ""}`}>
      {cardTier === "holo" ? <HoloProfileViewportFx /> : null}
      <section
        className={`community-page__hero-band player-profile__hero-band player-profile__hero-band--wire${heroBandClass ? ` ${heroBandClass}` : ""}`}
        aria-labelledby="player-profile-title"
        style={heroTeamLogoStyle}
      >
        <div className="community-page__hero-overlay" aria-hidden="true" />
        {aboutTeamLogoUrl ? (
          <div className="player-profile__hero-team-orb" aria-hidden="true" />
        ) : null}
        <div className="community-page__hero-inner player-profile__hero-inner">
          <Link to={profileBack.to} className="player-profile__back">
            <HiOutlineArrowLeft aria-hidden="true" />
            {profileBack.label}
          </Link>
          {loading && !profile ? (
            <PageLoadingSpinner label="Loading player profile…" compact />
          ) : error && !profile ? (
            <>
              <p className="community-page__eyebrow">{SITE_BRAND_SHORT}</p>
              <h1 id="player-profile-title" className="community-page__hero-title">
                Player not found
              </h1>
              <p className="community-page__hero-lead">{error}</p>
            </>
          ) : (
            <div className="player-profile__hero-wire">
              <div className="player-profile__hero-card-slot player-profile__card-wrap">
                {card ? <PlayerProfileCard manifest={card} cardTier={cardTier} /> : null}
              </div>

              <div className="player-profile__hero-identity">
                <h1
                  id="player-profile-title"
                  className={`player-profile__hero-name community-page__hero-title${heroTitleShineClass ? ` ${heroTitleShineClass}` : ""}`}
                >
                  {account?.displayName || account?.slug}
                </h1>
                <div className="player-profile__hero-meta">
                  <span
                    className={`player-profile__bpc-id${cardTier === "holo" ? " player-profile__bpc-id--holo" : ""}`}
                  >
                    {bpcIdShineClass ? (
                      <span className={bpcIdShineClass}>{account?.bpcId}</span>
                    ) : (
                      account?.bpcId
                    )}
                  </span>
                  <CardTierBadge tier={cardTier} />
                  {memberSince ? <span className="player-profile__member-since">Since {memberSince}</span> : null}
                </div>
                {recognitions.length ? (
                  <div className="player-profile__hero-recognitions" aria-label="Season honors">
                    {recognitions.map((item) => (
                      <ProfileHonorBadge key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}
              </div>

              <article
                className={profilePanelClass(
                  `community-glass--liquid player-profile__panel player-profile__hero-digest${heroDigestRankMedalUrl ? " player-profile__hero-digest--rank" : ""}`,
                )}
              >
                {heroDigestRankMedalUrl ? (
                  <div className="hero-digest__rank-medal" aria-hidden="true">
                    <img src={heroDigestRankMedalUrl} alt="" decoding="async" />
                  </div>
                ) : null}
                <div className="hero-digest__intro">
                <p
                  className={`hero-digest__bio player-profile__bio${account?.bio ? "" : " player-profile__bio--muted"}`}
                >
                  {account?.bio || "No bio yet."}
                </p>
                <div className="hero-digest__ribbon hero-digest__ribbon--profile" aria-label="Profile highlights">
                  <HeroDigestRibbonItem icon={HiOutlineTrophy} label="MMR" value={formatRibbonMmr(dotaMmr)} />
                  <HeroDigestRibbonItem icon={HiOutlineUserGroup} label="Roles">
                    {account?.preferredRoles?.length ? (
                      <PlayerRoleIcons player={account} roles={account.preferredRoles} size="sm" />
                    ) : (
                      roles
                    )}
                  </HeroDigestRibbonItem>
                  <HeroDigestRibbonItem icon={HiOutlineMapPin} label="Location" value={account?.location} />
                </div>
                </div>
                <div className="hero-digest__stats-slot">
                  <DotaGlobalStatsHeroStrip dotaStats={dotaStats} />
                </div>
                {(account?.steamProfile || account?.discordUsername) && (
                  <div className="hero-digest__links player-profile__links">
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
                )}
              </article>
            </div>
          )}
        </div>
      </section>

      <div className="community-page player-profile-page">
        {loading && !profile ? (
          <section className="community-glass community-glass--liquid player-profile__panel" aria-busy="true">
            <div className="player-profile__loading">
              <div className="player-profile__skeleton player-profile__skeleton--card" />
              <div className="player-profile__skeleton player-profile__skeleton--copy" />
            </div>
          </section>
        ) : null}

        {!loading && profile ? (
          <>
            <div className="player-profile__content-grid profile-feed-layout profile-wireframe">
              <div className="player-profile__content-col player-profile__content-col--main profile-feed profile-wireframe__main">
                <article className={`profile-feed__post profile-feed__post--team ${profilePanelClass()}`.trim()}>
                  <h2 className="player-profile__section-title">Team</h2>
                  {currentTeam?.team ? (
                    <>
                      <div className="player-profile__team-card player-profile__team-card--featured profile-wireframe__about-team">
                        <TeamLogoImg
                          src={aboutTeamLogoUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="player-profile__team-logo"
                        />
                        <div className="player-profile__team-card-copy">
                          <p className="player-profile__team-name">{currentTeam.team.name}</p>
                          {currentTeam.player?.role ? (
                            <p className="player-profile__team-role">Role · {currentTeam.player.role}</p>
                          ) : null}
                        </div>
                      </div>
                      {rosterMembers.length ? (
                        <div className="player-profile__teammate-grid profile-wireframe__about-roster">
                          {rosterMembers.map((mate) => (
                            <TeammateChip
                              key={mate.id || mate.name}
                              mate={mate}
                              isSelf={mate.id === currentTeam?.player?.id}
                              linkState={location.state}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="player-profile__bio player-profile__bio--muted">Not assigned to a team yet.</p>
                  )}
                </article>

                <DotaLeagueStatsPanel dotaStats={dotaStats} panelClass={profilePanelClass()} />

                {profileMatchHistory.length ? (
                  <MatchActivityFeed
                    allMatches={profileMatchHistory}
                    dotaMatchById={dotaMatchById}
                    panelClass={profilePanelClass()}
                  />
                ) : null}
              </div>

              <div className="player-profile__content-col player-profile__content-col--side profile-feed__rail profile-wireframe__rail">
                {!cardDeckLoading && cardDeck?.collection?.length > 0 ? (
                  <CardDeck
                    deck={cardDeck}
                    className={profilePanelClass("player-profile__card-deck profile-wireframe__deck")}
                    surfaceTier={cardTier}
                    hideWhenEmpty
                  />
                ) : null}

                {stintGroups.length ? (
                  <section className={profilePanelClass()}>
                    <h2 className="player-profile__section-title">Team stints</h2>
                    <div className="player-profile__stint-seasons">
                      {stintGroups.map((group) => (
                        <div key={group.key} className="player-profile__stint-season">
                          <header className="player-profile__stint-season-head">
                            {group.seasonSlug ? (
                              <Link to={`/seasons/${group.seasonSlug}`} className="player-profile__stint-season-title">
                                {group.seasonLabel}
                              </Link>
                            ) : (
                              <p className="player-profile__stint-season-title">{group.seasonLabel}</p>
                            )}
                            {group.seasonStatus === "concluded" ? (
                              <span className="player-profile__stint-season-badge">Concluded</span>
                            ) : group.seasonStatus === "active" ? (
                              <span className="player-profile__stint-season-badge player-profile__stint-season-badge--live">
                                Live
                              </span>
                            ) : null}
                          </header>
                          <ul className="player-profile__stint-list">
                            {group.stints.map((entry) => {
                              const stintStatus = resolveStintStatus(entry);
                              const logo = entry.logoUrl || teamLogoForName(entry.teamName);
                              return (
                                <li key={entry.membershipId || entry.rosterSnapshotId} className="player-profile__stint-item">
                                  <div className="player-profile__stint-team">
                                    <TeamLogoImg
                                      src={logo}
                                      alt=""
                                      width={32}
                                      height={32}
                                      className="player-profile__history-logo"
                                    />
                                    <div>
                                      <p className="player-profile__history-title">{entry.teamName}</p>
                                      <p className="player-profile__history-sub">
                                        {entry.startedAt
                                          ? formatDate(entry.startedAt)
                                          : entry.approvedAt
                                            ? formatDate(entry.approvedAt)
                                            : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="player-profile__history-meta">
                                    <span
                                      className={
                                        stintStatus.active
                                          ? "player-profile__stint-badge player-profile__stint-badge--active"
                                          : "player-profile__stint-badge"
                                      }
                                    >
                                      {stintStatus.label}
                                    </span>
                                    <span>
                                      {entry.matchesPlayed ?? 0} match{(entry.matchesPlayed ?? 0) === 1 ? "" : "es"}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <footer className={premiumTierPanelClass(cardTier, "community-glass player-profile__footer")}>
              Browse more players in the <Link to="/community">community directory</Link>.
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}
