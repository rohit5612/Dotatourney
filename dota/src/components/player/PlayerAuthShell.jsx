import { Link } from "react-router-dom";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import "../../styles/player-auth.css";

const AUTH_HIGHLIGHTS = [
  {
    id: "register",
    text: "Verify profile / MMR ,Register & checkout from Tournaments",
    tone: "accent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    id: "substitute",
    text: "Substitute pool when registrations close — no entry fee",
    tone: "secondary",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "schedule",
    text: "View Team, Match schedule after brackets publish",
    tone: "accent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    id: "sub-request",
    text: "Substitute Requests; cancel up to 4h before",
    tone: "warm",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
      </svg>
    ),
  },
  {
    id: "profile",
    text: "BPC Card,BPC coins, profile & linked accounts",
    tone: "neutral",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M7 15h.01M11 15h2" />
      </svg>
    ),
  },
  {
    id: "payments",
    text: "Secure payment gateway for deposits & withdrawals",
    tone: "accent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      </svg>
    ),
  },
];

export const AUTH_SHELL_PRESETS = {
  login: {
    eyebrow: "Player portal",
    headline: "Welcome back",
    description: "Your dashboard for registration, roster tools, and match-day prep.",
  },
  signup: {
    eyebrow: "Join the league",
    headline: "Create your account",
    description: "One account for tournaments, your player card, and the season bracket.",
  },
  default: {
    eyebrow: SITE_BRAND_SHORT,
    headline: "India's Dota 2 circuit",
    description: `${SITE_BRAND_FULL} — community tournaments, live brackets, and collectible player cards.`,
  },
};

function BrandFeatures() {
  return (
    <div className="player-auth-split__features">
      <div className="player-auth-split__features-head">
        <span className="player-auth-split__features-rule" aria-hidden="true" />
        <p className="player-auth-split__features-label">In your dashboard</p>
      </div>
      <ul className="player-auth-split__feature-list">
        {AUTH_HIGHLIGHTS.map((item) => (
          <li
            key={item.id}
            className={`player-auth-split__feature-item player-auth-split__feature-item--${item.tone}`}
          >
            <span className="player-auth-split__feature-icon">{item.icon}</span>
            <span className="player-auth-split__feature-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlayerAuthShell({
  preset = "default",
  eyebrow,
  headline,
  description,
  children,
}) {
  const branding = AUTH_SHELL_PRESETS[preset] || AUTH_SHELL_PRESETS.default;
  const resolvedEyebrow = eyebrow ?? branding.eyebrow;
  const resolvedHeadline = headline ?? branding.headline;
  const resolvedDescription = description ?? branding.description;

  return (
    <div className="player-auth-split">
      <div className="player-auth-split__backdrop" aria-hidden="true" />
      <div className="player-auth-split__overlay" aria-hidden="true" />

      <div className="player-auth-split__stage">
        <div className="player-auth-split__cards">
          <section className="player-auth__glass player-auth__glass--card player-auth__glass--form">
            <div className="player-auth__form-inner">{children}</div>
          </section>

          <aside
            className="player-auth__glass player-auth__glass--card player-auth__glass--brand"
            aria-label={`${SITE_BRAND_SHORT} branding`}
          >
            <div className="player-auth__brand-top">
              <Link to="/" className="player-auth-split__logo-link" aria-label={`${SITE_BRAND_SHORT} home`}>
                <span className="player-auth-split__logo-frame">
                  <img src="/bpcl.png" alt="" className="player-auth-split__logo" width={64} height={64} />
                </span>
              </Link>
              <div className="player-auth__brand-copy">
                <p className="player-auth-split__eyebrow">{resolvedEyebrow}</p>
                <h2 className="player-auth-split__headline">{resolvedHeadline}</h2>
                <p className="player-auth-split__brand-line">{SITE_BRAND_SHORT}</p>
              </div>
            </div>

            <p className="player-auth-split__description player-auth-split__description--accent">
              {resolvedDescription}
            </p>

            <BrandFeatures />

            <p className="player-auth-split__footnote">{SITE_BRAND_FULL}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
