import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineStar, HiOutlineTrophy } from "react-icons/hi2";
import { CardTierBadge } from "../../components/cards/CardTierBadge.jsx";
import { PlayerProfileCard } from "../../components/cards/PlayerProfileCard.jsx";
import { HoloProfileViewportFx } from "../../components/player/HoloProfileViewportFx.jsx";
import { PlayerRoleIcons } from "../../components/PlayerRoleIcons.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { TeamLogoImg } from "../../components/TeamLogoImg.jsx";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { api } from "../../lib/api";
import { usePublicCachedQuery } from "../../hooks/usePublicCachedQuery.js";
import { useShowMoreList } from "../../hooks/useShowMoreList.js";
import { teamLogoForName } from "../player/dashboardTeamCard.js";
import { getMatchDisplayScores } from "../../utils/schedule.js";
import {
  premiumAboutClass,
  premiumCardGlowClass,
  premiumHeroBandClass,
  premiumLayoutClass,
  premiumShineTextClass,
  premiumTierPanelClass,
} from "../../utils/cardTierEffects.js";
import { resolveAccountAvatarUrl } from "../../utils/resolvePlayerAvatar.js";
import { resolveProfileBack } from "../../utils/profileBackNav.js";
import "../../components/cards/CardTierStyles.css";
import "../../styles/card-tier-effects.css";
import "../../styles/card-tier-effects-holo.css";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function recognitionBadgeClass(kind) {
  if (kind === "champion") return "player-profile__honor-badge player-profile__honor-badge--champion";
  if (kind === "mvp") return "player-profile__honor-badge player-profile__honor-badge--mvp";
  return "player-profile__honor-badge player-profile__honor-badge--custom";
}

