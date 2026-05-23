import { TeamLogoImg } from "./TeamLogoImg.jsx";
import { hexToRgbTriplet } from "../hooks/useLogoAccent.js";
import { findTeamByName, teamInitials } from "../utils/teamPage.js";

function groupAccentClass(title) {
  if (/group\s*a/i.test(title)) return "standings-table--group-a";
  if (/group\s*b/i.test(title)) return "standings-table--group-b";
  return "";
}

function teamAccentTriplet(team) {
  return hexToRgbTriplet(team?.accentColor || team?.accent_color);
}

function leaderRowStyle(team) {
  const triplet = teamAccentTriplet(team);
  if (!triplet) return undefined;
  return { "--leader-accent": `rgb(${triplet})` };
}

function teamLogoStyle(team) {
  const triplet = teamAccentTriplet(team);
  if (!triplet) return undefined;
  return {
    borderColor: `color-mix(in srgb, rgb(${triplet}) 42%, rgb(255 255 255 / 0.12))`,
    boxShadow: `0 4px 12px rgb(0 0 0 / 0.3), 0 0 16px color-mix(in srgb, rgb(${triplet}) 20%, transparent)`,
  };
}

function PublicStandingsRow({ row, rank, teamLookup }) {
  const team = findTeamByName(teamLookup, row.team);
  const logo = team?.logoUrl || team?.logo_url || "";
  const initials = team ? teamInitials(team) : String(row.team || "?").slice(0, 2).toUpperCase();
  const winPct = Math.round((row.winPct ?? 0) * 100);
  const rowClass = [
    "standings-table__row",
    rank === 1 ? "standings-table__row--leader" : "",
    row.status === "eliminated" ? "standings-table__row--eliminated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rowClass} style={rank === 1 ? leaderRowStyle(team) : undefined} role="listitem">
      <span className="standings-table__rank" aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      <div className="standings-table__team">
        <div className="standings-table__logo" style={teamLogoStyle(team)}>
          {logo ? (
            <TeamLogoImg src={logo} alt="" className="standings-table__logo-img" width={36} height={36} loading="lazy" />
          ) : (
            <span className="standings-table__logo-fallback" aria-hidden>
              {initials}
            </span>
          )}
        </div>
        <div className="standings-table__team-copy">
          <span className="standings-table__name">{row.team}</span>
          <span className="standings-table__played">{row.played ?? 0} played</span>
        </div>
      </div>
      <div className="standings-table__stats" aria-label={`${row.wins ?? 0} wins, ${row.losses ?? 0} losses`}>
        <span className="standings-table__stat standings-table__stat--w">
          <span className="standings-table__stat-label">W</span>
          <span className="standings-table__stat-value">{row.wins ?? 0}</span>
        </span>
        <span className="standings-table__stat standings-table__stat--l">
          <span className="standings-table__stat-label">L</span>
          <span className="standings-table__stat-value">{row.losses ?? 0}</span>
        </span>
        <span className="standings-table__stat standings-table__stat--pct">
          <span className="standings-table__stat-label">WR</span>
          <span className="standings-table__stat-value">{winPct}%</span>
        </span>
      </div>
    </div>
  );
}

/** @param {{ title: string, rows?: Array<{ team: string, wins?: number, losses?: number, played?: number, winPct?: number, status?: string }>, variant?: 'admin' | 'compact' | 'public', showRank?: boolean, showWinPct?: boolean, showStatus?: boolean, teamLookup?: Map<string, object> }} props */
export function StandingsTable({
  title,
  rows = [],
  variant = "compact",
  showRank = false,
  showWinPct = false,
  showStatus = false,
  teamLookup = null,
}) {
  if (variant === "public") {
    return (
      <article className={`standings-table standings-table--public ${groupAccentClass(title)}`.trim()}>
        <header className="standings-table__head">
          <p className="standings-table__eyebrow">Standings</p>
          <h4 className="standings-table__title">{title}</h4>
        </header>
        <div className="standings-table__rows" role="list">
          {rows.map((row, index) => (
            <PublicStandingsRow key={row.team} row={row} rank={index + 1} teamLookup={teamLookup} />
          ))}
        </div>
        {!rows.length ? <p className="standings-table__empty">No results yet — group matches will populate this table.</p> : null}
      </article>
    );
  }

  if (variant === "admin") {
    return (
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="border-b border-border bg-card/50 px-3 py-2 font-medium">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                {showRank ? <th className="p-2">Rank</th> : null}
                <th className="p-2">Team</th>
                <th className="p-2 text-emerald-700 dark:text-emerald-400">W</th>
                <th className="p-2 text-red-700 dark:text-red-400">L</th>
                {showWinPct ? <th className="p-2">Win%</th> : null}
                {showStatus ? <th className="p-2">Status</th> : null}
                {!showWinPct && !showStatus ? <th className="p-2">P</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.team} className="border-b border-border last:border-none">
                  {showRank ? <td className="p-2 text-muted-foreground">{index + 1}</td> : null}
                  <td className="p-2 font-medium">{row.team}</td>
                  <td className="standings-cell-wins p-2">{row.wins ?? 0}</td>
                  <td className="standings-cell-losses p-2">{row.losses ?? 0}</td>
                  {showWinPct ? (
                    <td className="p-2">{Math.round((row.winPct ?? 0) * 100)}%</td>
                  ) : null}
                  {showStatus ? <td className="p-2 capitalize">{String(row.status || "").replace("_", " ")}</td> : null}
                  {!showWinPct && !showStatus ? <td className="p-2">{row.played ?? 0}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">No results yet.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2 font-medium">{title}</div>
      <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Team</span>
        <span className="text-emerald-700 dark:text-emerald-400">W</span>
        <span className="text-red-700 dark:text-red-400">L</span>
        <span>P</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.team}
          className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-2 border-t border-border px-3 py-2 text-sm"
        >
          <span className="truncate font-medium">{row.team}</span>
          <span className="standings-cell-wins">{row.wins ?? 0}</span>
          <span className="standings-cell-losses">{row.losses ?? 0}</span>
          <span>{row.played ?? 0}</span>
        </div>
      ))}
      {!rows.length ? <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">No results yet.</p> : null}
    </div>
  );
}
