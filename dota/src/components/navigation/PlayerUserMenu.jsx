import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { BpcCoin } from "../coins/BpcCoin.jsx";
import { useFloatingDropdownPosition } from "../../hooks/useFloatingDropdownPosition.js";
import { getPlayerToken, playerApi, setPlayerToken } from "../../lib/playerApi";
import { resolveAccountAvatarUrl } from "../../utils/resolvePlayerAvatar.js";

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
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

function UserAvatar({ account, size = 32 }) {
  const src = resolveAccountAvatarUrl(account);
  const label = account?.displayName || account?.bpcId || "Player";

  if (src) {
    return (
      <img src={src} alt="" className="player-user-menu__avatar" style={{ width: size, height: size }} />
    );
  }

  return (
    <span
      className="player-user-menu__avatar player-user-menu__avatar--fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function MenuAction({ variant, icon, label, onClick, to, danger = false }) {
  const className = [
    variant === "mobile" ? "site-navbar-drawer__user-link" : "player-user-menu__item",
    danger ? (variant === "mobile" ? "site-navbar-drawer__user-link--danger" : "player-user-menu__item--danger") : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="player-user-menu__item-icon">{icon}</span>
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} role="menuitem" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} role="menuitem" onClick={onClick}>
      {content}
    </button>
  );
}

export function usePlayerNavAccount(refreshKey = "") {
  const [account, setAccount] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(Boolean(getPlayerToken()));

  useEffect(() => {
    if (!getPlayerToken()) {
      setAccount(null);
      setCoinBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    playerApi
      .me()
      .then((data) => {
        setAccount(data.account || null);
        setCoinBalance(data.coinBalance ?? 0);
      })
      .catch(() => {
        setAccount(null);
        setCoinBalance(0);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  function clearAccount() {
    setAccount(null);
    setCoinBalance(0);
  }

  return { account, coinBalance, loading, clearAccount, isLoggedIn: Boolean(getPlayerToken()) };
}

function UserMenuPanel({ account, coinBalance, variant, onNavigate, onSignOut }) {
  return (
    <>
      <div className={variant === "mobile" ? "site-navbar-drawer__user-head" : "player-user-menu__panel-head"}>
        <UserAvatar account={account} size={40} />
        <div className="player-user-menu__panel-meta">
          <p className="player-user-menu__panel-name" title={account.displayName || undefined}>
            {account.displayName}
          </p>
          <span className="player-user-menu__panel-bpc">{account.bpcId}</span>
        </div>
      </div>

      <div className="player-user-menu__wallet">
        <span className="player-user-menu__wallet-label">BPC coins</span>
        <BpcCoin size="sm" className="player-user-menu__wallet-coin">
          <span className="bpc-coin__amount">{coinBalance}</span>
        </BpcCoin>
      </div>

      <div className={variant === "mobile" ? "site-navbar-drawer__user-links" : "player-user-menu__items"}>
        <MenuAction
          variant={variant}
          icon={ICONS.dashboard}
          label="Dashboard"
          to="/dashboard"
          onClick={onNavigate}
        />
        {account.slug ? (
          <MenuAction
            variant={variant}
            icon={ICONS.public}
            label="Public profile"
            to={`/player/${account.slug}`}
            onClick={onNavigate}
          />
        ) : null}
        <MenuAction
          variant={variant}
          icon={ICONS.signout}
          label="Sign out"
          onClick={onSignOut}
          danger
        />
      </div>
    </>
  );
}

export function PlayerUserMenu({ account, coinBalance = 0, onSignOut, variant = "desktop" }) {
  const navigate = useNavigate();
  const menuId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);

  const panelStyle = useFloatingDropdownPosition(triggerRef, open);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    try {
      await playerApi.logout();
    } catch {
      // ignore
    }
    setPlayerToken("");
    setOpen(false);
    onSignOut?.();
    navigate("/login");
  }

  if (!account) return null;

  if (variant === "mobile") {
    return (
      <div className="site-navbar-drawer__user">
        <UserMenuPanel
          account={account}
          coinBalance={coinBalance}
          variant="mobile"
          onNavigate={() => setOpen(false)}
          onSignOut={signOut}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`player-user-menu${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="player-user-menu__trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <UserAvatar account={account} />
          <span
            className="player-user-menu__label"
            title={account.displayName || account.bpcId || undefined}
          >
            {account.displayName || account.bpcId}
          </span>
          <svg className="player-user-menu__chevron" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              className="player-user-menu__panel player-nav-dropdown-shell player-nav-dropdown-shell--portal"
              style={panelStyle || undefined}
              role="menu"
            >
              <UserMenuPanel
                account={account}
                coinBalance={coinBalance}
                variant="desktop"
                onNavigate={() => setOpen(false)}
                onSignOut={signOut}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
