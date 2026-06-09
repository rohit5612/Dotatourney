import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { playerApi } from "../../lib/playerApi";
import {
  canJoinSubstitutePool,
  formatEntryFee,
  formatPrizePool,
  formatRegistrationSlots,
  isTournamentInSeasonWindow,
} from "./tournamentDisplay.js";

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

function getTournamentState(tournament, account) {
  const status = (tournament.registrationStatus || "").toLowerCase();
  const substituteAvailable = canJoinSubstitutePool(tournament, account);

  if (status === "approved") {
    return { key: "registered", label: "Registered", tone: "success" };
  }
  if (status === "pending") {
    return { key: "pending", label: "Awaiting approval", tone: "warm" };
  }
  if (status === "rejected") {
    return { key: "rejected", label: "Not approved", tone: "danger" };
  }
  if (status) {
    return { key: "in-progress", label: status, tone: "warm" };
  }
  if (tournament.registrationsOpen && account?.eligibleForRegistration) {
    return { key: "open", label: "Registrations open", tone: "open" };
  }
  if (tournament.registrationsOpen) {
    return { key: "locked", label: "Open — linkage required", tone: "locked" };
  }
  if (substituteAvailable) {
    return { key: "substitute", label: "Substitute pool open", tone: "secondary" };
  }
  if (isTournamentInSeasonWindow(tournament)) {
    return { key: "active", label: "Season in progress", tone: "muted" };
  }
  return { key: "closed", label: "Registration closed", tone: "muted" };
}

function TournamentSubstituteForm({ slug }) {
  const [form, setForm] = useState({ mmr: 3000, availability: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await playerApi.substituteSignup(slug, form);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="player-dash__tourney-note player-dash__tourney-note--ok">
        Substitute signup received. Admins will reach out if a roster spot opens.
      </p>
    );
  }

  return (
    <form className="player-dash__substitute-form" onSubmit={onSubmit}>
      <p className="player-dash__substitute-intro">
        Roster is full for this season window. Join the substitute pool — no entry fee required.
      </p>
      <div className="player-dash__substitute-fields">
        <div className="player-auth__field">
          <label htmlFor={`sub-mmr-${slug}`}>MMR</label>
          <input
            id={`sub-mmr-${slug}`}
            type="number"
            value={form.mmr}
            onChange={(e) => setForm((f) => ({ ...f, mmr: Number(e.target.value) }))}
          />
        </div>
        <div className="player-auth__field">
          <label htmlFor={`sub-avail-${slug}`}>Availability</label>
          <input
            id={`sub-avail-${slug}`}
            value={form.availability}
            onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
            placeholder="e.g. Weeknights after 8pm IST"
          />
        </div>
        <div className="player-auth__field player-dash__substitute-notes">
          <label htmlFor={`sub-notes-${slug}`}>Notes</label>
          <textarea
            id={`sub-notes-${slug}`}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Roles, experience, anything admins should know"
          />
        </div>
      </div>
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      <button type="submit" className="player-dash__action player-dash__action--edit" disabled={busy}>
        Join substitute pool
      </button>
    </form>
  );
}

function TournamentCard({ tournament, account }) {
  const [showSubstitute, setShowSubstitute] = useState(false);
  const state = getTournamentState(tournament, account);
  const dateRange = formatDateRange(tournament.startDate, tournament.endDate);
  const substituteAvailable = state.key === "substitute";

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
      <button
        type="button"
        className="player-dash__action player-dash__action--edit"
        onClick={() => setShowSubstitute((v) => !v)}
      >
        <span>{showSubstitute ? "Hide substitute form" : "Join substitute pool"}</span>
      </button>
    );
  } else if (state.key === "registered") {
    action = (
      <Link to="/dashboard/history" className="player-dash__action player-dash__action--public">
        <span>View in history</span>
      </Link>
    );
  }

  return (
    <article className={`player-dash__tourney-card player-dash__tourney-card--${state.tone}`}>
      <header className="player-dash__tourney-card-head">
        <div className="player-dash__tourney-card-title-wrap">
          <h2 className="player-dash__tourney-card-title">{tournament.name}</h2>
          {dateRange ? <p className="player-dash__tourney-card-dates">{dateRange}</p> : null}
        </div>
        <span className={`player-dash__tourney-badge player-dash__tourney-badge--${state.tone}`}>
          {state.label}
        </span>
      </header>

      <div className="player-dash__tourney-card-meta">
        <div className="player-dash__tourney-stat-chip">
          <span className="player-dash__tourney-stat-label">Entry fee</span>
          <span className="player-dash__tourney-stat-value">{formatEntryFee(tournament)}</span>
        </div>
        <div className="player-dash__tourney-stat-chip player-dash__tourney-stat-chip--prize">
          <span className="player-dash__tourney-stat-label">Prize pool</span>
          <span className="player-dash__tourney-stat-value player-dash__tourney-stat-value--sm">
            {formatPrizePool(tournament)}
          </span>
        </div>
        <div className="player-dash__tourney-stat-chip">
          <span className="player-dash__tourney-stat-label">Registrations</span>
          <span className="player-dash__tourney-stat-value player-dash__tourney-stat-value--sm">
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

      {substituteAvailable && showSubstitute ? <TournamentSubstituteForm slug={tournament.slug} /> : null}
    </article>
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
        <p className="player-dash__tourney-ready-note player-dash__tourney-note--ok">
          You&apos;re eligible to register for open tournaments.
        </p>
      )}

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {loading ? (
        <div className="player-dash__loading">
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Loading tournaments…</p>
        </div>
      ) : tournaments.length ? (
        <div className="player-dash__tourney-list">
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
