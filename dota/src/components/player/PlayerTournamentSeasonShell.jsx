import { resolveTournamentCardPresentation } from "../../utils/seasonPayload.js";

/**
 * Reuses public /seasons card layers: blurred bg art, scrim, liquid glass shell.
 */
export function PlayerTournamentSeasonShell({ tournament, className = "", children }) {
  const { cardBg } = resolveTournamentCardPresentation(tournament);
  const shellClass = [
    "player-tourney-season",
    "season-card",
    "season-card--liquid",
    "season-glass",
    cardBg ? "season-card--has-bg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const style = cardBg ? { "--season-card-bg": `url(${JSON.stringify(cardBg)})` } : undefined;

  return (
    <div className={shellClass} style={style}>
      {cardBg ? <div className="season-card__bg" aria-hidden="true" /> : null}
      <div className="season-card__scrim" aria-hidden="true" />
      <div className="player-tourney-season__content">{children}</div>
    </div>
  );
}
