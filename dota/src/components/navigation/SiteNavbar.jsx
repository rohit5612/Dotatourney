import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RiAdminLine } from "react-icons/ri";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

const NAV_LINKS = [
  ["/", "Home"],
  ["/tournament", "Tournament"],
  ["/schedule", "Bracket & Schedule"],
  ["/teams", "Teams"],
  ["/rules", "Rules"],
];

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

export function SiteNavbar({ path, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useBodyScrollLock(mobileMenuOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

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

  function go(href) {
    navigate(href);
    setMobileMenuOpen(false);
  }

  const mobileMenu =
    mobileMenuOpen &&
    createPortal(
      <div
        id="public-mobile-nav"
        className="site-navbar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <div className="site-navbar-drawer__head">
          <div className="site-navbar-drawer__brand">
            <span className="site-navbar-drawer__brand-title">{SITE_BRAND_SHORT}</span>
            <span className="site-navbar-drawer__brand-sub">{SITE_BRAND_FULL}</span>
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
        <nav className="site-navbar-drawer__nav" aria-label="Mobile">
          {NAV_LINKS.map(([href, label]) => {
            const active = path === href;
            return (
              <button
                key={href}
                type="button"
                onClick={() => go(href)}
                className={`site-navbar-drawer__link${active ? " site-navbar-drawer__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </button>
            );
          })}
          <button type="button" className="site-navbar-drawer__cta" onClick={() => go("/register")}>
            Register
          </button>
        </nav>
      </div>,
      document.body,
    );

  return (
    <header className={`site-navbar${scrolled ? " site-navbar--scrolled" : ""}`}>
      <div className="site-navbar__inner site-navbar__inner--public">
        <button type="button" className="site-navbar__brand" onClick={() => go("/")}>
          <span className="site-navbar__logo">
            <img src="/bpcl.png" alt={`${SITE_BRAND_SHORT} logo`} />
          </span>
          <span className="site-navbar__brand-text">
            <span className="site-navbar__brand-title">{SITE_BRAND_SHORT}</span>
            <span className="site-navbar__brand-sub">{SITE_BRAND_FULL}</span>
          </span>
        </button>

        <nav className="site-navbar__nav" aria-label="Main">
          {NAV_LINKS.map(([href, label]) => {
            const active = path === href;
            return (
              <button
                key={href}
                type="button"
                onClick={() => navigate(href)}
                className={`site-navbar__link${active ? " site-navbar__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="site-navbar__link-label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="site-navbar__actions">
          <button type="button" className="site-navbar__cta" onClick={() => navigate("/register")}>
            Register
          </button>
          <button
            type="button"
            className="site-navbar__admin-login-btn"
            onClick={() => navigate("/admin")}
            aria-label="Admin login"
            title="Admin login"
          >
            <RiAdminLine aria-hidden />
          </button>
          <button
            type="button"
            className="site-navbar-icon-btn site-navbar__menu-btn"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-nav"
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
