import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock.js";

const PAGE_LABELS = {
  registrations: "Registrations",
  teams: "Teams",
  setup: "Setup",
  cards: "Cards",
  announcements: "News",
  honors: "Honors",
  bracketSchedule: "Bracket",
  standings: "Standings",
  users: "Users",
};

function MenuIcon({ open }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function AppHeader({ pages, activePage, setActivePage, darkMode, setDarkMode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  function selectPage(page) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  const mobileMenu =
    mobileMenuOpen &&
    createPortal(
      <div
        id="admin-mobile-nav"
        className="site-navbar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="site-navbar-drawer__head">
          <div className="site-navbar-drawer__brand">
            <span className="site-navbar-drawer__brand-title">Admin panel</span>
            <span className="site-navbar-drawer__brand-sub">BPC League</span>
          </div>
          <button
            type="button"
            className="site-navbar-icon-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <MenuIcon open />
          </button>
        </div>
        <nav className="site-navbar-drawer__nav" aria-label="Admin mobile">
          {pages.map((page) => {
            const active = activePage === page;
            return (
              <button
                key={page}
                type="button"
                onClick={() => selectPage(page)}
                className={`site-navbar-drawer__link${active ? " site-navbar-drawer__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {PAGE_LABELS[page] || page}
              </button>
            );
          })}
          <button
            type="button"
            className="site-navbar-drawer__link"
            onClick={() => {
              setDarkMode?.((prev) => !prev);
              setMobileMenuOpen(false);
            }}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "Switch to light mode" : "Switch to dark mode"}
          </button>
        </nav>
      </div>,
      document.body,
    );

  return (
    <header className="site-navbar site-navbar--admin site-navbar--scrolled">
      <div className="site-navbar__inner site-navbar__inner--admin">
        <div className="site-navbar__brand site-navbar__brand--static">
          <span className="site-navbar__logo">
            <img src="/bpcl.png" alt="BPC League logo" />
          </span>
          <span className="site-navbar__brand-text">
            <span className="site-navbar__brand-title">BPC League — Admin</span>
            <span className="site-navbar__brand-sub">Bharat Pro Circuit League</span>
          </span>
        </div>

        <nav className="site-navbar__nav site-navbar__nav--admin" aria-label="Admin">
          {pages.map((page) => {
            const active = activePage === page;
            return (
              <button
                key={page}
                type="button"
                onClick={() => setActivePage(page)}
                className={`site-navbar__link${active ? " site-navbar__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="site-navbar__link-label">{PAGE_LABELS[page] || page}</span>
              </button>
            );
          })}
        </nav>

        <div className="site-navbar__actions">
          <button
            type="button"
            className="site-navbar-icon-btn site-navbar__theme-btn"
            onClick={() => setDarkMode?.((prev) => !prev)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀" : "☾"}
          </button>
          <button
            type="button"
            className="site-navbar-icon-btn site-navbar__menu-btn"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-mobile-nav"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            <MenuIcon open={mobileMenuOpen} />
          </button>
        </div>
      </div>
      {mobileMenu}
    </header>
  );
}
