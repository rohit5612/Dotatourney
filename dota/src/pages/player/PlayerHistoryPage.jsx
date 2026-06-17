import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import { useShowMoreList } from "../../hooks/useShowMoreList.js";
import { playerApi } from "../../lib/playerApi";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function registrationTone(reg) {
  if (reg.substitute) return "secondary";
  const status = (reg.status || "").toLowerCase();
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending") return "warm";
  return "muted";
}

function registrationLabel(reg) {
  if (reg.substitute) return "Substitute";
  return reg.status || "—";
}

function EmptyBlock({ title, hint, action }) {
  return (
    <div className="player-dash__empty-block">
      <p className="player-dash__empty-block-title">{title}</p>
      {hint ? <p className="player-dash__empty-block-hint">{hint}</p> : null}
      {action}
    </div>
  );
}

export function PlayerHistoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    playerApi
      .history()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const seasonCount = data?.seasonHistory?.length ?? 0;
  const teamCount = data?.teamHistory?.length ?? 0;
  const regCount = data?.registrations?.length ?? 0;
  const matchCount = data?.matchAppearances?.length ?? 0;
  const approvedCount = data?.career?.approvedRegistrations ?? 0;
  const {
    visible: visibleMatchAppearances,
    hasMore: hasMoreMatchAppearances,
    canCollapse: canCollapseMatchAppearances,
    showMore: showMoreMatchAppearances,
    showLess: showLessMatchAppearances,
  } = useShowMoreList(data?.matchAppearances, { resetKey: matchCount });

  return (
    <div className="player-dash__history">
      <header className="player-dash__hero player-dash__hero--compact">
        <div className="player-dash__hero-main">
          <div className="player-dash__page-hero-icon" aria-hidden="true">
            <DashboardNavIcon name="history" />
          </div>
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Your circuit record</p>
            <h1 className="player-dash__hero-title">History</h1>
            <p className="player-dash__hero-desc">
              Seasons played, teams drafted, and every tournament registration on your account.
            </p>
          </div>
        </div>

        <div className="player-dash__hero-stats player-dash__hero-stats--tourney">
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Seasons</span>
            <span className="player-dash__stat-value-text">{seasonCount}</span>
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Teams</span>
            <span className="player-dash__stat-value-text">{teamCount}</span>
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Approved</span>
            <span className="player-dash__stat-value-text">{approvedCount}</span>
          </div>
        </div>
      </header>

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {loading ? (
        <div className="player-dash__loading">
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Loading your history…</p>
        </div>
      ) : (
        <div className="player-dash__history-sections" data-tour="history-sections">
          <section className="player-dash__card player-dash__section-card">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Season history</h2>
                <p className="player-dash__card-sub">League seasons and final placements</p>
              </div>
              <span className="player-dash__section-count">{seasonCount}</span>
            </header>

            {data?.seasonHistory?.length ? (
              <ul className="player-dash__timeline">
                {data.seasonHistory.map((season) => (
                  <li key={season.seasonSlug} className="player-dash__timeline-item">
                    <span className="player-dash__timeline-dot" aria-hidden="true" />
                    <div className="player-dash__timeline-copy">
                      <p className="player-dash__timeline-title">{season.seasonName}</p>
                      <p className="player-dash__timeline-meta">
                        {season.teamName ? `Team ${season.teamName}` : "No team recorded"}
                        {season.highestStage ? ` · ${season.highestStage}` : ""}
                        {season.role ? ` · ${season.role}` : ""}
                      </p>
                    </div>
                    <span className="player-dash__tourney-badge player-dash__tourney-badge--muted">
                      {season.placement || season.seasonStatus || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock
                title="No seasons yet"
                hint="Register for a tournament to start building your season record."
                action={
                  <Link to="/dashboard/tournaments" className="player-dash__empty-link">
                    Browse tournaments →
                  </Link>
                }
              />
            )}
          </section>

          <section className="player-dash__card player-dash__section-card">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Team history</h2>
                <p className="player-dash__card-sub">Approved rosters you were drafted onto</p>
              </div>
              <span className="player-dash__section-count">{teamCount}</span>
            </header>

            {data?.teamHistory?.length ? (
              <div className="player-dash__team-grid">
                {data.teamHistory.map((team) => (
                  <article key={team.membershipId || team.rosterSnapshotId} className="player-dash__team-history-card">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt="" className="player-dash__team-history-logo" />
                    ) : (
                      <span className="player-dash__team-badge" aria-hidden="true">
                        {(team.teamName || "T")[0]}
                      </span>
                    )}
                    <div className="player-dash__team-history-copy">
                      <p className="player-dash__team-name">{team.teamName}</p>
                      <p className="player-dash__card-sub">{team.tournamentName}</p>
                      <p className="player-dash__team-history-date">
                        {team.status === "active" ? "Active" : team.wasReplaced ? "Replaced before playing" : "Former"}
                        {team.matchesPlayed != null ? ` · ${team.matchesPlayed} match${team.matchesPlayed === 1 ? "" : "es"}` : ""}
                      </p>
                      {team.startedAt ? (
                        <p className="player-dash__team-history-date">{formatDate(team.startedAt)}</p>
                      ) : team.approvedAt ? (
                        <p className="player-dash__team-history-date">{formatDate(team.approvedAt)}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock
                title="No teams yet"
                hint="Once you're drafted onto a roster, your team history will appear here."
              />
            )}
          </section>

          <section className="player-dash__card player-dash__section-card">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Match appearances</h2>
                <p className="player-dash__card-sub">Substitutions and lineup history per match</p>
              </div>
              <span className="player-dash__section-count">{matchCount}</span>
            </header>

            {data?.matchAppearances?.length ? (
              <>
                <ul className="player-dash__timeline">
                  {visibleMatchAppearances.map((row) => {
                    const score =
                      row.score ||
                      (row.team1Score != null && row.team2Score != null ? `${row.team1Score}–${row.team2Score}` : "");
                    return (
                      <li key={`${row.matchId}-${row.teamName}-${row.displayName}`} className="player-dash__timeline-item">
                        <span className="player-dash__timeline-dot" aria-hidden="true" />
                        <div className="player-dash__timeline-copy">
                          <p className="player-dash__timeline-title">
                            {row.team1} vs {row.team2}
                          </p>
                          <p className="player-dash__timeline-meta">
                            {row.seasonNumber ? `S${row.seasonNumber}` : row.tournamentName}
                            {row.stageLabel ? ` · ${row.stageLabel}` : ""}
                            {row.startAt ? ` · ${formatDate(row.startAt)}` : ""}
                            {row.teamName ? ` · ${row.teamName}` : ""}
                            {score ? ` · ${score}` : ""}
                            {row.won === true ? " · W" : row.won === false ? " · L" : ""}
                          </p>
                        </div>
                        <span className={`player-dash__tourney-badge player-dash__tourney-badge--${row.playedAsSub ? "secondary" : row.wasReplaced ? "warm" : "muted"}`}>
                          {row.appearanceLabel || (row.playedAsSub ? "Subbed in" : row.wasReplaced ? "Replaced" : "Played")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {hasMoreMatchAppearances || canCollapseMatchAppearances ? (
                  <div className="player-dash__show-more-wrap">
                    {hasMoreMatchAppearances ? (
                      <button type="button" className="player-dash__show-more-btn" onClick={showMoreMatchAppearances}>
                        Show more
                      </button>
                    ) : null}
                    {canCollapseMatchAppearances ? (
                      <button type="button" className="player-dash__show-more-btn" onClick={showLessMatchAppearances}>
                        Show less
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyBlock title="No match appearances yet" hint="Lineup history appears after scheduled matches and substitutions." />
            )}
          </section>

          <section className="player-dash__card player-dash__section-card">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <div>
                <h2 className="player-dash__card-title">Registrations</h2>
                <p className="player-dash__card-sub">Tournament sign-ups and substitute entries</p>
              </div>
              <span className="player-dash__section-count">{regCount}</span>
            </header>

            {data?.registrations?.length ? (
              <ul className="player-dash__history-list">
                {data.registrations.map((reg) => {
                  const tone = registrationTone(reg);
                  return (
                    <li key={reg.id} className="player-dash__history-row">
                      <div className="player-dash__history-row-copy">
                        <p className="player-dash__history-row-title">{reg.tournamentName}</p>
                        <p className="player-dash__history-row-meta">
                          {reg.cardTier || "default"} card
                          {reg.createdAt ? ` · ${formatDate(reg.createdAt)}` : ""}
                        </p>
                      </div>
                      <span className={`player-dash__tourney-badge player-dash__tourney-badge--${tone}`}>
                        {registrationLabel(reg)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock
                title="No registrations yet"
                hint="Your tournament and substitute sign-ups will be listed here."
                action={
                  <Link to="/dashboard/tournaments" className="player-dash__empty-link">
                    Go to tournaments →
                  </Link>
                }
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
