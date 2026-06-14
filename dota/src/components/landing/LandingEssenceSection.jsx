import { Link } from "react-router-dom";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import "../../styles/landing-circuit.css";

const CIRCUIT_BG = "/images/overview.jpg";

const REGISTRATION_STEPS = [
  {
    id: "account",
    label: "Create account",
    hint: "One player profile",
    to: "/signup",
  },
  {
    id: "wait",
    label: "Wait for go-live",
    hint: "Reg opens with the season",
  },
  {
    id: "register",
    label: "Register via account",
    hint: "Apply when slots open",
    to: "/register",
  },
];

const CIRCUIT_PILLARS = [
  {
    id: "mmr",
    title: "All MMR",
    tag: "Herald → Immortal",
    visual: "mmr",
  },
  {
    id: "solo",
    title: "Solo sign-up",
    tag: "No pre-made stacks",
    visual: "solo",
  },
  {
    id: "draft",
    title: "Snake draft",
    tag: "Admins pick captains · captains draft",
    visual: "snake",
  },
  {
    id: "planned",
    title: "Planned seasons",
    tag: "Formats mapped before horn",
    visual: "season",
  },
  {
    id: "equity",
    title: "Equity over equality",
    tag: "Rewards match role & impact",
    visual: "equity",
  },
  {
    id: "broadcast",
    title: "Live streamed",
    tag: "Every match on broadcast",
    visual: "stream",
  },
];

