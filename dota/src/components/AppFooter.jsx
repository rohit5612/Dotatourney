export function AppFooter({ navigate, mode = "public" }) {
  const quickLinks =
    mode === "admin"
      ? [
          ["registrations", "Registrations"],
          ["teams", "Teams"],
          ["setup", "Setup"],
          ["bracketSchedule", "Bracket & Schedule"],
        ]
      : [
          ["/", "Home"],
          ["/tournament", "Tournament"],
          ["/schedule", "Bracket & Schedule"],
          ["/register", "Register"],
          ["/rules", "Rules"],
        ];

  function goTo(target) {
    if (!navigate) return;
    navigate(target);
  }

  return (
    <footer className="border-t border-border bg-card/80">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted-foreground md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="font-serif text-xl text-primary">The Forge</div>
          <p className="mt-2 max-w-md leading-6">
            A Dota 2 tournament hub for registrations, approved rosters, brackets, schedules, standings, and match-day updates.
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-foreground">Quick links</div>
          <div className="mt-3 grid gap-2">
            {quickLinks.map(([target, label]) => (
              <button
                key={target}
                type="button"
                className="w-fit text-left transition hover:text-primary"
                onClick={() => goTo(target)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-foreground">Community</div>
          <div className="mt-3 grid gap-2">
            <a className="w-fit transition hover:text-primary" href="https://discord.gg/NmC2Xqnb" target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} The Forge. All rights reserved.</span>
          <span>
            Powered by{" "}
            <a className="font-medium text-primary transition hover:text-foreground" href="https://nuvorn.com/" target="_blank" rel="noreferrer">
              Nuvorn Technologies
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
