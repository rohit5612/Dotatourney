function roleLabel(roles) {
  if (!roles?.length) return null;
  return Array.isArray(roles) ? roles.join(", ") : String(roles);
}

function PlayerRow({ player }) {
  const initial = (player.displayName || "?")[0].toUpperCase();
  const roles = roleLabel(player.roles);

  return (
    <li className={`player-match-roster__player${player.isSubstitute ? " player-match-roster__player--sub" : ""}`}>
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt="" className="player-match-roster__avatar" />
      ) : (
        <span className="player-match-roster__avatar player-match-roster__avatar--fallback" aria-hidden="true">
          {initial}
        </span>
      )}
      <div className="player-match-roster__player-copy">
        <span className="player-match-roster__name">{player.displayName}</span>
        {roles || player.mmr != null ? (
          <span className="player-match-roster__meta">
            {[roles, player.mmr != null ? `${player.mmr} MMR` : null].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {player.isSubstitute && player.replacesDisplayName ? (
          <span className="player-match-roster__sub-for">Sub for {player.replacesDisplayName}</span>
        ) : null}
      </div>
      {player.isSubstitute ? <span className="player-match-roster__sub-badge">SUB</span> : null}
    </li>
  );
}

export function MatchRosterCompact({ lineups }) {
  if (!lineups?.team1?.players?.length && !lineups?.team2?.players?.length) {
    return <p className="player-match-roster__empty">Lineup not available yet.</p>;
  }

  return (
    <div className="player-match-roster">
      {["team1", "team2"].map((side) => {
        const team = lineups[side];
        if (!team?.name) return null;
        return (
          <div key={side} className="player-match-roster__team">
            <p className="player-match-roster__team-name">{team.name}</p>
            <ul className="player-match-roster__list">
              {team.players?.length ? (
                team.players.map((player) => (
                  <PlayerRow key={`${player.playerAccountId}-${player.displayName}`} player={player} />
                ))
              ) : (
                <li className="player-match-roster__empty">No players listed</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
