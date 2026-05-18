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
    <nav className="schedule-phase-nav" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`schedule-phase-tab${active ? " schedule-phase-tab--active" : ""}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onChange(tab.id)}
          >
            <span className="schedule-phase-tab__text">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function BracketStageTabs({ value, onChange, tabs, ariaLabel = "Bracket stage" }) {
  return (
    <nav className="bracket-stage-nav" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`bracket-stage-tab${active ? " bracket-stage-tab--active" : ""}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