function RegistrationStepIcon({ stepId }) {
  if (stepId === "account") {
    return (
      <svg viewBox="0 0 48 48" className="landing-circuit__step-svg" aria-hidden>
        <circle cx="24" cy="17" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 40c0-8 6-14 14-14s14 6 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="14" r="7" fill="rgb(251 191 36)" />
        <path d="M36 11v6M33 14h6" stroke="rgb(4 8 11)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (stepId === "wait") {
    return (
      <svg viewBox="0 0 48 48" className="landing-circuit__step-svg" aria-hidden>
        <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M24 14v11l7 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2.5" fill="currentColor" />
        <circle className="landing-circuit__pulse" cx="38" cy="12" r="4" fill="rgb(251 191 36)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="landing-circuit__step-svg" aria-hidden>
      <rect x="10" y="8" width="28" height="32" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 18h16M16 24h11M16 30h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <circle cx="34" cy="32" r="9" fill="rgb(52 211 153)" />
      <path d="M31 32l2 2 5-5" fill="none" stroke="rgb(4 8 11)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PillarVisual({ type }) {
  if (type === "mmr") {
    return (
      <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
        {[10, 18, 26, 34, 42].map((h, i) => (
          <rect
            key={h}
            x={14 + i * 20}
            y={48 - h}
            width="14"
            height={h}
            rx="3"
            fill={`rgb(52 211 153 / ${0.28 + i * 0.14})`}
          />
        ))}
        <path d="M8 48h104" stroke="rgb(255 255 255 / 0.2)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "solo") {
    return (
      <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
        {[18, 42, 66, 90].map((x) => (
          <circle key={x} cx={x} cy="28" r="10" fill="rgb(255 255 255 / 0.08)" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1.5" />
        ))}
        <circle cx="54" cy="28" r="14" fill="rgb(251 191 36 / 0.25)" stroke="rgb(251 191 36)" strokeWidth="2" />
        <circle cx="54" cy="28" r="5" fill="rgb(251 191 36)" />
      </svg>
    );
  }

  if (type === "snake") {
    return (
      <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
        <text x="18" y="14" fill="rgb(167 243 208 / 0.8)" fontSize="8" fontWeight="700">
          CAP A
        </text>
        <text x="88" y="14" fill="rgb(167 243 208 / 0.8)" fontSize="8" fontWeight="700">
          CAP B
        </text>
        {[
          [18, 24, "1"],
          [102, 24, "2"],
          [18, 36, "4"],
          [102, 36, "3"],
          [18, 48, "5"],
          [102, 48, "6"],
        ].map(([x, y, n]) => (
          <g key={n}>
            <circle cx={x} cy={y} r="7" fill="rgb(6 14 18)" stroke="rgb(110 231 183 / 0.7)" strokeWidth="1.5" />
            <text x={x} y={y + 3} textAnchor="middle" fill="rgb(167 243 208)" fontSize="7" fontWeight="700">
              {n}
            </text>
          </g>
        ))}
        <path
          d="M25 24 H42 Q60 24 60 30 T78 36 H95 M25 36 H42 Q60 36 60 42 T78 48 H95"
          fill="none"
          stroke="rgb(251 191 36 / 0.75)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "season") {
    return (
      <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
        <path d="M12 40h96" stroke="rgb(255 255 255 / 0.15)" strokeWidth="2" strokeLinecap="round" />
        {[20, 44, 68, 92, 108].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="40" r={i === 2 ? 6 : 4} fill={i === 2 ? "rgb(52 211 153)" : "rgb(255 255 255 / 0.35)"} />
            <rect x={x - 8} y={22 - i * 2} width="16" height={10 + i * 2} rx="2" fill={`rgb(52 211 153 / ${0.12 + i * 0.08})`} />
          </g>
        ))}
      </svg>
    );
  }

  if (type === "equity") {
    return (
      <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
        <rect x="16" y="14" width="36" height="28" rx="6" fill="rgb(251 191 36 / 0.2)" stroke="rgb(251 191 36 / 0.65)" strokeWidth="1.5" />
        <text x="34" y="31" textAnchor="middle" fill="rgb(251 191 36)" fontSize="8" fontWeight="700">
          CORE
        </text>
        <rect x="68" y="20" width="36" height="22" rx="6" fill="rgb(52 211 153 / 0.18)" stroke="rgb(52 211 153 / 0.55)" strokeWidth="1.5" />
        <text x="86" y="34" textAnchor="middle" fill="rgb(110 231 183)" fontSize="8" fontWeight="700">
          SUP
        </text>
        <path d="M52 28h16" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 56" className="landing-circuit__viz" aria-hidden>
      <circle cx="60" cy="28" r="10" fill="rgb(239 68 68)" />
      <circle cx="60" cy="28" r="4" fill="rgb(255 255 255 / 0.9)" />
      <path d="M28 28c8-10 16-10 24 0s16 10 24 0" fill="none" stroke="rgb(52 211 153 / 0.55)" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 28c10-14 20-14 30 0s20 14 30 0" fill="none" stroke="rgb(52 211 153 / 0.3)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LandingEssenceSection() {
  return (
    <section className="landing-circuit landing-v2-blue-edges" aria-labelledby="landing-circuit-title">
      <div className="landing-circuit__bg" aria-hidden="true">
        <img src={CIRCUIT_BG} alt="" className="landing-circuit__bg-image" loading="lazy" decoding="async" />
        <div className="landing-circuit__bg-overlay" />
        <div className="landing-circuit__bg-scrim-left" />
      </div>

      <div className="landing-circuit__shell">
        <div className="landing-circuit__grid">
          <div className="landing-circuit__manifest">
          <p className="landing-circuit__eyebrow">The circuit</p>
          <h2 id="landing-circuit-title" className="landing-circuit__title">
            Built for players who want a <span className="landing-circuit__title-accent">real lane</span>
          </h2>
          <p className="landing-circuit__brand">{SITE_BRAND_SHORT} · India&apos;s structured Dota league</p>

          <div className="landing-circuit__solo-panel">
            <div className="landing-circuit__solo-head">
              <span className="landing-circuit__solo-badge">Solo only</span>
              <p className="landing-circuit__solo-title">Register as a player</p>
            </div>

            <ol className="landing-circuit__flow" aria-label="How player registration works">
              {REGISTRATION_STEPS.map((step, index) => (
                <li key={step.id} className="landing-circuit__flow-step">
                  <div className="landing-circuit__flow-icon-wrap">
                    <RegistrationStepIcon stepId={step.id} />
                    <span className="landing-circuit__flow-num" aria-hidden>
                      {index + 1}
                    </span>
                  </div>
                  <div className="landing-circuit__flow-copy">
                    <p className="landing-circuit__flow-label">{step.label}</p>
                    <p className="landing-circuit__flow-hint">{step.hint}</p>
                  </div>
                  {index < REGISTRATION_STEPS.length - 1 ? (
                    <span className="landing-circuit__flow-connector" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>

            <p className="landing-circuit__solo-note">
              Registration always runs through your account — not a one-off form.
            </p>

            <div className="landing-circuit__solo-actions">
              <Link to="/signup" className="landing-circuit__solo-cta landing-circuit__solo-cta--primary">
                Create your account
              </Link>
              <Link to="/register" className="landing-circuit__solo-cta landing-circuit__solo-cta--ghost">
                Registration page
              </Link>
            </div>
          </div>
        </div>

        <div className="landing-circuit__pillar-grid" role="list" aria-label="What defines the circuit">
          {CIRCUIT_PILLARS.map((pillar) => (
            <article key={pillar.id} className="landing-circuit__pillar" role="listitem">
              <div className="landing-circuit__pillar-viz" aria-hidden>
                <PillarVisual type={pillar.visual} />
              </div>
              <div className="landing-circuit__pillar-body">
                <h3>{pillar.title}</h3>
                <p>{pillar.tag}</p>
              </div>
            </article>
          ))}
        </div>
        </div>

        <div className="landing-circuit__about">
          <h3 className="landing-circuit__about-title">What is {SITE_BRAND_SHORT}?</h3>
          <p className="landing-circuit__about-lead">
            <strong>{SITE_BRAND_FULL}</strong> ({SITE_BRAND_SHORT}) is India&apos;s community-run Dota 2 league — structured
            seasons with clear rules, published brackets, standings, and schedules from registration through the finals.
          </p>
          <p className="landing-circuit__about-copy">
            Open to every rank. You register solo through your account; admins assign captains and captains draft teams in
            snake-draft order. Discord is the player hub, admins keep series on schedule, and every match is live-streamed
            with broadcast production built for a serious amateur circuit.
          </p>
        </div>
      </div>
    </section>
  );
}
