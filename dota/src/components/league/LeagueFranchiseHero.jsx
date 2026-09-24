import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBookOpen,
  HiOutlineCalendarDays,
  HiOutlineMegaphone,
  HiOutlineShieldCheck,
  HiOutlineSignal,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi2";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { SITE_BRAND_FULL } from "../../constants/siteMeta.js";
import { BRACKET_FINISH_LABELS, seasonFinishLabel } from "../../utils/leagueSeasonLabels.js";
import "../../styles/league-teams-page.css";
import "../../styles/seasons-page.css";

function finishTone(finish, isLive) {
  if (isLive) {
    return { tone: "live", label: finish };
  }
  switch (finish) {
    case BRACKET_FINISH_LABELS.champion:
      return { tone: "champion", label: finish };
    case BRACKET_FINISH_LABELS.runnerUp:
      return { tone: "silver", label: finish };
    case BRACKET_FINISH_LABELS.semiFinalist:
    case BRACKET_FINISH_LABELS.quarterFinalist:
      return { tone: "bracket", label: finish };
    case BRACKET_FINISH_LABELS.playInCrossover:
    case BRACKET_FINISH_LABELS.playIn:
      return { tone: "playin", label: finish };
    case BRACKET_FINISH_LABELS.lastChance:
      return { tone: "lc", label: finish };
    default:
      return { tone: "default", label: finish };
  }
}

function splitSentences(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  const parts = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  return parts ? parts.map((part) => part.trim()).filter(Boolean) : [trimmed];
}

function loreHookLine(paragraphs) {
  if (!paragraphs.length) return "";
  const first = splitSentences(paragraphs[0]);
  if (first[0]) return first[0];
  return paragraphs[0].length > 140 ? `${paragraphs[0].slice(0, 137).trim()}…` : paragraphs[0];
}

function loreAsThreeParagraphs(lore) {
  const blocks = String(lore || "")
    .trim()
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!blocks.length) return [];

  if (blocks.length >= 3) {
    return blocks.slice(0, 3);
  }

  if (blocks.length === 2) {
    const secondSentences = splitSentences(blocks[1]);
    if (secondSentences.length >= 2) {
      const mid = Math.ceil(secondSentences.length / 2);
      return [
        blocks[0],
        secondSentences.slice(0, mid).join(" "),
        secondSentences.slice(mid).join(" "),
      ];
    }
    return [blocks[0], blocks[1]];
  }

  const sentences = splitSentences(blocks[0]);
  if (sentences.length <= 3) {
    return sentences.length ? sentences : [blocks[0]];
  }
  const per = Math.ceil(sentences.length / 3);
  return [0, 1, 2]
    .map((index) => sentences.slice(index * per, (index + 1) * per).join(" "))
    .filter(Boolean);
}

function statusLabel(status) {
  const value = String(status || "active").toLowerCase();
  if (value === "dormant") return "Reserved";
  if (value === "retired") return "Retired";
  return "Active";
}

