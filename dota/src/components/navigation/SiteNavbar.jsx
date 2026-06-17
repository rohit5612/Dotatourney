import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { useSiteNavLinks } from "../../hooks/useSiteNavLinks.js";
import "../../styles/player-notifications.css";
import { getPlayerToken } from "../../lib/playerApi.js";
import { NotificationMenu } from "./NotificationMenu.jsx";
import { PlayerUserMenu, usePlayerNavAccount } from "./PlayerUserMenu.jsx";

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

function isNavActive(path, href) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

const HERO_NAV_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/claim-account",
]);

function isHeroNavPath(path) {
  return HERO_NAV_PATHS.has(path);
}

function useSiteNavbarOffset(headerRef) {
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;

    const update = () => {
      document.documentElement.style.setProperty("--site-navbar-offset", `${el.offsetHeight}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [headerRef]);
}

export function SiteNavbar() {
  const headerRef = useRef(null);
  const location = useLocation();
  const path = location.pathname;
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useSiteNavbarOffset(headerRef);
  const { account, coinBalance, clearAccount, isLoggedIn, loading: authLoading } = usePlayerNavAccount(
    `${path}:${getPlayerToken()}`,
  );

  useBodyScrollLock(mobileMenuOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);

  useEffect(() => {
    setMobileMenuOpen(false);
    if (isHeroNavPath(path)) {
      window.scrollTo({ top: 0, behavior: "auto" });
      setScrolled(false);
    }
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

  const loggedIn = isLoggedIn && Boolean(account);
  const authPending = isLoggedIn && authLoading && !account;
  const navLinks = useSiteNavLinks();
  const heroNav = isHeroNavPath(path);

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
          {navLinks.map(({ href, label }) => {
            const active = isNavActive(path, href);
            return (
              <Link
                key={href}
                to={href}
                className={`site-navbar-drawer__link${active ? " site-navbar-drawer__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
          {loggedIn ? (
            <PlayerUserMenu account={account} coinBalance={coinBalance} variant="mobile" onSignOut={clearAccount} />
          ) : (
            <Link to="/login" className="site-navbar-drawer__cta">
              Login / Register
            </Link>
          )}
        </nav>
      </div>,
      document.body,
    );

  return (
    <header
      id="site-navbar"
      ref={headerRef}
      className={`site-navbar${heroNav ? " site-navbar--over-hero" : ""}${scrolled ? " site-navbar--scrolled" : ""}`}
    >
      <div className="site-navbar__inner site-navbar__inner--public">
        <Link to="/" className="site-navbar__brand" aria-label={`${SITE_BRAND_SHORT} home`}>
          <span className="site-navbar__logo">
            <img src="/bpcl.png" alt={`${SITE_BRAND_SHORT} logo`} />
          </span>
          <span className="site-navbar__brand-text">
            <span className="site-navbar__brand-title">{SITE_BRAND_SHORT}</span>
            <span className="site-navbar__brand-sub">{SITE_BRAND_FULL}</span>
          </span>
        </Link>

        <nav className="site-navbar__nav site-navbar__nav--public" aria-label="Main">
          {navLinks.map(({ href, label }) => {
            const active = isNavActive(path, href);
            return (
              <Link
                key={href}
                to={href}
                className={`site-navbar__link${active ? " site-navbar__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="site-navbar__link-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="site-navbar__actions">
          {authPending ? (
            <span className="player-user-menu__trigger player-user-menu__trigger--pending" aria-hidden="true">
              …
            </span>
          ) : loggedIn ? (
            <>
              <NotificationMenu enabled={loggedIn} />
              <PlayerUserMenu account={account} coinBalance={coinBalance} onSignOut={clearAccount} />
            </>
          ) : (
            <Link to="/login" className="site-navbar__cta">
              Login / Register
            </Link>
          )}
          {!loggedIn && !authPending ? (
            <Link to="/login" className="site-navbar__cta site-navbar__login-btn" aria-label="Login">
              <HiOutlineArrowRightOnRectangle aria-hidden="true" />
            </Link>
          ) : null}
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
