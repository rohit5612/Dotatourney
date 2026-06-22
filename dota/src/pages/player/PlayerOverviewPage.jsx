import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { CardTierBadge, cardTierDisplayLabel } from "../../components/cards/CardTierBadge.jsx";
import { PlayerProfileCard } from "../../components/cards/PlayerProfileCard.jsx";
import { BpcCoin } from "../../components/coins/BpcCoin.jsx";
import { CardUpgradeModal } from "../../components/player/CardUpgradeModal.jsx";
import { CardUpgradeSuccessModal } from "../../components/player/CardUpgradeSuccessModal.jsx";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { MatchesSchedulePanel } from "../../components/player/MatchesSchedulePanel.jsx";
import { PlayerSetupChecklist } from "../../components/player/onboarding/PlayerSetupChecklist.jsx";
import { TeamCard } from "../../components/teams/TeamCard.jsx";
import { playerApi } from "../../lib/playerApi";
import { buildPlayerDashboardTeamCard, teamLogoForName } from "./dashboardTeamCard.js";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";
import "../../components/cards/CardTierStyles.css";

export function PlayerOverviewPage() {
  const { account, coinBalance, refreshMe } = useOutletContext();
  const [team, setTeam] = useState(null);
  const [matchSchedule, setMatchSchedule] = useState(null);
  const [cardManifest, setCardManifest] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [upgradeEligibility, setUpgradeEligibility] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(null);

  const refreshCardManifest = useCallback(() => {
    if (!account?.slug) return Promise.resolve();
    return playerApi
      .publicCard(account.slug)
      .then((r) => setCardManifest(r.card || r.manifest))
      .catch(() => {});
  }, [account?.slug]);

  const loadUpgradeEligibility = useCallback(() => {
    return playerApi.upgradeEligibility().then(setUpgradeEligibility).catch(() => setUpgradeEligibility(null));
  }, []);

  const loadMatches = useCallback(() => {
    return playerApi.matches().then(setMatchSchedule).catch(() => setMatchSchedule(null));
  }, []);

  useEffect(() => {
    if (!account?.slug) return;
    playerApi.publicCard(account.slug).then((r) => setCardManifest(r.card || r.manifest)).catch(() => {});
    playerApi.team().then(setTeam).catch(() => {});
    loadMatches();
    playerApi.upcomingTournaments().then((r) => setTournaments(r.tournaments || [])).catch(() => {});
    playerApi.history().then((r) => {
      setRegistrations(r.registrations || []);
      setRecognitions(r.recognitions || []);
    }).catch(() => {});
    loadUpgradeEligibility();
  }, [account?.slug, loadMatches, loadUpgradeEligibility]);

  const teamInfo = team?.team?.team;
  const dashboardTeam = useMemo(() => buildPlayerDashboardTeamCard(team), [team]);
  const heroTeamLogoUrl =
    dashboardTeam?.logoUrl || teamLogoForName(teamInfo?.name) || teamInfo?.logoUrl?.trim() || "";
  const cardTier = cardManifest?.tier || "default";

  if (!account) return null;

  const memberSince = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";

  const upcomingCount = matchSchedule?.upcoming?.length ?? 0;
  const linkageDone = [account.emailVerified, account.steamLinked, account.discordLinked].filter(Boolean).length;
  const canUpgradeCard = upgradeEligibility?.eligible && (upgradeEligibility?.upgradeOptions?.length ?? 0) > 0;

  async function handleUpgradeSuccess({ targetTier, tournamentName }) {
    setUpgradeModalOpen(false);
    await Promise.all([
      refreshCardManifest(),
      loadUpgradeEligibility(),
      playerApi.history().then((r) => {
        setRegistrations(r.registrations || []);
        setRecognitions(r.recognitions || []);
      }),
      refreshMe?.(),
    ]);
    setUpgradeSuccess({ targetTier, tournamentName });
  }

  return (
    <div className="player-dash__overview">
      <header
        className={`player-dash__hero player-dash__identity-hero${heroTeamLogoUrl ? " player-dash__hero--team" : ""}`}
      >
        {heroTeamLogoUrl ? (
          <div
            className="player-dash__hero-team-logo"
            style={{ "--team-logo": `url("${heroTeamLogoUrl}")` }}
            aria-hidden="true"
          />
        ) : null}

        <div className="player-dash__identity-grid">
          <div
            className={`player-dash__card-pedestal player-dash__card-pedestal--${cardTier}`}
            data-tour="card-pedestal"
          >
            {cardManifest ? (
              <PlayerProfileCard manifest={cardManifest} cardTier={cardTier} variant="pedestal" />
            ) : (
              <div className="player-dash__card-pedestal-empty">
                <p>Loading your season card…</p>
              </div>
            )}
          </div>

          <div className="player-dash__identity-copy">
            <p className="player-dash__hero-eyebrow">Overview</p>
            <h1 className="player-dash__hero-title">{account.displayName}</h1>
            <div className="player-dash__hero-meta">
              <span className="player-dash__badge">{account.bpcId}</span>
              <CardTierBadge tier={cardTier} />
              {memberSince ? <span className="player-dash__hero-chip">Member since {memberSince}</span> : null}
            </div>
            {recognitions.length ? (
              <div className="player-dash__hero-recognitions">
                {recognitions.map((item) => (
                  <span
                    key={item.id}
                    className={`player-dash__recognition player-dash__recognition--${item.kind || "custom"}`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="player-dash__identity-stats">
              <div className="player-dash__stat">
                <span className="player-dash__stat-label">BPC coins</span>
                <BpcCoin amount={coinBalance} size="sm" className="player-dash__stat-value" />
              </div>
              <div className="player-dash__stat">
                <span className="player-dash__stat-label">Registration</span>
                <span
                  className={`player-dash__stat-pill${account.eligibleForRegistration ? " is-ready" : " is-pending"}`}
                >
                  {account.eligibleForRegistration ? "Eligible" : `${linkageDone}/3 linked`}
                </span>
              </div>
              <div className="player-dash__stat">
                <span className="player-dash__stat-label">Upcoming</span>
                <span className="player-dash__stat-value-text">
                  {upcomingCount ? `${upcomingCount} match${upcomingCount === 1 ? "" : "es"}` : "—"}
                </span>
              </div>
            </div>

            <div className="player-dash__hero-actions">
              {canUpgradeCard ? (
                <button
                  type="button"
                  className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
                  onClick={() => setUpgradeModalOpen(true)}
                >
                  <DashboardActionIcon name="tournaments" />
                  <span>Upgrade card</span>
                </button>
              ) : null}
              <Link
                to="/dashboard/tournaments"
                className={`player-dash__action player-dash__action--tournaments${canUpgradeCard ? "" : " player-dash__action--lead"}`}
              >
                <DashboardActionIcon name="tournaments" />
                <span>Tournaments</span>
              </Link>
              <Link to="/dashboard/settings" className="player-dash__action player-dash__action--edit">
                <DashboardActionIcon name="edit" />
                <span>Edit profile</span>
              </Link>
              <Link to={`/player/${account.slug}`} className="player-dash__action player-dash__action--public">
                <DashboardActionIcon name="public" />
                <span>Public profile</span>
              </Link>
            </div>

            {canUpgradeCard ? (
              <div className="player-dash__upgrade-banner">
                <p className="player-dash__upgrade-banner-text">
                  You&apos;re on <strong>{cardTierDisplayLabel(upgradeEligibility.currentTier)}</strong> for{" "}
                  <strong>{upgradeEligibility.tournament?.name}</strong>. Upgrade to unlock a higher card tier for
                  this season.
                </p>
                <button
                  type="button"
                  className="player-dash__upgrade-banner-btn"
                  onClick={() => setUpgradeModalOpen(true)}
                >
                  View upgrade options
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <PlayerSetupChecklist account={account} tournaments={tournaments} registrations={registrations} />

      <div className="player-dash__overview-grid player-dash__overview-grid--wide">
        <section className="player-dash__card player-dash__overview-panel" data-tour="team-panel">
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

        <MatchesSchedulePanel schedule={matchSchedule} onRefresh={loadMatches} />
      </div>

      <CardUpgradeModal
        open={upgradeModalOpen}
        eligibility={upgradeEligibility}
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={handleUpgradeSuccess}
      />

      <CardUpgradeSuccessModal
        open={Boolean(upgradeSuccess)}
        targetTier={upgradeSuccess?.targetTier}
        tournamentName={upgradeSuccess?.tournamentName}
        onClose={() => setUpgradeSuccess(null)}
      />
    </div>
  );
}

