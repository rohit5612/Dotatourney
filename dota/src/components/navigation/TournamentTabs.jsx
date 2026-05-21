import "../../styles/tournament-tabs.css";

function bracketTabShortLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "";
  if (text.length <= 16) return text;
  if (/last chance\s*&\s*play-?in/i.test(text)) return "LC & Play-In";
  if (/last chance/i.test(text)) return "Last chance";
  if (/play-?ins?/i.test(text)) return "Play-Ins";
  if (/playoffs?/i.test(text)) return "Playoffs";
  if (/groups?/i.test(text) && text.length > 18) return text.replace(/\s+round\s+robin/gi, " RR");
  return text.length > 20 ? `${text.slice(0, 18)}…` : text;
}

function TabLabel({ label, shortLabel }) {
  const short = shortLabel ?? label;
  return (
    <>
      <span className="tourney-tab-chip__label tourney-tab-chip__label--full">{label}</span>
      <span className="tourney-tab-chip__label tourney-tab-chip__label--short">{short}</span>
    </>
  );
}

export function PrimaryViewTabs({ value, onChange, tabs, ariaLabel, onTabClick }) {
  return (
    <nav className="view-tabs-primary" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`view-tabs-primary__tab${active ? " view-tabs-primary__tab--active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              onChange(tab.id);
              onTabClick?.(tab.id);
            }}
          >
            <span className="view-tabs-primary__glow" aria-hidden />
            <span className="view-tabs-primary__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function SchedulePhaseTabs({ value, onChange, tabs, ariaLabel = "Schedule phase" }) {
  return (
    <div className="tourney-tab-rail tourney-tab-rail--phase">
      <nav className="schedule-phase-nav" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const active = value === tab.id;
          const short = tab.shortLabel ?? tab.label;
          return (
            <button
              key={tab.id}
              type="button"
              className={`schedule-phase-tab${active ? " schedule-phase-tab--active" : ""}`}
              aria-current={active ? "true" : undefined}
              title={tab.label}
              onClick={() => onChange(tab.id)}
            >
              <span className="tourney-tab-chip__glow" aria-hidden />
              <TabLabel label={tab.label} shortLabel={short} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function BracketStageTabs({ value, onChange, tabs, ariaLabel = "Bracket stage" }) {
  return (
    <div className="tourney-tab-rail tourney-tab-rail--stage">
      <nav className="bracket-stage-nav" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const active = value === tab.id;
          const short = tab.shortLabel ?? bracketTabShortLabel(tab.label);
          return (
            <button
              key={tab.id}
              type="button"
              className={`bracket-stage-tab${active ? " bracket-stage-tab--active" : ""}`}
              aria-current={active ? "true" : undefined}
              title={tab.label}
              onClick={() => onChange(tab.id)}
            >
              <span className="tourney-tab-chip__glow" aria-hidden />
              <TabLabel label={tab.label} shortLabel={short} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
