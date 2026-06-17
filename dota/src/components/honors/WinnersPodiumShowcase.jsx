import { memo } from "react";
import { HiOutlineTrophy } from "react-icons/hi2";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { TeamCard } from "../teams/TeamCard.jsx";
import { PlayerRoleIcons } from "../PlayerRoleIcons.jsx";
import { useInView } from "../../hooks/useInView.js";
import { teamAccentStyle, useLogoAccent } from "../../hooks/useLogoAccent.js";
import { normalizeTeamLogoUrl } from "../../utils/teamLogoCache.js";
import {
  findTeamByName,
  playerDisplayName,
  playerInitials,
  sortPlayersByRole,
  teamInitials,
} from "../../utils/teamPage.js";
import "../../styles/tournament-honors.css";
import "../../styles/team-logo-img.css";
import "../../styles/teams-page.css";

function resolveTeam(entry, teamLookup) {
  return findTeamByName(teamLookup, entry.teamName) || { name: entry.teamName, players: [] };
}

function resolveRoster(team) {
  const roster = sortPlayersByRole(team?.players?.length ? team.players : []);
  return roster.length ? roster : [{ name: "Roster TBA", role: "Player" }];
}

function PodiumPlayerChip({ player, prefix, chipIndex = 0, animate = true }) {
  const name = playerDisplayName(player);
  const isCaptain = Boolean(player.isCaptain);

  return (
    <li
      className={`${prefix}__player-chip${isCaptain ? ` ${prefix}__player-chip--captain` : ""}${animate ? "" : ` ${prefix}__player-chip--static`}`}
      style={animate ? { "--chip-index": chipIndex } : undefined}
    >
      <span className={`${prefix}__player-avatar`} aria-hidden>
        {playerInitials(name)}
      </span>
      <span className={`${prefix}__player-name`}>{name}</span>
      {isCaptain ? <span className={`${prefix}__player-captain`}>Captain</span> : null}
      <PlayerRoleIcons player={player} className={`${prefix}__player-roles`} size="sm" />
    </li>
  );
}

