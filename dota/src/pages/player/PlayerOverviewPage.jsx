import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BpclCard } from "../../components/cards/BpclCard.jsx";
import { BpcCoin } from "../../components/coins/BpcCoin.jsx";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { TeamCard } from "../../components/teams/TeamCard.jsx";
import { playerApi } from "../../lib/playerApi";
import { buildPlayerDashboardTeamCard, teamLogoForName } from "./dashboardTeamCard.js";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";

const LINKAGE_ITEMS = [
  { key: "emailVerified", label: "Email verified" },
  { key: "steamLinked", label: "Steam linked", detailKey: "steamPersona" },
  { key: "discordLinked", label: "Discord linked", detailKey: "discordUsername" },
];

function LinkageIcon({ done }) {
  return (
    <span className={`player-dash__link-icon${done ? " is-done" : ""}`} aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </span>
  );
}

export function PlayerOverviewPage() {
  const { account, coinBalance } = useOutletContext();
  const [team, setTeam] = useState(null);
  const [matches, setMatches] = useState([]);
  const [cardManifest, setCardManifest] = useState(null);

  useEffect(() => {
    if (!account?.slug) return;
    playerApi.publicCard(account.slug).then((r) => setCardManifest(r.card || r.manifest)).catch(() => {});
    playerApi.team().then(setTeam).catch(() => {});
    playerApi.matches().then((r) => setMatches(r.matches || [])).catch(() => {});
  }, [account?.slug]);

  const teamInfo = team?.team?.team;

  const dashboardTeam = useMemo(() => buildPlayerDashboardTeamCard(team), [team]);

  const heroTeamLogoUrl =
    dashboardTeam?.logoUrl || teamLogoForName(teamInfo?.name) || teamInfo?.logoUrl?.trim() || "";

  if (!account) return null;

  const memberSince = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";

  const upcoming = matches.find((m) => m.status !== "completed" && m.status !== "done");
  const linkageDone = LINKAGE_ITEMS.filter((item) => account[item.key]).length;
  const linkageTotal = LINKAGE_ITEMS.length;
  const linkagePct = Math.round((linkageDone / linkageTotal) * 100);

  return (
    <div className="player-dash__overview">
      <header className={`player-dash__hero${heroTeamLogoUrl ? " player-dash__hero--team" : ""}`}>
        {heroTeamLogoUrl ? (
          <div
            className="player-dash__hero-team-logo"
            style={{ "--team-logo": `url("${heroTeamLogoUrl}")` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="player-dash__hero-main">
          <div className="player-dash__hero-avatar-wrap">
            {account.steamAvatarUrl ? (
              <img src={account.steamAvatarUrl} alt="" className="player-dash__avatar player-dash__avatar--hero" />
            ) : (
              <div className="player-dash__avatar player-dash__avatar--hero player-dash__avatar--fallback">
                {(account.displayName || "?")[0]}
              </div>
            )}
          </div>
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Overview</p>
            <h1 className="player-dash__hero-title">{account.displayName}</h1>
            <div className="player-dash__hero-meta">
              <span className="player-dash__badge">{account.bpcId}</span>
              {memberSince ? <span className="player-dash__hero-chip">Member since {memberSince}</span> : null}
            </div>
          </div>
        </div>

        <div className="player-dash__hero-stats">
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">BPC coins</span>
            <BpcCoin amount={coinBalance} size="sm" className="player-dash__stat-value" />
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Registration</span>
            <span
              className={`player-dash__stat-pill${account.eligibleForRegistration ? " is-ready" : " is-pending"}`}
            >
              {account.eligibleForRegistration ? "Eligible" : `${linkageDone}/${linkageTotal} linked`}
            </span>
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Upcoming</span>
            <span className="player-dash__stat-value-text">
              {upcoming ? "1 match" : matches.length ? "None scheduled" : "—"}
            </span>
          </div>
        </div>

        <div className="player-dash__hero-actions">
          <Link
            to="/dashboard/tournaments"
            className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
          >
            <DashboardActionIcon name="tournaments" />
            <span>Tournaments</span>
          </Link>
          <Link to="/dashboard/settings" className="player-dash__action player-dash__action--edit">
            <DashboardActionIcon name="edit" />
            <span>Edit profile</span>
          </Link>
          <Link
            to={`/player/${account.slug}`}
            className="player-dash__action player-dash__action--public"
          >
            <DashboardActionIcon name="public" />
            <span>Public profile</span>
          </Link>
        </div>
      </header>

      {upcoming ? (
        <section className="player-dash__match-banner" aria-label="Upcoming match">
          <div className="player-dash__match-banner-copy">
            <p className="player-dash__match-banner-label">Next match</p>
            <p className="player-dash__match-banner-title">
              {upcoming.team1} <span className="player-dash__match-vs">vs</span> {upcoming.team2}
            </p>
            {upcoming.startAt ? (
              <p className="player-dash__match-banner-time">{new Date(upcoming.startAt).toLocaleString()}</p>
            ) : null}
          </div>
          <span className="player-dash__match-banner-badge">Scheduled</span>
        </section>
      ) : null}

      <div className="player-dash__overview-grid">
        <section className="player-dash__card player-dash__card--span-2">
          <header className="player-dash__card-head">
            <div>
              <h2 className="player-dash__card-title">Account linkage</h2>
              <p className="player-dash__card-sub">Required before tournament registration</p>
            </div>
            <div className="player-dash__progress-ring" style={{ "--progress": linkagePct }} aria-hidden="true">
              <span className="player-dash__progress-ring-label">{linkageDone}/{linkageTotal}</span>
            </div>
          </header>

          <ul className="player-dash__link-list">
            {LINKAGE_ITEMS.map((item) => {
              const done = Boolean(account[item.key]);
              const detail = item.detailKey && done ? account[item.detailKey] : null;
              return (
                <li key={item.key} className={`player-dash__link-row${done ? " is-done" : ""}`}>
                  <LinkageIcon done={done} />
                  <div className="player-dash__link-copy">
                    <span className="player-dash__link-label">{item.label}</span>
                    {detail ? <span className="player-dash__link-detail">{detail}</span> : null}
                  </div>
                  <span className={`player-dash__link-status${done ? " is-done" : ""}`}>
                    {done ? "Done" : "Required"}
                  </span>
                </li>
              );
            })}
          </ul>

          {!account.eligibleForRegistration ? (
            <div className="player-dash__card-actions">
              {!account.steamLinked ? (
                <a className="btn btn-secondary btn-sm" href={playerApi.oauthStartUrl("steam")}>
                  Link Steam
                </a>
              ) : null}
              {!account.discordLinked ? (
                <a className="btn btn-secondary btn-sm" href={playerApi.oauthStartUrl("discord")}>
                  Link Discord
                </a>
              ) : null}
            </div>
          ) : (
            <p className="player-dash__card-note player-dash__card-note--ok">You&apos;re cleared to register for tournaments.</p>
          )}
        </section>

        <div className="player-dash__overview-duo player-dash__card--span-2">
          <section className="player-dash__card player-dash__overview-panel">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Player card</h2>
                <p className="player-dash__card-sub">Your season identity card</p>
              </div>
            </header>
            <div className="player-dash__overview-panel-body player-dash__overview-panel-body--player">
              {cardManifest ? (
                <BpclCard manifest={cardManifest} />
              ) : (
                <div className="player-dash__empty player-dash__overview-panel-empty">
                  <p>Complete registration to unlock your card.</p>
                  <Link to="/dashboard/tournaments" className="player-dash__empty-link">
                    Register now →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="player-dash__card player-dash__overview-panel">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Current team</h2>
                <p className="player-dash__card-sub">Your squad on the active tournament roster</p>
              </div>
            </header>
            <div className="player-dash__overview-panel-body player-dash__overview-panel-body--team">
              {dashboardTeam ? (
                <TeamCard team={dashboardTeam} index={0} />
              ) : (
                <div className="player-dash__empty player-dash__overview-panel-empty">
                  <p>No team on the active tournament yet.</p>
                  <Link to="/dashboard/tournaments" className="player-dash__empty-link">
                    Browse tournaments →
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
