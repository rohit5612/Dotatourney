import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { WinnersPodiumShowcase } from "./WinnersPodiumShowcase.jsx";
import { MvpShowcaseCard } from "./MvpShowcaseCard.jsx";
import { hasPublicHonorsContent, honorsSeasonTitle } from "../../utils/tournamentHonors.js";
import { TeamHonorBadge } from "./TournamentHonorsPanel.jsx";

export { TeamHonorBadge };

export function TournamentWinnersBlock({
  honors,
  teams,
  teamLookup,
  tournament,
  seasonTitle,
  variant = "full",
  showCustomCards = true,
  className = "",
}) {
  if (!hasPublicHonorsContent(honors)) return null;

  const podiumTeams = honors?.podiumTeams || [];
  const customCards = showCustomCards ? honors?.customCards || [] : [];
  const compact = variant === "compact";
  const landing = variant === "landing";
  const title = String(seasonTitle || "").trim() || honorsSeasonTitle(tournament);

  return (
    <section
      className={`tournament-winners ${compact ? "tournament-winners--compact" : ""} ${landing ? "tournament-winners--landing" : ""} ${className}`.trim()}
      aria-labelledby={landing ? "landing-winners-heading" : "tournament-winners-heading"}
    >
      <div className="tournament-winners__head">
        <p className="tournament-winners__eyebrow">Season champions</p>
        <h2 id={landing ? "landing-winners-heading" : "tournament-winners-heading"} className="tournament-winners__title">
          {title}
        </h2>
        {!compact ? (
          <p className="tournament-winners__subtitle">
            The squads who rose through the bracket and claimed their place in {SITE_BRAND_SHORT} history.
          </p>
        ) : null}
      </div>

      <WinnersPodiumShowcase
        podiumTeams={podiumTeams}
        teamLookup={teamLookup}
        variant={compact ? "compact" : "full"}
      />

      {honors?.mvp ? (
        <MvpShowcaseCard mvp={honors.mvp} teams={teams} teamLookup={teamLookup} variant={compact ? "compact" : "full"} />
      ) : null}

      {showCustomCards && customCards.length ? (
        <div className="tournament-winners__custom">
          {customCards.map((card) => (
            <article key={card.id} className="tournament-honor-card">
              <div className="tournament-honor-card__head">
                <p className="tournament-honor-card__title">{card.title || "Honor"}</p>
                {card.prize ? <p className="tournament-honor-card__prize">{card.prize}</p> : null}
              </div>
              <div className="tournament-honor-card__body">
                <p className="tournament-honor-card__winner">
                  {card.winnerLabel || card.playerName || card.teamName || "TBA"}
                </p>
                {card.teamName && card.playerName ? (
                  <p className="tournament-honor-card__team">
                    {[card.playerName, card.teamName].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {card.notes ? <p className="tournament-honor-card__notes">{card.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** @deprecated use TournamentWinnersBlock */
export function TournamentHonorsSection(props) {
  return <TournamentWinnersBlock {...props} />;
}

export function ChampionStrip({ honors, teamLookup, tournament, seasonTitle }) {
  return (
    <TournamentWinnersBlock
      honors={honors}
      teams={undefined}
      teamLookup={teamLookup}
      tournament={tournament}
      seasonTitle={seasonTitle}
      variant="compact"
      showCustomCards={false}
      className="teams-page-winners"
    />
  );
}