const ChampionSpotlightCard = memo(function ChampionSpotlightCard({ entry, teamLookup }) {
  const { ref, inView } = useInView({ rootMargin: "120px 0px", threshold: 0.08 });
  const team = resolveTeam(entry, teamLookup);
  const logo = team?.logoUrl || team?.logo_url || "";
  const logoUrl = normalizeTeamLogoUrl(logo);
  const hasCustomAccent = Boolean(team?.accentColor || team?.accent_color);
  const sampledAccent = useLogoAccent(logo, { enabled: inView && !hasCustomAccent });
  const accentStyle = teamAccentStyle(team, sampledAccent);
  const roster = resolveRoster(team);
  const prefix = "champion-spotlight";

  return (
    <article
      ref={ref}
      className={[
        prefix,
        logoUrl ? `${prefix}--has-logo` : "",
        hasCustomAccent ? `${prefix}--custom-accent` : "",
        inView ? `${prefix}--in-view` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={accentStyle}
      aria-label={`${entry.teamName} — Season champion`}
    >
      {logoUrl ? (
        <div className={`${prefix}__bg`} aria-hidden>
          <div className={`${prefix}__bg-glow`} aria-hidden />
          <TeamLogoImg src={logo} alt="" className={`${prefix}__bg-logo`} width={560} height={560} />
          <div className={`${prefix}__bg-vignette`} />
        </div>
      ) : null}
      <div className={`${prefix}__backdrop`} aria-hidden />
      <div className={`${prefix}__glow`} aria-hidden />
      <div className={`${prefix}__border-glow`} aria-hidden />

      <div className={`${prefix}__frame`}>
        {inView ? <div className={`${prefix}__shine`} aria-hidden /> : null}

        <div className={`${prefix}__layout`}>
          <aside className={`${prefix}__aside`} aria-label="Champion team">
            <div className={`${prefix}__badge`}>
              <HiOutlineTrophy aria-hidden />
              <span>Season Champion</span>
            </div>

            <div className={`${prefix}__logo-stage`}>
              <div className={`${prefix}__logo-aura`} aria-hidden />
              {logo ? (
                <>
                  <span className={`${prefix}__crown`} aria-hidden />
                  <div className={`${prefix}__logo-ring`}>
                    <TeamLogoImg
                      src={logo}
                      alt=""
                      className={`${prefix}__logo`}
                      width={200}
                      height={200}
                      loading="eager"
                      fetchPriority="high"
                    />
                  </div>
                  <div className={`${prefix}__logo-shine`} aria-hidden />
                </>
              ) : (
                <span className={`${prefix}__logo-fallback`}>{teamInitials(team)}</span>
              )}
            </div>

            <p className={`${prefix}__stage`}>Grand Final winners</p>
          </aside>

          <div className={`${prefix}__main`}>
            <header className={`${prefix}__identity`}>
              <h3 className={`${prefix}__name`}>{entry.teamName}</h3>
              <p className={`${prefix}__tagline`}>Crowned at the grand final</p>
            </header>

            <section className={`${prefix}__roster`} aria-label={`${entry.teamName} roster`}>
              <p className={`${prefix}__roster-label`}>Championship roster</p>
              <ul className={`${prefix}__roster-row`}>
                {roster.map((player, index) => (
                  <PodiumPlayerChip
                    key={player.id || playerDisplayName(player)}
                    player={player}
                    prefix={prefix}
                    chipIndex={index}
                  />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </article>
  );
});

const RunnerUpSpotlightCard = memo(function RunnerUpSpotlightCard({ entry, teamLookup }) {
  const { ref, inView } = useInView({ rootMargin: "120px 0px", threshold: 0.08 });
  const team = resolveTeam(entry, teamLookup);
  const logo = team?.logoUrl || team?.logo_url || "";
  const logoUrl = normalizeTeamLogoUrl(logo);
  const hasCustomAccent = Boolean(team?.accentColor || team?.accent_color);
  const sampledAccent = useLogoAccent(logo, { enabled: inView && !hasCustomAccent });
  const accentStyle = teamAccentStyle(team, sampledAccent);
  const roster = resolveRoster(team);
  const prefix = "runner-up-spotlight";

  return (
    <article
      ref={ref}
      className={[
        prefix,
        logoUrl ? `${prefix}--has-logo` : "",
        hasCustomAccent ? `${prefix}--custom-accent` : "",
        inView ? `${prefix}--in-view` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={accentStyle}
      aria-label={`${entry.teamName} — Runner-up`}
    >
      {logoUrl ? (
        <div className={`${prefix}__bg`} aria-hidden>
          <TeamLogoImg src={logo} alt="" className={`${prefix}__bg-logo`} width={560} height={560} loading="lazy" />
          <div className={`${prefix}__bg-vignette`} />
        </div>
      ) : null}
      <div className={`${prefix}__backdrop`} aria-hidden />
      <div className={`${prefix}__glow`} aria-hidden />

      <div className={`${prefix}__frame`}>
        <div className={`${prefix}__layout`}>
          <aside className={`${prefix}__aside`} aria-label="Runner-up team">
            <div className={`${prefix}__badge`}>Runner-up</div>

            <div className={`${prefix}__logo-stage`}>
              {logo ? (
                <div className={`${prefix}__logo-ring`}>
                  <TeamLogoImg
                    src={logo}
                    alt=""
                    className={`${prefix}__logo`}
                    width={160}
                    height={160}
                    loading="lazy"
                  />
                </div>
              ) : (
                <span className={`${prefix}__logo-fallback`}>{teamInitials(team)}</span>
              )}
            </div>

            <p className={`${prefix}__stage`}>2nd place · Grand Final</p>
          </aside>

          <div className={`${prefix}__main`}>
            <header className={`${prefix}__identity`}>
              <h3 className={`${prefix}__name`}>{entry.teamName}</h3>
              <p className={`${prefix}__tagline`}>Finalists at the grand final</p>
            </header>

            <section className={`${prefix}__roster`} aria-label={`${entry.teamName} roster`}>
              <p className={`${prefix}__roster-label`}>Roster</p>
              <ul className={`${prefix}__roster-row`}>
                {roster.map((player) => (
                  <PodiumPlayerChip
                    key={player.id || playerDisplayName(player)}
                    player={player}
                    prefix={prefix}
                    animate={false}
                  />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </article>
  );
});

export function WinnersPodiumShowcase({ podiumTeams, teamLookup, variant = "full" }) {
  if (!podiumTeams?.length) return null;

  const sorted = [...podiumTeams].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const champion = sorted.find((entry) => entry.placement === 1) || sorted[0];
  const runnerUp = sorted.find((entry) => entry.placement === 2);
  const rest = sorted.filter((entry) => entry !== champion && entry !== runnerUp);

  return (
    <div className={`podium-showcase${variant === "compact" ? " podium-showcase--compact" : ""}`}>
      <ChampionSpotlightCard entry={champion} teamLookup={teamLookup} />
      {runnerUp ? <RunnerUpSpotlightCard entry={runnerUp} teamLookup={teamLookup} /> : null}
      {rest.length ? (
        <div className="podium-showcase__also-ran" aria-label="Other podium finishers">
          {rest.map((entry, index) => (
            <div key={`${entry.teamName}-${entry.placement}-${index}`} className="podium-showcase__team-card">
              <TeamCard team={resolveTeam(entry, teamLookup)} index={index + 1} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
