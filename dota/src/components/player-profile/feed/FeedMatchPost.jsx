import { Link } from "react-router-dom";
import { TeamLogoImg } from "../../TeamLogoImg.jsx";
import { teamLogoForName } from "../../../pages/player/dashboardTeamCard.js";
import { feedMatchStageClass, resolveFeedMatchStageVariant } from "../../../utils/feedMatchStageVariant.js";
import { getMatchDisplayScores } from "../../../utils/schedule.js";
import { resolveHeroDisplayName, resolveHeroImageUrls } from "../../../utils/dotaAssets.js";

function resolveMatchScores(row) {
  const normalizedScore =
    typeof row.score === "string" ? row.score.replace(/\s*[–—]\s*/g, "-").trim() : "";
  return getMatchDisplayScores({
    team1: row.team1,
    team2: row.team2,
    team1Score: row.team1Score,
    team2Score: row.team2Score,
    winner: row.winner,
    meta: {
      score: normalizedScore,
      team1Score: row.team1Score,
      team2Score: row.team2Score,
    },
  });
}

function teamMatchesName(teamName, rowTeam) {
  if (!teamName || !rowTeam) return false;
  return teamName.toLowerCase() === rowTeam.toLowerCase();
}

function appearanceNote(row) {
  if (row.playedAsSub) return "Substitute appearance";
  if (row.wasReplaced) return "Replaced before this match";
  return null;
}

function DotaGameRow({ game }) {
  if (!game) return null;
  const kda = `${game.kills}/${game.deaths}/${game.assists}`;
  const mins = game.duration ? Math.round(game.duration / 60) : null;
  const { portrait } = resolveHeroImageUrls(game);
  const heroLabel = resolveHeroDisplayName(game);
  return (
    <div
      className={`profile-feed__dota-game${game.won ? " profile-feed__dota-game--win" : " profile-feed__dota-game--loss"}`}
      title={heroLabel}
    >
      {portrait ? (
        <img src={portrait} alt="" className="profile-feed__hero-icon profile-feed__hero-icon--sm" loading="lazy" title={heroLabel} />
      ) : null}
      <div className="profile-feed__dota-game-copy">
        <span className="profile-feed__dota-game-hero">{heroLabel}</span>
        <span className="profile-feed__dota-game-kda">{kda}</span>
        {mins != null ? <span className="profile-feed__dota-game-meta">{mins}m</span> : null}
      </div>
      {game.dotabuffUrl ? (
        <a href={game.dotabuffUrl} className="profile-feed__dota-game-link" target="_blank" rel="noreferrer">
          Dotabuff
        </a>
      ) : null}
    </div>
  );
}

export function FeedMatchPost({ row, hideSeasonHeader = false, nested = false }) {
  const scores = resolveMatchScores(row);
  const dateLabel = row.startAt
    ? new Date(row.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const tone =
    row.won === true ? "profile-feed__match-post--win" : row.won === false ? "profile-feed__match-post--loss" : "";
  const stageVariant = resolveFeedMatchStageVariant(row);
  const stageClass = feedMatchStageClass(stageVariant);

  const playerOnTeam1 = teamMatchesName(row.team1, row.teamName);
  const playerOnTeam2 = teamMatchesName(row.team2, row.teamName);
  const team1Won = Boolean(scores.winner && row.team1 && scores.winner.toLowerCase() === row.team1.toLowerCase());
  const team2Won = Boolean(scores.winner && row.team2 && scores.winner.toLowerCase() === row.team2.toLowerCase());
  const footnote = appearanceNote(row);

  const metaParts = hideSeasonHeader ? [dateLabel].filter(Boolean) : [row.stageLabel, dateLabel].filter(Boolean);
  const stageBadge = row.stageLabel || "Match";

  return (
    <article
      className={`profile-feed__post profile-feed__match-post ${tone} ${stageClass}${
        nested ? " profile-feed__match-post--nested" : ""
      }`.trim()}
      data-stage={stageVariant}
    >
      <header className="profile-feed__match-head">
        <div className="profile-feed__match-head-row">
          <div className="profile-feed__match-head-meta">
            {row.stageLabel ? (
              <span className={`profile-feed__stage-pill profile-feed__stage-pill--${stageVariant}`}>
                {stageBadge}
              </span>
            ) : null}
            {metaParts.length ? <span className="profile-feed__match-date">{metaParts.join(" · ")}</span> : null}
          </div>
          <div
            className="profile-feed__match-result-slot"
            aria-label={
              row.won === true
                ? "Win"
                : row.won === false
                  ? "Loss"
                  : row.playedAsSub
                    ? "Substitute appearance"
                    : undefined
            }
          >
            {row.won === true ? (
              <span className="profile-feed__result profile-feed__result--win">W</span>
            ) : null}
            {row.won === false ? (
              <span className="profile-feed__result profile-feed__result--loss">L</span>
            ) : null}
            {row.playedAsSub ? <span className="profile-feed__result profile-feed__result--sub">Sub</span> : null}
          </div>
        </div>
        {!hideSeasonHeader ? (
          <>
            {row.seasonSlug ? (
              <Link to={`/seasons/${row.seasonSlug}`} className="profile-feed__match-season">
                {row.tournamentName || row.seasonSlug}
              </Link>
            ) : (
              <span className="profile-feed__match-season">{row.tournamentName || "Match"}</span>
            )}
          </>
        ) : null}
      </header>

      <div className="profile-feed__scoreboard">
        <div
          className={[
            "profile-feed__side",
            playerOnTeam1 ? "profile-feed__side--player" : "",
            team1Won ? "profile-feed__side--winner" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <TeamLogoImg
            src={teamLogoForName(row.team1)}
            alt=""
            width={40}
            height={40}
            className="profile-feed__team-logo"
          />
          <span className="profile-feed__side-name">{row.team1}</span>
          {scores.ready ? <span className="profile-feed__side-score">{scores.team1}</span> : null}
        </div>

        <div className="profile-feed__scoreboard-mid" aria-hidden="true">
          <span className="profile-feed__match-vs">vs</span>
        </div>

        <div
          className={[
            "profile-feed__side",
            "profile-feed__side--away",
            playerOnTeam2 ? "profile-feed__side--player" : "",
            team2Won ? "profile-feed__side--winner" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <TeamLogoImg
            src={teamLogoForName(row.team2)}
            alt=""
            width={40}
            height={40}
            className="profile-feed__team-logo"
          />
          <span className="profile-feed__side-name">{row.team2}</span>
          {scores.ready ? <span className="profile-feed__side-score">{scores.team2}</span> : null}
        </div>
      </div>

      {footnote ? <p className="profile-feed__match-footnote">{footnote}</p> : null}

      {row.dotaGames?.length ? (
        <div className="profile-feed__dota-games" aria-label="Dota game detail">
          {row.dotaGames.map((g) => (
            <DotaGameRow key={g.dotaMatchId} game={g} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