export function LeagueFranchiseHero({
  team,
  appearanceSeasons = [],
  placementRows = [],
  championshipCount = 0,
}) {
  const status = statusLabel(team.status);
  const isActiveStatus = status === "Active";
  const loreParagraphs = loreAsThreeParagraphs(team.lore);
  const loreHook = loreHookLine(loreParagraphs);
  const hasLore = loreParagraphs.length > 0;
  const hasHistory = appearanceSeasons.length > 0 || placementRows.length > 0;
  const [loreExpanded, setLoreExpanded] = useState(false);
  const loreCanExpand =
    loreParagraphs.length > 1 ||
    (loreParagraphs[0]?.length ?? 0) > 96;

  useEffect(() => {
    setLoreExpanded(false);
  }, [team?.slug, team?.id]);

  return (
    <section
      className="franchise-showcase franchise-showcase--deck"
      aria-labelledby="franchise-showcase-title"
    >
      <div className="franchise-deck">
        <header className="franchise-deck__spotlight">
          <p className="franchise-deck__eyebrow">
            <HiOutlineUserGroup aria-hidden />
            <span>{SITE_BRAND_FULL} Franchise</span>
          </p>

          <div className="franchise-deck__masthead">
            <div className="franchise-deck__mark">
              <div className="franchise-showcase__crest franchise-deck__crest">
                <span className="franchise-showcase__crest-glow" />
                <div className="franchise-showcase__crest-logo franchise-showcase__crest-logo--sweep">
                  {team.logoUrl ? (
                    <TeamLogoImg
                      src={team.logoUrl}
                      alt=""
                      width={200}
                      height={200}
                      loading="eager"
                      fetchPriority="high"
                    />
                  ) : (
                    <span className="franchise-showcase__crest-initials">{team.abbr}</span>
                  )}
                </div>
                <span className="franchise-showcase__crest-badge">
                  <HiOutlineShieldCheck aria-hidden />
                </span>
              </div>
            </div>

            <div className="franchise-deck__identity">
              <h1 id="franchise-showcase-title" className="franchise-deck__title">{team.name}</h1>

              {team.tagline ? (
                <p className="franchise-deck__tagline">
                  <HiOutlineMegaphone className="franchise-deck__tagline-icon" aria-hidden />
                  <span>{team.tagline}</span>
                </p>
              ) : null}

              {(team.foundedSeasonNumber || team.aliases?.length) ? (
                <ul className="franchise-deck__pills">
                  {team.foundedSeasonNumber ? (
                    <li>
                      <HiOutlineCalendarDays aria-hidden />
                      <span>Since Season {team.foundedSeasonNumber}</span>
                    </li>
                  ) : null}
                  {team.aliases?.length ? (
                    <li>
                      <HiOutlineSparkles aria-hidden />
                      <span>{team.aliases.map((a) => a.alias).join(", ")}</span>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </div>
        </header>

        <div className="franchise-deck__ribbon" role="list" aria-label="Franchise summary">
          <div className="franchise-deck__ribbon-cell" role="listitem">
            <span className="franchise-deck__ribbon-value">{appearanceSeasons.length || "—"}</span>
            <span className="franchise-deck__ribbon-label">Season appearances</span>
          </div>
          <div className="franchise-deck__ribbon-cell franchise-deck__ribbon-cell--gold" role="listitem">
            <span className="franchise-deck__ribbon-value">{championshipCount}</span>
            <span className="franchise-deck__ribbon-label">Titles won</span>
          </div>
          <div
            className={[
              "franchise-deck__ribbon-cell",
              isActiveStatus ? "franchise-deck__ribbon-cell--live" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="listitem"
          >
            <span className="franchise-deck__ribbon-value">
              <HiOutlineSignal className="franchise-deck__ribbon-status-icon" aria-hidden />
              {status}
            </span>
            <span className="franchise-deck__ribbon-label">Franchise status</span>
          </div>
        </div>

        {hasHistory ? (
          <div className="franchise-deck__history">
            {appearanceSeasons.length ? (
              <section className="franchise-deck__history-block" aria-labelledby="franchise-deck-trail-title">
                <h2 id="franchise-deck-trail-title" className="franchise-deck__history-title">Season trail</h2>
                <ol className="franchise-deck__chip-trail" aria-label="Season appearances">
                  {appearanceSeasons.map((num, index) => (
                    <li key={num} className="franchise-deck__chip-trail-item">
                      <span className="franchise-deck__chip">S{num}</span>
                      {index < appearanceSeasons.length - 1 ? (
                        <span className="franchise-deck__chip-join" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {placementRows.length ? (
              <section className="franchise-deck__history-block" aria-labelledby="franchise-deck-finishes-title">
                <h2 id="franchise-deck-finishes-title" className="franchise-deck__history-title">Bracket finishes</h2>
                <ul className="franchise-deck__results">
                  {placementRows.map((season) => {
                    const finish = seasonFinishLabel(season);
                    const isLive = season.seasonStatus === "active";
                    const visual = finishTone(finish, isLive);
                    const badge =
                      season.seasonNumber != null && Number.isFinite(Number(season.seasonNumber))
                        ? `S${season.seasonNumber}`
                        : "S";
                    return (
                      <li
                        key={season.seasonId}
                        className={[
                          "franchise-deck__result",
                          `franchise-deck__result--${visual.tone}`,
                        ].join(" ")}
                      >
                        <span className="season-card__badge franchise-deck__result-badge" aria-hidden="true">
                          {badge}
                        </span>
                        <div className="franchise-deck__result-copy">
                          <span className="franchise-deck__result-label">{visual.label}</span>
                          {isLive ? (
                            <span className="franchise-deck__result-live">In progress</span>
                          ) : null}
                        </div>
                        {season.seasonSlug ? (
                          <Link to={`/seasons/${season.seasonSlug}`} className="franchise-deck__result-link">
                            Season
                          </Link>
                        ) : (
                          <span className="franchise-deck__result-link franchise-deck__result-link--muted" aria-hidden>
                            —
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {hasLore ? (
          <section
            className={[
              "franchise-lore-saga",
              loreExpanded ? "franchise-lore-saga--expanded" : "franchise-lore-saga--collapsed",
            ].join(" ")}
            aria-labelledby="franchise-lore-saga-title"
          >
            <div className="franchise-lore-saga__atmosphere" aria-hidden>
              <span className="franchise-lore-saga__glow franchise-lore-saga__glow--a" />
              <span className="franchise-lore-saga__glow franchise-lore-saga__glow--b" />
              <span className="franchise-lore-saga__grain" />
              <span className="franchise-lore-saga__edge franchise-lore-saga__edge--top" />
              <span className="franchise-lore-saga__edge franchise-lore-saga__edge--bottom" />
            </div>

            <header className="franchise-lore-saga__head">
              <span className="franchise-lore-saga__icon" aria-hidden>
                <HiOutlineBookOpen />
              </span>
              <div className="franchise-lore-saga__head-copy">
                <p className="franchise-lore-saga__kicker">The chronicle</p>
                <h2 id="franchise-lore-saga-title" className="franchise-lore-saga__title">
                  Franchise lore
                </h2>
              </div>
            </header>

            {loreHook ? (
              <figure className="franchise-lore-saga__hook">
                <span className="franchise-lore-saga__quote-mark" aria-hidden>&ldquo;</span>
                <blockquote className="franchise-lore-saga__hook-text">{loreHook}</blockquote>
                <figcaption className="franchise-lore-saga__hook-caption">
                  <span className="franchise-lore-saga__hook-rule" aria-hidden />
                  <span>From the {team.name} archives</span>
                </figcaption>
              </figure>
            ) : null}

            <div id="franchise-lore-saga-chapters" className="franchise-lore-saga__chapters">
              {loreParagraphs.map((paragraph, index) => (
                <p key={index} className="franchise-lore-saga__chapter-body">{paragraph}</p>
              ))}
            </div>

            {loreCanExpand ? (
              <div className="franchise-lore-saga__toggle">
                <button
                  type="button"
                  className="franchise-lore-saga__toggle-btn"
                  aria-expanded={loreExpanded}
                  aria-controls="franchise-lore-saga-chapters"
                  onClick={() => setLoreExpanded((open) => !open)}
                >
                  {loreExpanded ? (
                    <>
                      <span>Read less</span>
                      <HiOutlineChevronUp aria-hidden />
                    </>
                  ) : (
                    <>
                      <span>Read more</span>
                      <HiOutlineChevronDown aria-hidden />
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
