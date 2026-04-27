export function AppHeader({ pages, activePage, setActivePage, darkMode, setDarkMode }) {
  const labels = {
    registrations: "Registrations",
    teams: "Teams",
    setup: "Setup",
    announcements: "Announcements",
    bracketSchedule: "Bracket & Schedule",
    standings: "Standings",
    users: "Users",
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/40 bg-primary/10 p-1.5">
            <img className="h-full w-full object-contain" src="/dota.svg" alt="Dota Tournament Organizer logo" />
          </span>
          <div>
            <h1 className="font-serif text-xl tracking-wide text-primary">The Forge | Immortal panel </h1>
            <p className="text-xs text-muted-foreground">Tournament manager Suite</p>
          </div>
        </div>
        <div className="flex gap-2">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
              className={`btn btn-sm capitalize ${
                activePage === page ? "btn-primary" : "btn-outline"
              }`}
            >
              {labels[page] || page}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm h-9 w-9 px-0"
            onClick={() => setDarkMode?.((prev) => !prev)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀" : "☾"}
          </button>
        </div>
      </div>
    </header>
  );
}
