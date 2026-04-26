export function AppHeader({ pages, activePage, setActivePage }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-serif text-xl tracking-wide text-primary">Dota Tournament Organizer</h1>
          <p className="text-xs text-muted-foreground">API-backed tournament manager</p>
        </div>
        <div className="flex gap-2">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
              className={`rounded-md border px-3 py-1 text-sm capitalize ${
                activePage === page ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
