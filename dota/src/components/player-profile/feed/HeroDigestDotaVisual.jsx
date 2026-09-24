import {
  HiOutlineBanknotes,
  HiOutlineBolt,
  HiOutlineBookOpen,
  HiOutlineBuildingOffice2,
  HiOutlineUserPlus,
  HiOutlineViewfinderCircle,
} from "react-icons/hi2";
import { formatStatCompact } from "../../../utils/dotaAssets.js";
import { DotaKdaRing, DotaRecordRing, DotaWinRateRing } from "./DotaRingStat.jsx";

function HeroDigestAvgStat({ icon: Icon, label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="hero-digest__avg-stat" title={`${label}: ${value}`}>
      <Icon className="hero-digest__avg-stat-icon" aria-hidden="true" />
      <span className="hero-digest__avg-stat-value">{value}</span>
      <span className="hero-digest__avg-stat-label">{label}</span>
    </div>
  );
}

export function HeroDigestDotaVisual({ global, wins, losses }) {
  const winRate =
    global?.winRate != null
      ? global.winRate
      : wins + losses > 0
        ? Math.round((wins / (wins + losses)) * 100)
        : null;

  return (
    <div className="hero-digest__visual-stats" aria-label="Dota performance">
      <div className="hero-digest__rings">
        <DotaRecordRing wins={wins} losses={losses} size="compact" />
        {winRate != null ? <DotaWinRateRing winRate={winRate} size="compact" /> : null}
        <DotaKdaRing avgKda={global?.avgKda} size="compact" />
      </div>
      <div className="hero-digest__avg-grid" aria-label="Average match stats">
        <HeroDigestAvgStat icon={HiOutlineBanknotes} label="Avg GPM" value={global?.avgGpm} />
        <HeroDigestAvgStat icon={HiOutlineBookOpen} label="Avg XPM" value={global?.avgXpm} />
        <HeroDigestAvgStat
          icon={HiOutlineBolt}
          label="Avg hero dmg"
          value={formatStatCompact(global?.avgHeroDamage)}
        />
        <HeroDigestAvgStat
          icon={HiOutlineBuildingOffice2}
          label="Avg tower dmg"
          value={formatStatCompact(global?.avgTowerDamage)}
        />
        <HeroDigestAvgStat icon={HiOutlineViewfinderCircle} label="Avg LH" value={global?.avgLastHits} />
        <HeroDigestAvgStat
          icon={HiOutlineUserPlus}
          label="Avg assists"
          value={global?.avgKda?.assists}
        />
      </div>
    </div>
  );
}
