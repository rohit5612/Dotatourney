import { honorBadgeClass } from "../../utils/tournamentHonors.js";

export function TeamHonorBadge({ badge, className = "" }) {
  if (!badge?.label) return null;
  return (
    <span className={`${honorBadgeClass(badge.kind)} ${className}`.trim()} title={badge.label}>
      {badge.label}
    </span>
  );
}

export { TournamentWinnersBlock, TournamentHonorsSection, ChampionStrip } from "./TournamentWinnersBlock.jsx";
export { WinnerTeamCard, WinnerTeamCardGrid } from "./WinnerTeamCard.jsx";
export { MvpShowcaseCard } from "./MvpShowcaseCard.jsx";
