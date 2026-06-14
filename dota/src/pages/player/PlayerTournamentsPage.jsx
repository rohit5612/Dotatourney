import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { PlayerTournamentSeasonShell } from "../../components/player/PlayerTournamentSeasonShell.jsx";
import { resolveTournamentCardPresentation } from "../../utils/seasonPayload.js";
import { playerApi } from "../../lib/playerApi";
import { canJoinSubstitutePool, formatEntryFee, formatPrizePool, formatRegistrationSlots } from "./tournamentDisplay.js";
import { getTournamentState } from "./tournamentOverview.js";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(start, end) {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel || endLabel || null;
}

function TournamentCard({ tournament, account }) {
  const state = getTournamentState(tournament, account);
  const dateRange = formatDateRange(tournament.startDate, tournament.endDate);
  const substituteAvailable = state.key === "substitute";
  const { badge, displayLabel } = resolveTournamentCardPresentation(tournament);

  let action = null;

  if (state.key === "open") {
    action = (
      <Link
        to={`/dashboard/register/${tournament.slug}`}
        className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
      >
        <DashboardActionIcon name="tournaments" />
        <span>Register now</span>
      </Link>
    );
  } else if (state.key === "locked") {
    action = (
      <Link to="/dashboard/settings" className="player-dash__action player-dash__action--edit">
        <DashboardActionIcon name="edit" />
        <span>Complete linkage</span>
      </Link>
    );
  } else if (substituteAvailable) {
    action = (
      <Link
        to={`/dashboard/substitute/${tournament.slug}`}
        className="player-dash__action player-dash__action--edit player-dash__action--lead"
      >
        <DashboardActionIcon name="tournaments" />
        <span>Join substitute pool</span>
      </Link>
    );
  } else if (state.key === "registered") {
    action = (
      <Link to="/dashboard/history" className="player-dash__action player-dash__action--public">
        <span>View in history</span>
      </Link>
    );
  }

  return (
    <PlayerTournamentSeasonShell
      tournament={tournament}
      className={`player-dash__tourney-card player-dash__tourney-card--${state.tone}`}
    >
      <div className="season-card__identity player-dash__tourney-card-identity">
        <span className="season-card__badge" aria-hidden="true">
          {badge}
        </span>
        <div className="season-card__headline">
          <div className="season-card__title-row player-dash__tourney-card-head">
            <div className="player-dash__tourney-card-title-wrap">
              <h2 className="season-card__title player-dash__tourney-card-title">{displayLabel}</h2>
              {tournament.name !== displayLabel ? (
                <p className="player-dash__tourney-card-subtitle">{tournament.name}</p>
              ) : null}
              {dateRange ? <p className="season-card__tagline player-dash__tourney-card-dates">{dateRange}</p> : null}
            </div>
            <span className={`player-dash__tourney-badge player-dash__tourney-badge--${state.tone}`}>
              {state.label}
            </span>
          </div>
        </div>
      </div>

      <div className="season-card__stats player-dash__tourney-card-meta" aria-label={`${displayLabel} summary`}>
        <div className="season-card__stat player-dash__tourney-stat-chip">
          <span className="season-card__stat-label player-dash__tourney-stat-label">Entry fee</span>
          <span className="season-card__stat-value player-dash__tourney-stat-value">{formatEntryFee(tournament)}</span>
        </div>
        <div className="season-card__stat player-dash__tourney-stat-chip player-dash__tourney-stat-chip--prize">
          <span className="season-card__stat-label player-dash__tourney-stat-label">Prize pool</span>
          <span className="season-card__stat-value season-card__stat-value--prize player-dash__tourney-stat-value player-dash__tourney-stat-value--sm">
            {formatPrizePool(tournament)}
          </span>
        </div>
        <div className="season-card__stat player-dash__tourney-stat-chip">
          <span className="season-card__stat-label player-dash__tourney-stat-label">Registrations</span>
          <span className="season-card__stat-value player-dash__tourney-stat-value player-dash__tourney-stat-value--sm">
            {formatRegistrationSlots(tournament)}
          </span>
        </div>
      </div>

      {state.key === "open" ? (
        <p className="player-dash__tourney-card-hint">
          Confirm your profile details to register for this tournament.
        </p>
      ) : null}

      {substituteAvailable ? (
        <p className="player-dash__tourney-card-hint">
          Substitute sign-ups are open while the season is active and the roster cap has been reached.
        </p>
      ) : null}

      {action ? <div className="player-dash__tourney-card-actions">{action}</div> : null}
    </PlayerTournamentSeasonShell>
  );
}

export function PlayerTournamentsPage() {
  const { account } = useOutletContext();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    playerApi
      .upcomingTournaments()
      .then((r) => setTournaments(r.tournaments || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (!account) return null;

  const openCount = tournaments.filter((t) => t.registrationsOpen).length;
  const registeredCount = tournaments.filter((t) => t.registrationStatus === "approved").length;
  const substituteCount = tournaments.filter((t) => canJoinSubstitutePool(t, account)).length;

  return (
    <div className="player-dash__tournaments">
      <header className="player-dash__hero player-dash__hero--compact">
        <div className="player-dash__hero-main">
          <div className="player-dash__tourney-hero-icon" aria-hidden="true">
            <DashboardActionIcon name="tournaments" />
          </div>
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Season registration</p>
            <h1 className="player-dash__hero-title">Tournaments</h1>
            <p className="player-dash__hero-desc">
              Register when sign-ups are open. Substitute pool opens during the season once the roster limit is
              filled.
            </p>
          </div>
        </div>

        <div className="player-dash__hero-stats player-dash__hero-stats--tourney">
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Open</span>
            <span className="player-dash__stat-value-text">{openCount}</span>
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Registered</span>
            <span className="player-dash__stat-value-text">{registeredCount}</span>
          </div>
          <div className="player-dash__stat">
            <span className="player-dash__stat-label">Sub pool</span>
            <span className="player-dash__stat-value-text">{substituteCount}</span>
          </div>
        </div>
      </header>

      {!account.eligibleForRegistration ? (
        <section className="player-dash__eligibility-banner" aria-label="Registration requirements">
          <div className="player-dash__eligibility-copy">
            <p className="player-dash__eligibility-title">Complete account linkage to register</p>
            <p className="player-dash__eligibility-sub">
              Verify email and link Steam + Discord from your overview before registering.
            </p>
          </div>
          <Link to="/dashboard" className="player-dash__action player-dash__action--edit">
            <span>Go to overview</span>
          </Link>
        </section>
      ) : (
        <section className="player-setup player-setup--complete" aria-label="Registration eligibility">
          <p className="player-setup__complete-msg">You&apos;re eligible to register for open tournaments.</p>
        </section>
      )}

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {loading ? (
        <div className="player-dash__loading">
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Loading tournaments…</p>
        </div>
      ) : tournaments.length ? (
        <div className="player-dash__tourney-list" data-tour="tourney-list">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} account={account} />
          ))}
        </div>
      ) : (
        <section className="player-dash__card player-dash__tourney-empty">
          <h2 className="player-dash__card-title">No published tournaments</h2>
          <p className="player-dash__card-sub">
            Check back when the next season is announced on the public site.
          </p>
          <Link to="/" className="player-dash__action player-dash__action--public">
            <span>Back to site</span>
          </Link>
        </section>
      )}
    </div>
  );
}