function ProfileHonorBadge({ item }) {
  const labelParts = String(item.label || "").split("•");
  const seasonTag = labelParts[0]?.trim() || "";
  const honorTitle = labelParts.slice(1).join("•").trim() || item.kind || "Honor";
  const kind = item.kind || "custom";
  const MarkIcon = kind === "champion" ? HiOutlineTrophy : HiOutlineStar;

  return (
    <article className={recognitionBadgeClass(kind)}>
      <span className="player-profile__honor-badge-mark" aria-hidden="true">
        <MarkIcon />
      </span>
      <div className="player-profile__honor-badge-content">
        <div className="player-profile__honor-badge-top">
          {seasonTag ? <span className="player-profile__honor-badge-season">{seasonTag}</span> : null}
          <span className="player-profile__honor-badge-title">{honorTitle}</span>
        </div>
        {item.detail ? <p className="player-profile__honor-badge-sub">{item.detail}</p> : null}
      </div>
    </article>
  );
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

function resolveMatchScores(row) {
  const normalizedScore =
    typeof row.score === "string" ? row.score.replace(/\s*[–—]\s*/g, "-").trim() : "";
  return getMatchDisplayScores({
    team1: row.team1,
    team2: row.team2,
    team1Score: row.team1Score,
    team2Score: row.team2Score,
    winner: row.winner,
    meta: {
      score: normalizedScore,
      team1Score: row.team1Score,
      team2Score: row.team2Score,
    },
  });
}

function MatchScoreToast({ row }) {
  const scores = resolveMatchScores(row);

  if (!scores.ready) {
    return (
      <span className="player-profile__match-score-toast player-profile__match-score-toast--pending" aria-label="Score pending">
        <span className="player-profile__match-score-toast-vs">vs</span>
      </span>
    );
  }

  const team1Won = Boolean(scores.winner && row.team1 && scores.winner.toLowerCase() === row.team1.toLowerCase());
  const team2Won = Boolean(scores.winner && row.team2 && scores.winner.toLowerCase() === row.team2.toLowerCase());
  const playerOnTeam1 = Boolean(row.teamName && row.team1 && row.teamName.toLowerCase() === row.team1.toLowerCase());
  const playerOnTeam2 = Boolean(row.teamName && row.team2 && row.teamName.toLowerCase() === row.team2.toLowerCase());

  const toastTone =
    row.won === true
      ? "player-profile__match-score-toast--win"
      : row.won === false
        ? "player-profile__match-score-toast--loss"
        : "";

  return (
    <span
      className={`player-profile__match-score-toast${toastTone ? ` ${toastTone}` : ""}`}
      aria-label={`Score ${scores.team1} to ${scores.team2}`}
    >
      <span className="player-profile__match-score-toast-body">
        <span
          className={[
            "player-profile__match-score-toast-num",
            team1Won ? "player-profile__match-score-toast-num--winner" : "",
            playerOnTeam1 ? "player-profile__match-score-toast-num--player" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {scores.team1}
        </span>
        <span className="player-profile__match-score-toast-sep" aria-hidden>
          –
        </span>
        <span
          className={[
            "player-profile__match-score-toast-num",
            team2Won ? "player-profile__match-score-toast-num--winner" : "",
            playerOnTeam2 ? "player-profile__match-score-toast-num--player" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {scores.team2}
        </span>
      </span>
    </span>
  );
}

function matchSeasonTag(row) {
  return row.seasonCardBadge || (row.seasonNumber ? `S${row.seasonNumber}` : row.tournamentName || "");
}

function resolveStintStatus(entry) {
  if (entry.status === "active" && entry.seasonStatus === "concluded") {
    return { label: "Former", active: false };
  }
  if (entry.status === "active") return { label: "Active", active: true };
  if (entry.wasReplaced) return { label: "Replaced", active: false };
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

function MatchHistoryRow({ row }) {
  const metaLine = [matchSeasonTag(row), row.stageLabel, row.startAt ? formatDate(row.startAt) : ""]
    .filter(Boolean)
    .join(" · ");
  const team1Logo = teamLogoForName(row.team1);
  const team2Logo = teamLogoForName(row.team2);
  const playerOnTeam1 = row.teamName && row.team1 && row.teamName.toLowerCase() === row.team1.toLowerCase();
  const playerOnTeam2 = row.teamName && row.team2 && row.teamName.toLowerCase() === row.team2.toLowerCase();

  return (
    <li className="player-profile__match-row">
      <div className="player-profile__match-main">
        <div className={`player-profile__match-side${playerOnTeam1 ? " player-profile__match-side--player" : ""}`}>
          <TeamLogoImg src={team1Logo} alt="" width={40} height={40} className="player-profile__match-logo" />
          <span className="player-profile__match-team">{row.team1}</span>
        </div>
        <MatchScoreToast row={row} />
        <div className={`player-profile__match-side player-profile__match-side--away${playerOnTeam2 ? " player-profile__match-side--player" : ""}`}>
          <TeamLogoImg src={team2Logo} alt="" width={40} height={40} className="player-profile__match-logo" />
          <span className="player-profile__match-team">{row.team2}</span>
        </div>
      </div>
      <div className="player-profile__match-foot">
        <p className="player-profile__match-meta">{metaLine}</p>
        <div className="player-profile__match-tags">
          {row.won === true ? <span className="player-profile__match-tag player-profile__match-tag--win">W</span> : null}
          {row.won === false ? <span className="player-profile__match-tag player-profile__match-tag--loss">L</span> : null}
          {row.playedAsSub ? <span className="player-profile__match-tag">Sub</span> : null}
        </div>
      </div>
    </li>
  );
}

export function PublicPlayerProfilePage() {
  const { slug } = useParams();
  const location = useLocation();
  const profileBack = resolveProfileBack(location.state);
  const cacheKey = `public:player:${String(slug || "").trim().toLowerCase()}`;
  const fetchProfile = useMemo(() => () => api.getPublicPlayer(slug), [slug]);
  const { data: profile, loading, error } = usePublicCachedQuery(cacheKey, fetchProfile);

  const account = profile?.account;
  const card = profile?.card;
  const cardTier = card?.tier || "default";
  const layoutFxClass = premiumLayoutClass(cardTier);
  const profilePanelClass = (extra = "") =>
    premiumTierPanelClass(cardTier, `community-glass player-profile__panel ${extra}`.trim());
  const profileHeroPanelClass = premiumTierPanelClass(
    cardTier,
    "community-glass community-glass--liquid player-profile__panel player-profile__panel--hero",
  );
  const heroBandClass = premiumHeroBandClass(cardTier);
  const aboutFxClass = premiumAboutClass(cardTier);
  const holoCaptionShineClass = cardTier === "holo" ? premiumShineTextClass(cardTier) : "";
  const heroTitleShineClass =
    cardTier === "gold" ? premiumShineTextClass(cardTier, "hero") : holoCaptionShineClass;
  const bpcIdShineClass = holoCaptionShineClass;
  const memberSince = formatDate(account?.createdAt);
  const roles = account?.preferredRoles?.length ? account.preferredRoles.join(", ") : null;
  const avatarUrl = resolveAccountAvatarUrl(account);
  const recognitions = profile?.recognitions || [];
  const currentTeam = profile?.currentTeam;
  const aboutTeamLogoUrl =
    teamLogoForName(currentTeam?.team?.name) || currentTeam?.team?.logoUrl?.trim() || "";
  const stintGroups = useMemo(() => groupStintsBySeason(profile?.teamHistory), [profile?.teamHistory]);
  const {
    visible: visibleMatchHistory,
    hasMore: hasMoreMatchHistory,
    canCollapse: canCollapseMatchHistory,
    showMore: showMoreMatchHistory,
    showLess: showLessMatchHistory,
  } = useShowMoreList(profile?.matchHistory, {
    resetKey: `${slug}:${profile?.matchHistory?.length ?? 0}`,
  });

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
        className={`community-page__hero-band player-profile__hero-band${heroBandClass ? ` ${heroBandClass}` : ""}`}
        aria-labelledby="player-profile-title"
      >
        <div className="community-page__hero-overlay" aria-hidden="true" />
        <div className="community-page__hero-inner player-profile__hero-inner">
          <Link to={profileBack.to} className="player-profile__back">
            <HiOutlineArrowLeft aria-hidden="true" />
            {profileBack.label}
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
                  <h1
                    id="player-profile-title"
                    className={`community-page__hero-title${heroTitleShineClass ? ` ${heroTitleShineClass}` : ""}`}
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
                    {currentTeam?.team?.name ? (
                      <span className="player-profile__team-chip">{currentTeam.team.name}</span>
                    ) : null}
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
            <section className={profileHeroPanelClass}>
              <div className="player-profile__hero-grid">
                <div className="player-profile__card-wrap">
                  {card ? <PlayerProfileCard manifest={card} cardTier={cardTier} /> : null}
                </div>
                <div
                  className={`player-profile__about${aboutTeamLogoUrl ? " player-profile__about--team" : ""}${aboutFxClass ? ` ${aboutFxClass}` : ""}`}
                  style={aboutTeamLogoUrl ? { "--about-team-logo": `url("${aboutTeamLogoUrl}")` } : undefined}
                >
                  {aboutTeamLogoUrl ? <div className="player-profile__about-team-bg" aria-hidden="true" /> : null}
                  <div className="player-profile__about-inner">
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
                        label="Matches"
                        value={profile.career?.matchesPlayed != null ? profile.career.matchesPlayed : null}
                      />
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
              </div>
            </section>

            <div className="player-profile__content-grid">
              <div className="player-profile__content-col player-profile__content-col--main">
                {currentTeam?.team ? (
                  <section className={profilePanelClass()}>
                    <h2 className="player-profile__section-title">Current team</h2>
                    <div className="player-profile__team-card player-profile__team-card--featured">
                      <TeamLogoImg
                        src={aboutTeamLogoUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="player-profile__team-logo player-profile__team-logo--lg"
                      />
                      <div className="player-profile__team-card-copy">
                        <p className="player-profile__team-name">{currentTeam.team.name}</p>
                        {currentTeam.player?.role ? (
                          <p className="player-profile__team-role">Role · {currentTeam.player.role}</p>
                        ) : null}
                      </div>
                    </div>
                    {rosterMembers.length ? (
                      <>
                        <p className="player-profile__subsection-label">Roster</p>
                        <div className="player-profile__teammate-grid">
                          {rosterMembers.map((mate) => (
                            <TeammateChip
                              key={mate.id || mate.name}
                              mate={mate}
                              isSelf={mate.id === currentTeam.player?.id}
                              linkState={location.state}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                    {currentTeam.formerTeammates?.length ? (
                      <>
                        <p className="player-profile__subsection-label">Former members</p>
                        <ul className="player-profile__teammates player-profile__teammates--former">
                          {currentTeam.formerTeammates.map((mate) => (
                            <li key={`former-${mate.id}`} className="player-profile__teammate-former">
                              {mate.slug ? (
                                <Link to={`/player/${mate.slug}`} state={location.state} className="player-profile__teammate-link">
                                  {mate.name}
                                </Link>
                              ) : (
                                <span className="player-profile__teammate-link player-profile__teammate-link--static">
                                  {mate.name}
                                </span>
                              )}
                              <PlayerRoleIcons player={mate} className="player-profile__teammate-former-roles" size="sm" />
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </section>
                ) : null}

                {profile.matchHistory?.length ? (
                  <section className={profilePanelClass()}>
                    <h2 className="player-profile__section-title">Match history</h2>
                    <ul className="player-profile__match-list">
                      {visibleMatchHistory.map((row) => (
                        <MatchHistoryRow key={`${row.matchId}-${row.teamName}-${row.appearanceLabel}`} row={row} />
                      ))}
                    </ul>
                    {hasMoreMatchHistory || canCollapseMatchHistory ? (
                      <div className="player-profile__show-more-wrap">
                        {hasMoreMatchHistory ? (
                          <button type="button" className="player-profile__show-more-btn" onClick={showMoreMatchHistory}>
                            Show more
                          </button>
                        ) : null}
                        {canCollapseMatchHistory ? (
                          <button type="button" className="player-profile__show-more-btn" onClick={showLessMatchHistory}>
                            Show less
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>

              <div className="player-profile__content-col player-profile__content-col--side">
                {profile.seasonHistory?.length ? (
                  <section className={profilePanelClass()}>
                    <h2 className="player-profile__section-title">Season history</h2>
                    <ul className="player-profile__history-list">
                      {profile.seasonHistory.map((entry) => (
                        <li key={`${entry.seasonSlug}-${entry.seasonNumber}`} className="player-profile__history-item">
                          <div className="player-profile__history-team">
                            {entry.teamLogoUrl ? (
                              <img src={entry.teamLogoUrl} alt="" className="player-profile__history-logo" />
                            ) : (
                              <TeamLogoImg
                                src={teamLogoForName(entry.teamName)}
                                alt=""
                                width={36}
                                height={36}
                                className="player-profile__history-logo"
                              />
                            )}
                            <div>
                              <Link to={`/seasons/${entry.seasonSlug}`} className="player-profile__history-title">
                                {entry.seasonName || `Season ${entry.seasonNumber}`}
                              </Link>
                              {entry.teamName ? <p className="player-profile__history-sub">{entry.teamName}</p> : null}
                            </div>
                          </div>
                          <div className="player-profile__history-meta">
                            {entry.highestStage ? <span>{entry.highestStage}</span> : null}
                            {entry.placement ? <span>#{entry.placement}</span> : null}
                            {entry.role ? <span>{entry.role}</span> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
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

                {profile.achievements?.length ? (
                  <section className={profilePanelClass()}>
                    <h2 className="player-profile__section-title">Achievements</h2>
                    <ul className="player-profile__achievements">
                      {profile.achievements.map((item, index) => (
                        <li key={item.id || index}>{typeof item === "string" ? item : item.title || item.label}</li>
                      ))}
                    </ul>
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
