import { Link } from "react-router-dom";
import { BpclCardRenderer } from "../cards/BpclCardRenderer.jsx";
import "../../styles/league-teams-page.css";

export function LeagueFranchiseRoster({ players = [], rosterPending = false, seasonNumber, className = "" }) {
  const rootClass = ["league-season__roster", className].filter(Boolean).join(" ");
  const ariaLabel = seasonNumber != null ? `Season ${seasonNumber} roster` : "Team roster";

  if (rosterPending) {
    return <p className="league-season__copy">Roster will appear here once the season roster is approved.</p>;
  }

  if (!players.length) {
    return <p className="league-season__copy">No roster data for this season.</p>;
  }

  return (
    <div className={rootClass} role="list" aria-label={ariaLabel}>
      {players.map((player) => (
        <div key={player.playerAccountId || player.bpcId || player.name} className="league-season__player" role="listitem">
          <div className="league-season__card-wrap">
            {player.card ? (
              <BpclCardRenderer manifest={player.card} size="sm" interactive={false} showMeta={false} showAura={true} />
            ) : (
              <div className="league-season__card-fallback" aria-hidden>
                <span>{(player.name || "?").slice(0, 2).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="league-season__player-meta">
            {player.slug ? (
              <Link to={`/player/${player.slug}`} className="league-season__player-name">
                {player.name}
              </Link>
            ) : (
              <span className="league-season__player-name league-season__player-name--plain">{player.name}</span>
            )}
            <span className="league-season__player-role">{player.role}</span>
            {player.isCaptain ? <span className="league-roster__cap">Captain</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
