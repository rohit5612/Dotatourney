import { useMemo, useState } from "react";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { MatchRosterCompact } from "./MatchRosterCompact.jsx";
import { SubstituteRequestModal } from "./SubstituteRequestModal.jsx";
import { playerApi } from "../../lib/playerApi";
import { teamLogoForName } from "../../pages/player/dashboardTeamCard.js";

function MatchTeamFace({ name }) {
  const logo = teamLogoForName(name);
  const initial = String(name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="player-match-card__team">
      {logo ? (
        <TeamLogoImg src={logo} alt="" className="player-match-card__team-logo" width={40} height={40} />
      ) : (
        <span className="player-match-card__team-logo player-match-card__team-logo--fallback" aria-hidden="true">
          {initial}
        </span>
      )}
      <span className="player-match-card__team-name">{name}</span>
    </div>
  );
}

function MatchCard({ match, onRefresh }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [rostersOpen, setRostersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const hasLineups =
    Boolean(match.lineups?.team1?.players?.length) || Boolean(match.lineups?.team2?.players?.length);

  async function submitRequest(reason) {
    setBusy(true);
    try {
      await playerApi.createSubstitutionRequest(match.id, reason);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function rescind() {
    setActionError("");
    setBusy(true);
    try {
      await playerApi.cancelSubstitutionRequest(match.id);
      await onRefresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const req = match.substitutionRequest;

  return (
    <article className="player-match-card">
      <header className="player-match-card__head">
        <div className="player-match-card__head-main">
          <p className="player-match-card__stage">{match.stageLabel || match.stageKey || "Match"}</p>
          <div className="player-match-card__matchup">
            <MatchTeamFace name={match.team1} />
            <span className="player-dash__match-vs">vs</span>
            <MatchTeamFace name={match.team2} />
          </div>
          <p className="player-match-card__meta">
            {match.startAt ? new Date(match.startAt).toLocaleString() : "Time TBA"}
            {match.stream ? ` · ${match.stream}` : ""}
          </p>
        </div>
        {match.scheduleStatus || match.status ? (
          <span className="player-dash__match-banner-badge">{match.scheduleStatus || match.status}</span>
        ) : null}
      </header>

      {hasLineups ? (
        <div className="player-match-card__expand-row">
          <button
            type="button"
            className="player-match-card__expand"
            onClick={() => setRostersOpen((open) => !open)}
            aria-expanded={rostersOpen}
          >
            {rostersOpen ? "Hide rosters" : "Show rosters"}
          </button>
        </div>
      ) : null}

      {rostersOpen ? (
        <div className="player-match-card__rosters">
          <MatchRosterCompact lineups={match.lineups} />
        </div>
      ) : null}

      {actionError ? <div className="player-auth__message player-auth__message--error">{actionError}</div> : null}

      <footer className="player-match-card__foot">
        {req ? (
          <div className="player-match-card__request">
            <span className={`player-dash__tourney-badge player-dash__tourney-badge--${req.status === "approved" ? "success" : "warm"}`}>
              Sub request: {req.status}
            </span>
            {req.status === "pending" ? (
              <button
                type="button"
                className="player-dash__action player-dash__action--edit player-dash__action--compact"
                onClick={rescind}
                disabled={busy || !req.canCancel}
                title={
                  req.canCancel
                    ? "Cancel substitution request"
                    : "Cannot cancel within 4 hours of match start"
                }
              >
                Rescind
              </button>
            ) : null}
          </div>
        ) : match.canRequestSubstitution ? (
          <button
            type="button"
            className="player-dash__action player-dash__action--tournaments player-dash__action--compact"
            onClick={() => setModalOpen(true)}
          >
            Request substitute
          </button>
        ) : null}
      </footer>

      <SubstituteRequestModal
        open={modalOpen}
        match={match}
        onClose={() => setModalOpen(false)}
        onSubmit={submitRequest}
        busy={busy}
      />
    </article>
  );
}

export function MatchesSchedulePanel({ schedule, onRefresh }) {
  const [tab, setTab] = useState("upcoming");

  const items = useMemo(() => {
    if (tab === "past") return schedule?.past || [];
    return schedule?.upcoming || [];
  }, [schedule, tab]);

  const upcomingCount = schedule?.upcoming?.length ?? 0;
  const pastCount = schedule?.past?.length ?? 0;

  return (
    <section
      className="player-dash__card player-dash__overview-panel player-dash__matches-panel"
      data-tour="matches-panel"
    >
      <header className="player-dash__card-head player-dash__card-head--compact">
        <div>
          <h2 className="player-dash__card-title">Matches</h2>
          <p className="player-dash__card-sub">Upcoming and past matches for your team</p>
        </div>
        <div className="player-match-tabs" role="tablist" aria-label="Match filter">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            className={`player-match-tabs__btn${tab === "upcoming" ? " is-active" : ""}`}
            onClick={() => setTab("upcoming")}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={`player-match-tabs__btn${tab === "past" ? " is-active" : ""}`}
            onClick={() => setTab("past")}
          >
            Past ({pastCount})
          </button>
        </div>
      </header>

      <div className="player-dash__overview-panel-body player-dash__matches-body">
        {items.length ? (
          <div className="player-match-list">
            {items.map((match) => (
              <MatchCard key={match.id} match={match} onRefresh={onRefresh} />
            ))}
          </div>
        ) : (
          <div className="player-dash__empty player-dash__overview-panel-empty">
            <p>{tab === "upcoming" ? "No upcoming matches scheduled yet." : "No past matches on record."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
