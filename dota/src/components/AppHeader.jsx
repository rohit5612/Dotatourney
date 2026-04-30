import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock.js";

export function AppHeader({ pages, activePage, setActivePage, darkMode, setDarkMode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const labels = {
    registrations: "Registrations",
    teams: "Teams",
    setup: "Setup",
    announcements: "Announcements",
    bracketSchedule: "Bracket & Schedule",
    standings: "Standings",
    users: "Users",
  };

  useBodyScrollLock(mobileMenuOpen);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activePage]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setMobileMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileMenuOpen]);

  const mobileMenu =
    mobileMenuOpen &&
    createPortal(
      <div
        id="admin-mobile-nav"
        className="fixed inset-0 z-100 flex flex-col bg-background md:!hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-4 backdrop-blur-xl pt-[max(1rem,env(safe-area-inset-top))]">
          <span className="min-w-0 font-serif text-lg text-primary">Immortal panel</span>
          <button
            type="button"
            className="btn btn-outline btn-sm shrink-0"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            Close
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => {
                setActivePage(page);
                setMobileMenuOpen(false);
              }}
              className={`btn min-h-12 w-full justify-start text-left text-base capitalize ${
                activePage === page ? "btn-primary" : "btn-outline"
              }`}
            >
              {labels[page] || page}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline mt-auto min-h-12 w-full justify-start text-left"
            onClick={() => setDarkMode?.((prev) => !prev)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "Switch to light mode" : "Switch to dark mode"}
          </button>
        </nav>
      </div>,
      document.body,
    );

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/35 bg-gradient-to-br from-primary/12 to-transparent p-1 ring-1 ring-white/[0.04] sm:h-10 sm:w-10">
            <img className="h-full w-full object-contain" src="/bpcl.png" alt="BPC League logo" />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
              <span className="block truncate sm:whitespace-normal">BPC League — Admin</span>
            </h1>
            <p className="truncate text-xs leading-snug text-muted-foreground sm:whitespace-normal">Bharat Pro Circuit League</p>
          </div>
        </div>
        <div className="hidden gap-2 md:flex md:shrink-0">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
              className={`btn btn-sm capitalize ${activePage === page ? "btn-primary" : "btn-outline"}`}
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
        <button
          type="button"
          className="btn btn-outline btn-sm inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 md:!hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-nav"
          aria-label="Open admin navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {mobileMenu}
    </header>
  );
}
