import { GiPointySword } from "react-icons/gi";
import { HiOutlineStar, HiOutlineTrophy } from "react-icons/hi2";
import { TeamLogoImg } from "../TeamLogoImg.jsx";
import { hasDeckBadgeTheme, honorBadgeThemeProperties } from "../../utils/tournamentDeckTheme.js";
import { teamLogoForName } from "../../pages/player/dashboardTeamCard.js";
import "../../styles/player-honor-badges.css";

function recognitionBadgeClass(kind, themed) {
  const base = "player-profile__honor-badge player-profile__honor-badge--animated";
  const kindClass =
    kind === "champion"
      ? "player-profile__honor-badge--champion"
      : kind === "mvp"
        ? "player-profile__honor-badge--mvp"
        : "player-profile__honor-badge--custom";
  return `${base} ${kindClass}${themed ? " player-profile__honor-badge--themed" : ""}`.trim();
}

function HonorBadgeMark({ kind }) {
  if (kind === "mvp") {
    return <GiPointySword className="player-profile__honor-badge-mvp-sword-icon" />;
  }
  const Icon = kind === "champion" ? HiOutlineTrophy : HiOutlineStar;
  return <Icon />;
}

function honorLeagueLine(item) {
  const season = String(item.seasonName || "").trim();
  const team = String(item.teamName || "").trim();
  if (season && team) return `${season} · ${team}`;
  if (season) return season;
  if (team) return team;
  if (item.detail) return String(item.detail).trim();
  return "";
}

export function ProfileHonorBadge({ item }) {
  const labelParts = String(item.label || "").split("•");
  const seasonTag = labelParts[0]?.trim() || "";
  const honorTitle = labelParts.slice(1).join("•").trim() || item.kind || "Honor";
  const kind = item.kind || "custom";
  const themed = kind === "champion" && hasDeckBadgeTheme(item.deckBadgeTheme);
  const themeStyle = kind === "champion" ? honorBadgeThemeProperties(item.deckBadgeTheme) : undefined;
  const leagueLine = honorLeagueLine(item);
  const logoUrl = item.teamLogoUrl || (item.teamName ? teamLogoForName(item.teamName) : "");

  return (
    <article className={recognitionBadgeClass(kind, themed)} style={themeStyle}>
      <span className="player-profile__honor-badge-aurora" aria-hidden="true" />
      <span className="player-profile__honor-badge-shine" aria-hidden="true" />
      {logoUrl ? (
        <div className="player-profile__honor-badge-team-bg" aria-hidden="true">
          <TeamLogoImg src={logoUrl} alt="" width={120} height={120} className="player-profile__honor-badge-team-logo" />
        </div>
      ) : null}
      <div className="player-profile__honor-badge-trophy" aria-hidden="true">
        <HonorBadgeMark kind={kind} />
      </div>
      <div className="player-profile__honor-badge-body">
        <div className="player-profile__honor-badge-head">
          {seasonTag ? <span className="player-profile__honor-badge-season">{seasonTag}</span> : null}
          <span className="player-profile__honor-badge-title">{honorTitle}</span>
        </div>
        {leagueLine ? <p className="player-profile__honor-badge-league">{leagueLine}</p> : null}
      </div>
    </article>
  );
}
