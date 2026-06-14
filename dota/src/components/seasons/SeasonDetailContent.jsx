import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineChevronLeft } from "react-icons/hi2";
import { TournamentWinnersBlock } from "../honors/TournamentWinnersBlock.jsx";
import { StandingsTable } from "../StandingsTable.jsx";
import { TeamCard } from "../teams/TeamCard.jsx";
import { SponsorCard } from "../SponsorCard.jsx";
import { PageLoadingSpinner } from "../PageLoadingSpinner.jsx";
import { getSponsorsForDisplay, DEFAULT_SPONSORS_SECTION } from "../../utils/seasonContentSchema.js";
import {
  enrichTeam,
  orderTeamsForTeamsPage,
} from "../../utils/teamPage.js";
import { augmentGroupedBracketMatches, normalizedBlastBracketTabs } from "../bracket/bracketLayout.js";
import { BracketStageTabs } from "../navigation/TournamentTabs.jsx";
import { resolveBracketTabs } from "../../utils/engineBracketTabs.js";
import { resolveBracketViewSections } from "../../utils/engineStages.js";
import {
  formatSeasonDateRange,
  formatSeasonListDate,
  formatSeasonStatValue,
  formatSeasonStatusUpper,
  formatTournamentFormat,
  prizePlacementLabel,
  resolveSeasonCardBg,
  resolveSeasonDisplayStatus,
  resolveSeasonTagline,
  seasonBadgeShort,
  seasonDisplayLabel,
  seasonFullTitle,
  summarizeBracketStages,
} from "../../utils/seasonPayload.js";
import "../../styles/teams-page.css";
import "../../styles/team-logo-img.css";

const BracketDiagram = lazy(() =>
  import("../BracketDiagram.jsx").then((module) => ({ default: module.BracketDiagram })),
);

function SeasonTabPanel({ id, labelledBy, active, children }) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      className={`season-detail__panel${active ? " season-detail__panel--active" : ""}`}
    >
      {active ? children : null}
    </div>
  );
}

function SeasonPanelCard({ children, className = "" }) {
  return <div className={`season-detail__panel-card season-glass${className ? ` ${className}` : ""}`}>{children}</div>;
}

