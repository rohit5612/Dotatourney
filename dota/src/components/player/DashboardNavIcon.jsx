const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  tournaments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10l1 7H6L7 4Z" />
      <path d="M5 11h14v2a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4v-2Z" />
    </svg>
  ),
};

export function DashboardNavIcon({ name }) {
  return <span className="player-dash__nav-icon">{ICONS[name] ?? null}</span>;
}
