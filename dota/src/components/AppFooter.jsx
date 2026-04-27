export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} The Forge. All rights reserved.</span>
        <span>
          Powered by{" "}
          <a
            href="https://nuvorn.com/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary transition hover:text-foreground"
          >
            Nuvorn Technologies
          </a>
        </span>
      </div>
    </footer>
  );
}