function SeasonHero({ payload }) {
  const { season, tournament, trophy, championName } = payload;
  const label = seasonDisplayLabel(season);
  const fullTitle = seasonFullTitle(season);
  const badge = seasonBadgeShort(season);
  const summary = {
    startDate: tournament?.start_date,
    endDate: tournament?.end_date,
    isPublished: Boolean(tournament?.is_published),
    tournamentStatus: tournament?.status,
    playerCount: payload.participations.length,
    teamCount: payload.teams.length,
  };
  const displayStatus = resolveSeasonDisplayStatus(season, summary);
  const status = displayStatus;
  const cardBg = resolveSeasonCardBg(season.heroMedia, season.tournamentCardBg || tournament?.season_card_bg);
  const tagline = resolveSeasonTagline(season, summary, championName, displayStatus);
  const playerCount = payload.participations.length;

  const heroClass = [
    "season-detail__hero",
    cardBg ? "season-detail__hero--has-bg" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const heroStyle = cardBg ? { "--season-card-bg": `url("${cardBg}")` } : undefined;

  return (
    <section className={heroClass} style={heroStyle}>
      {cardBg ? <div className="season-detail__hero-bg" aria-hidden="true" /> : null}
      <div className="season-detail__hero-scrim" aria-hidden="true" />

      <div className="season-detail__hero-inner">
        <Link to="/seasons" className="season-detail__back season-glass">
          <span className="season-detail__back-icon" aria-hidden="true">
            <HiOutlineChevronLeft />
          </span>
          <span className="season-detail__back-label">All seasons</span>
        </Link>

        <div className="season-detail__hero-head">
          <span className="season-detail__hero-badge">{badge}</span>
          <div className="season-detail__hero-title-row">
            <h1 className="season-detail__hero-title">{fullTitle}</h1>
            {label !== fullTitle ? <p className="season-detail__hero-subtitle">{label}</p> : null}
            <span className={`season-detail__hero-status season-detail__hero-status--${status}`}>
              {formatSeasonStatusUpper(status)}
            </span>
          </div>
          <p className="season-detail__hero-tagline">{tagline}</p>
        </div>

        <div className="season-detail__hero-bar season-glass season-glass--strong">
          <div className="season-detail__hero-stat">
            <span className="season-detail__hero-stat-label">Prize pool</span>
            <span className="season-detail__hero-stat-value season-detail__hero-stat-value--prize">
              {formatSeasonStatValue(payload.prizePool, "TBA")}
            </span>
          </div>
          <div className="season-detail__hero-stat">
            <span className="season-detail__hero-stat-label">Format</span>
            <span className="season-detail__hero-stat-value">{formatTournamentFormat(tournament?.format)}</span>
          </div>
          <div className="season-detail__hero-stat">
            <span className="season-detail__hero-stat-label">Event dates</span>
            <span className="season-detail__hero-stat-value">
              {formatSeasonListDate(tournament?.start_date, tournament?.end_date)}
            </span>
          </div>
          <div className="season-detail__hero-stat">
            <span className="season-detail__hero-stat-label">Players</span>
            <span className="season-detail__hero-stat-value">
              {playerCount > 0 ? playerCount : formatSeasonStatValue(payload.teams.length ? `${payload.teams.length} teams` : null)}
            </span>
          </div>
        </div>

        {championName ? (
          <div className="season-detail__hero-champion">
            <span className="season-detail__hero-champion-label">Champions</span>
            <span className="season-detail__hero-champion-name">{championName}</span>
            {trophy?.mvpLabel ? <span className="season-detail__hero-mvp">MVP · {trophy.mvpLabel}</span> : null}
          </div>
        ) : null}

        {displayStatus === "active" ? (
          <Link to="/tournament" className="season-detail__cta">
            Open live tournament hub →
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function SeasonOverviewTab({ payload }) {
  const { tournament, championName, trophy } = payload;

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Overview</h2>
      {tournament?.description ? (
        <p className="season-detail__panel-lead">{tournament.description}</p>
      ) : (
        <p className="season-detail__panel-lead season-detail__muted">
          Full season archive for {seasonDisplayLabel(payload.season)} — standings, rosters, honors, and bracket
          structure.
        </p>
      )}

      <div className="season-detail__overview-grid">
        <div className="season-detail__overview-item">
          <span className="season-detail__overview-label">Format</span>
          <span className="season-detail__overview-value">{formatTournamentFormat(tournament?.format)}</span>
        </div>
        <div className="season-detail__overview-item">
          <span className="season-detail__overview-label">Teams</span>
          <span className="season-detail__overview-value">{payload.teams.length || tournament?.team_count || "—"}</span>
        </div>
        <div className="season-detail__overview-item">
          <span className="season-detail__overview-label">Matches</span>
          <span className="season-detail__overview-value">{payload.matches.length || "—"}</span>
        </div>
        <div className="season-detail__overview-item">
          <span className="season-detail__overview-label">Dates</span>
          <span className="season-detail__overview-value">
            {formatSeasonDateRange(tournament?.start_date, tournament?.end_date)}
          </span>
        </div>
      </div>

      {championName ? (
        <div className="season-detail__overview-champion season-glass">
          <span className="season-detail__overview-label">Season champions</span>
          <span className="season-detail__overview-champion-name">{championName}</span>
          {trophy?.mvpLabel ? <span className="season-detail__muted">MVP · {trophy.mvpLabel}</span> : null}
        </div>
      ) : null}
    </SeasonPanelCard>
  );
}

function SeasonStandingsTab({ payload }) {
  if (!payload.groupedStandings?.length && !payload.standings.length) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">Standings will appear once group or league tables are available.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Standings</h2>
      <p className="season-detail__panel-lead">Group and league tables from this season.</p>
      <div className="season-detail__standings-grid">
        {payload.groupedStandings?.length
          ? payload.groupedStandings.map((group) => (
              <StandingsTable
                key={group.id || group.label}
                title={group.label}
                rows={group.rows}
                variant="public"
                teamLookup={payload.teamLookup}
              />
            ))
          : (
              <StandingsTable
                title="Season standings"
                rows={payload.standings}
                variant="public"
                teamLookup={payload.teamLookup}
              />
            )}
      </div>
    </SeasonPanelCard>
  );
}

function SeasonTeamsTab({ teams }) {
  if (!teams.length) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">No teams recorded for this season yet.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Teams</h2>
      <p className="season-detail__panel-lead">Every squad that competed this season.</p>
      <div className="season-detail__teams-grid">
        {teams.map((team, index) => (
          <TeamCard key={team.id || team.name} team={team} index={index} />
        ))}
      </div>
    </SeasonPanelCard>
  );
}

function SeasonWinnersTab({ payload, label }) {
  if (!payload.hasHonors) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">Honors and podium finishers will be published when available.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard className="season-detail__panel-card--accent">
      <h2 className="season-detail__panel-title">Winners & MVP</h2>
      <p className="season-detail__panel-lead">Podium finishers and season MVP.</p>
      <TournamentWinnersBlock
        honors={payload.honors}
        teams={payload.teams}
        teamLookup={payload.teamLookup}
        tournament={payload.tournament}
        seasonTitle={label}
      />
    </SeasonPanelCard>
  );
}

function SeasonBracketTab({ payload }) {
  const { matches, tournament } = payload;
  const [activeTab, setActiveTab] = useState("");

  const engineConfig = tournament?.engine_config ?? tournament?.engineConfig ?? null;
  const tournamentFormat = tournament?.format || "";

  const { groupedMatches, stageTabs, bracketSections } = useMemo(() => {
    const groups = {};
    (matches || []).forEach((match) => {
      const stageKey = match.stageKey || match.stage_key;
      if (!stageKey) return;
      if (!groups[stageKey]) groups[stageKey] = [];
      groups[stageKey].push(match);
    });
    const augmented = augmentGroupedBracketMatches(groups);
    const resolved = resolveBracketTabs(tournamentFormat, null, engineConfig);
    const raw = resolved?.length ? resolved : Object.keys(augmented).map((id) => ({ id, label: id }));
    const normalized = normalizedBlastBracketTabs(tournamentFormat, raw);
    const tabs = normalized.filter((tab) => augmented[tab.id]?.length);
    const stageTabs =
      tabs.length > 0
        ? tabs
        : Object.keys(augmented).map((id) => ({ id, label: id.replace(/-/g, " ") }));
    const sections = resolveBracketViewSections(engineConfig, tournamentFormat, stageTabs);
    return { groupedMatches: augmented, stageTabs, bracketSections: sections };
  }, [matches, tournament, engineConfig, tournamentFormat]);

  useEffect(() => {
    if (!stageTabs.length) return;
    if (!activeTab || !stageTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(stageTabs[0].id);
    }
  }, [stageTabs, activeTab]);

  const activeMatches = groupedMatches[activeTab] || [];
  const blastPlayoffQuarterRows = useMemo(
    () => (groupedMatches["blast-playoffs"] || []).filter((match) => (match.roundIndex ?? 0) === 0),
    [groupedMatches],
  );
  const stages = bracketSections.length
    ? bracketSections
        .map((section) => ({
          stage: section.label,
          count: section.tabIds.reduce((sum, tabId) => sum + (groupedMatches[tabId]?.length || 0), 0),
        }))
        .filter((entry) => entry.count > 0)
    : summarizeBracketStages(matches);

  if (!matches.length) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">Bracket structure will appear once matches are scheduled.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Bracket</h2>
      <p className="season-detail__panel-lead">
        {formatTournamentFormat(tournament?.format)} across {matches.length} matches.
      </p>
      {stages.length ? (
        <div className="season-detail__stage-grid">
          {stages.map(({ stage, count }) => (
            <div key={stage} className="season-detail__stage-chip season-glass">
              <span className="season-detail__stage-name">{stage.replace(/-/g, " ")}</span>
              <span className="season-detail__stage-count">{count} matches</span>
            </div>
          ))}
        </div>
      ) : null}
      {stageTabs.length > 1 ? (
        <div className="season-detail__bracket-tabs">
          <BracketStageTabs value={activeTab} onChange={setActiveTab} tabs={stageTabs} ariaLabel="Season bracket stage" />
        </div>
      ) : null}
      <div className="season-detail__bracket-wrap season-glass">
        <Suspense fallback={<PageLoadingSpinner label="Loading bracket…" />}>
          <BracketDiagram
            matches={activeMatches}
            blastSeedMatches={matches}
            playoffFeedMatches={
              activeTab === "blast-qualifiers" ? blastPlayoffQuarterRows : undefined
            }
          />
        </Suspense>
      </div>
    </SeasonPanelCard>
  );
}

