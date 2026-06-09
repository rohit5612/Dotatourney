import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardActionIcon } from "./DashboardActionIcon.jsx";
import { playerApi } from "../../lib/playerApi";

const LINKAGE = [
  { key: "emailVerified", label: "Email", detailKey: "email" },
  { key: "steamLinked", label: "Steam", detailKey: "steamPersona" },
  { key: "discordLinked", label: "Discord", detailKey: "discordUsername" },
];

export function useRegistrationTournament(slug) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    playerApi
      .upcomingTournaments()
      .then((r) => {
        const match = (r.tournaments || []).find((t) => t.slug === slug) || null;
        setTournament(match);
      })
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));
  }, [slug]);

  return { tournament, loading };
}

export function buildCardManifest(account, tier) {
  if (!account) return null;
  const role = (account.preferredRoles || [])[0] || "";
  return {
    tier: tier || "default",
    displayName: account.displayName || "Player",
    bpcId: account.bpcId,
    steamAvatar: account.steamAvatarUrl,
    stats: { role, mmr: account.mmr },
    role,
    mmr: account.mmr,
  };
}

function LinkageChip({ item, account }) {
  const done = Boolean(account[item.key]);
  const detail = item.detailKey ? account[item.detailKey] : null;

  return (
    <div className={`player-reg__link-chip${done ? " is-done" : ""}`}>
      <span className="player-reg__link-chip-icon" aria-hidden="true">
        {done ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </span>
      <div className="player-reg__link-chip-copy">
        <span className="player-reg__link-chip-label">{item.label}</span>
        {detail ? <span className="player-reg__link-chip-detail">{detail}</span> : null}
      </div>
      <span className={`player-reg__link-chip-status${done ? " is-done" : ""}`}>
        {done ? "Linked" : "Required"}
      </span>
    </div>
  );
}

export function RegistrationHero({ tournament, account, step, stepLabel }) {
  const linkageDone = LINKAGE.filter((item) => account?.[item.key]).length;

  return (
    <header className="player-dash__hero player-dash__hero--compact player-reg__hero">
      <div className="player-dash__hero-main">
        <div className="player-dash__tourney-hero-icon" aria-hidden="true">
          <DashboardActionIcon name="tournaments" />
        </div>
        <div className="player-dash__hero-copy">
          <p className="player-dash__hero-eyebrow">Tournament registration</p>
          <h1 className="player-dash__hero-title">{tournament?.name || "Register"}</h1>
          <div className="player-dash__hero-meta">
            {account?.bpcId ? <span className="player-dash__badge">{account.bpcId}</span> : null}
            <span className="player-dash__hero-chip">
              {linkageDone}/{LINKAGE.length} accounts linked
            </span>
            {stepLabel ? <span className="player-dash__hero-chip">{stepLabel}</span> : null}
          </div>
          <p className="player-dash__hero-desc">
            {step === 1
              ? "Confirm your player details before checkout. Fields are prefilled from your profile."
              : "Choose your card bundle, apply BPC coins, and complete payment to lock in your spot."}
          </p>
        </div>
      </div>

      <div className="player-dash__hero-actions">
        <Link to="/dashboard/tournaments" className="player-dash__action player-dash__action--public">
          <span>All tournaments</span>
        </Link>
      </div>
    </header>
  );
}

export function RegistrationStepper({ step }) {
  const steps = [
    { num: 1, label: "Details", path: null },
    { num: 2, label: "Checkout", path: null },
  ];

  return (
    <nav className="player-reg__stepper" aria-label="Registration progress">
      {steps.map((item, index) => {
        const isActive = step === item.num;
        const isDone = step > item.num;
        const connectorDone = step > item.num;

        return (
          <div key={item.num} className="player-reg__stepper-item">
            {index > 0 ? (
              <span
                className={`player-reg__stepper-line${connectorDone ? " is-done" : ""}`}
                aria-hidden="true"
              />
            ) : null}
            <div
              className={`player-reg__stepper-node${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
            >
              <span className="player-reg__stepper-num" aria-hidden="true">
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  item.num
                )}
              </span>
              <span className="player-reg__stepper-label">{item.label}</span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function RegistrationLinkagePanel({ account }) {
  if (!account) return null;

  return (
    <section className="player-dash__card player-dash__section-card player-reg__link-panel">
      <header className="player-dash__card-head player-dash__card-head--compact">
        <div className="player-dash__section-title-row">
          <span className="player-dash__section-icon" aria-hidden="true">
            <DashboardActionIcon name="edit" />
          </span>
          <div>
            <h2 className="player-dash__card-title">Linked accounts</h2>
            <p className="player-dash__card-sub">Read-only — used for roster verification</p>
          </div>
        </div>
      </header>

      <div className="player-reg__link-list">
        {LINKAGE.map((item) => (
          <LinkageChip key={item.key} item={item} account={account} />
        ))}
      </div>

      {!account.eligibleForRegistration ? (
        <p className="player-reg__link-hint">
          Complete all linkage from{" "}
          <Link to="/dashboard/settings" className="player-reg__inline-link">
            profile settings
          </Link>{" "}
          before registering.
        </p>
      ) : null}
    </section>
  );
}

export function RegistrationPlayerStrip({ account }) {
  if (!account) return null;
  const initial = (account.displayName || account.bpcId || "?")[0].toUpperCase();

  return (
    <div className="player-reg__player-strip">
      {account.steamAvatarUrl ? (
        <img src={account.steamAvatarUrl} alt="" className="player-reg__player-avatar" />
      ) : (
        <span className="player-reg__player-avatar player-reg__player-avatar--fallback" aria-hidden="true">
          {initial}
        </span>
      )}
      <div className="player-reg__player-copy">
        <p className="player-reg__player-name">{account.displayName || "Player"}</p>
        <p className="player-reg__player-meta">
          {account.bpcId}
          {account.mmr != null ? ` · ${account.mmr} MMR` : ""}
        </p>
      </div>
    </div>
  );
}
