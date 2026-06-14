import { Link } from "react-router-dom";
import { PlayerTournamentSeasonShell } from "./PlayerTournamentSeasonShell.jsx";
import { resolveTournamentCardPresentation } from "../../utils/seasonPayload.js";

export function SubstitutePoolHero({ tournament, account }) {
  const { badge, displayLabel } = resolveTournamentCardPresentation(tournament);

  return (
    <PlayerTournamentSeasonShell tournament={tournament} className="player-reg__season-hero">
      <div className="season-card__identity player-reg__season-hero-identity">
        <span className="season-card__badge" aria-hidden="true">
          {badge}
        </span>
        <div className="season-card__headline">
          <p className="player-dash__hero-eyebrow">Substitute pool</p>
          <h1 className="season-card__title player-dash__hero-title">{displayLabel}</h1>
          {tournament?.name && tournament.name !== displayLabel ? (
            <p className="season-card__tagline player-reg__season-hero-subtitle">{tournament.name}</p>
          ) : null}
          <div className="player-dash__hero-meta">
            {account?.bpcId ? <span className="player-dash__badge">{account.bpcId}</span> : null}
            <span className="player-dash__hero-chip">No entry fee</span>
          </div>
          <p className="player-dash__hero-desc">
            The main roster is full. Confirm your player details below — admins use this info when assigning
            substitutes.
          </p>
        </div>
      </div>

      <div className="player-dash__hero-actions player-reg__season-hero-actions">
        <Link to="/dashboard/tournaments" className="player-dash__action player-dash__action--public">
          <span>All tournaments</span>
        </Link>
      </div>
    </PlayerTournamentSeasonShell>
  );
}
