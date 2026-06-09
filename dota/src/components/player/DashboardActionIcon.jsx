const ICONS = {
  tournaments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10l1 7H6L7 4Z" />
      <path d="M5 11h14v2a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4v-2Z" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  public: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" />
    </svg>
  ),
  signout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};

export function DashboardActionIcon({ name }) {
  return <span className="player-dash__action-icon">{ICONS[name] ?? null}</span>;
}