function SeasonPlayersTab({ participations }) {
  if (!participations.length) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">Registered players will appear here once recorded.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Players</h2>
      <p className="season-detail__panel-lead">Registered players and recorded placements for this season.</p>
      <ul className="season-detail__participants">
        {participations.map((player, index) => (
          <li key={`${player.bpcId || player.displayName}-${index}`} className="season-detail__participant season-glass">
            <div className="season-detail__participant-main">
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt="" className="season-detail__participant-avatar" loading="lazy" />
              ) : (
                <span className="season-detail__participant-fallback" aria-hidden="true">
                  {(player.displayName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                {player.playerSlug ? (
                  <Link to={`/player/${player.playerSlug}`} className="season-detail__participant-name">
                    {player.displayName || player.bpcId}
                  </Link>
                ) : (
                  <span className="season-detail__participant-name">{player.displayName || player.bpcId}</span>
                )}
                <span className="season-detail__participant-meta">
                  {[player.teamName, player.role].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
            {player.placement != null ? (
              <span className="season-detail__participant-placement">#{player.placement}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </SeasonPanelCard>
  );
}

function SeasonPrizesTab({ payload }) {
  const { prizePool, prizeBreakdown } = payload;
  const podium = prizeBreakdown.slice(0, 3);

  return (
    <SeasonPanelCard>
      <h2 className="season-detail__panel-title">Prize pool</h2>
      <p className="season-detail__panel-lead">Final payout structure for this season.</p>
      <div className="season-detail__prize-hero">
        <span className="season-detail__prize-total-label">Total pool</span>
        <p className="season-detail__prize-total">{prizePool || "To be announced"}</p>
      </div>
      {podium.length ? (
        <div className="season-detail__prize-podium">
          {podium.map((item, index) => (
            <article key={`${item.label}-${index}`} className="season-detail__prize-slot season-glass">
              <span className="season-detail__prize-rank">{prizePlacementLabel(item, index)}</span>
              <span className="season-detail__prize-amount">{item.amount}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="season-detail__muted">Prize breakdown will be published when available.</p>
      )}
      {prizeBreakdown.length > 3 ? (
        <ul className="season-detail__prize-list">
          {prizeBreakdown.slice(3).map((item, index) => (
            <li key={`rest-${index}`} className="season-detail__prize-row">
              <span>{prizePlacementLabel(item, index + 3)}</span>
              <span>{item.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </SeasonPanelCard>
  );
}

function SeasonSponsorsTab({ sponsorsConfig }) {
  const section = sponsorsConfig?.section || DEFAULT_SPONSORS_SECTION;
  const sponsors = getSponsorsForDisplay(sponsorsConfig);
  if (!sponsors.length) {
    return (
      <SeasonPanelCard>
        <p className="season-detail__muted">Sponsor listings will appear when available.</p>
      </SeasonPanelCard>
    );
  }

  return (
    <SeasonPanelCard>
      <p className="season-detail__eyebrow">{section.eyebrow || DEFAULT_SPONSORS_SECTION.eyebrow}</p>
      <h2 className="season-detail__panel-title">{section.title || DEFAULT_SPONSORS_SECTION.title}</h2>
      <p className="season-detail__panel-lead">{section.subtitle || DEFAULT_SPONSORS_SECTION.subtitle}</p>
      <div className="season-detail__sponsor-grid">
        {sponsors.map((sponsor, index) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} size="medium" layout="gallery" index={index} />
        ))}
      </div>
    </SeasonPanelCard>
  );
}

export function SeasonDetailContent({ payload }) {
  const [activeTab, setActiveTab] = useState("overview");

  const enrichedTeams = useMemo(() => {
    if (!payload) return [];
    const context = {
      standings: payload.standings,
      groupedStandings: payload.groupedStandings,
      matches: payload.matches,
      format: payload.tournament?.format,
      honors: payload.honors,
    };
    return orderTeamsForTeamsPage(payload.teams, context).map((team) => enrichTeam(team, context));
  }, [payload]);

  const tabs = useMemo(() => {
    if (!payload) return [];
    const sponsorsConfig = payload.sponsorsConfig || payload.season?.sponsorsConfig;
    const sponsorCount = getSponsorsForDisplay(sponsorsConfig).length;
    return [
      { id: "overview", label: "Overview" },
      {
        id: "standings",
        label: "Standings",
        count: payload.groupedStandings?.length || payload.standings.length ? null : null,
        hidden: !payload.groupedStandings?.length && !payload.standings.length,
      },
      { id: "teams", label: "Teams", count: enrichedTeams.length || null, hidden: !enrichedTeams.length },
      { id: "winners", label: "Winners", hidden: !payload.hasHonors },
      { id: "bracket", label: "Bracket", count: payload.matches.length || null, hidden: !payload.matches.length },
      {
        id: "players",
        label: "Players",
        count: payload.participations.length || null,
        hidden: !payload.participations.length,
      },
      { id: "prizes", label: "Prizes" },
      { id: "sponsors", label: "Sponsors", count: sponsorCount || null },
    ].filter((tab) => !tab.hidden);
  }, [payload, enrichedTeams.length, payload?.sponsorsConfig, payload?.season?.sponsorsConfig]);

  if (!payload) return null;

  const label = seasonDisplayLabel(payload.season);

  return (
    <div className="season-detail__stack">
      <SeasonHero payload={payload} />

      <div className="season-detail__body">
        <nav className="season-detail__tabs" role="tablist" aria-label={`${label} sections`}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const tabId = `season-tab-${tab.id}`;
            const panelId = `season-panel-${tab.id}`;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={isActive}
                aria-controls={panelId}
                className={`season-detail__tab${isActive ? " season-detail__tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 ? (
                  <span className="season-detail__tab-count">{tab.count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="season-detail__panels">
          <SeasonTabPanel id="season-panel-overview" labelledBy="season-tab-overview" active={activeTab === "overview"}>
            <SeasonOverviewTab payload={payload} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-standings" labelledBy="season-tab-standings" active={activeTab === "standings"}>
            <SeasonStandingsTab payload={payload} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-teams" labelledBy="season-tab-teams" active={activeTab === "teams"}>
            <SeasonTeamsTab teams={enrichedTeams} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-winners" labelledBy="season-tab-winners" active={activeTab === "winners"}>
            <SeasonWinnersTab payload={payload} label={label} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-bracket" labelledBy="season-tab-bracket" active={activeTab === "bracket"}>
            <SeasonBracketTab payload={payload} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-players" labelledBy="season-tab-players" active={activeTab === "players"}>
            <SeasonPlayersTab participations={payload.participations} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-prizes" labelledBy="season-tab-prizes" active={activeTab === "prizes"}>
            <SeasonPrizesTab payload={payload} />
          </SeasonTabPanel>
          <SeasonTabPanel id="season-panel-sponsors" labelledBy="season-tab-sponsors" active={activeTab === "sponsors"}>
            <SeasonSponsorsTab sponsorsConfig={payload.sponsorsConfig || payload.season?.sponsorsConfig} />
          </SeasonTabPanel>
        </div>
      </div>
    </div>
  );
}
