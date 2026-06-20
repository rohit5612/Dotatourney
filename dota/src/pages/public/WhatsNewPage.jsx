import { Link } from "react-router-dom";
import {
  HiOutlineArrowsRightLeft,
  HiOutlineCreditCard,
  HiOutlineTrophy,
  HiOutlineUserGroup,
  HiOutlineUserPlus,
  HiOutlineIdentification,
} from "react-icons/hi2";
import { CardTierPreviewImage } from "../../components/cards/CardTierPreviewImage.jsx";
import {
  CARD_TIER_COMPARISON_FEATURES,
  CARD_TIER_ORDER,
} from "../../constants/cardTierPreviews.js";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { bundleTotalForTier } from "../../utils/commerceBundle.js";

const WHY_PILLARS = [
  {
    icon: HiOutlineUserGroup,
    title: "By the community",
    copy: "BPCL is player-run at heart. Card bundles let the scene fund itself instead of relying on one-off sponsors or ad-hoc donations.",
  },
  {
    icon: HiOutlineTrophy,
    title: "Grow the prize pool",
    copy: "Your support directly helps us improve the tournament, grow the prize pool, and make BPCL bigger every season.",
  },
  {
    icon: HiOutlineIdentification,
    title: "Build your legacy",
    copy: "Choose your card, support the scene, and carry a season-long identity on your profile, the community directory, and team pages.",
  },
];

const REGISTRATION_STEPS = [
  {
    icon: HiOutlineUserPlus,
    title: "Create your account",
    copy: "Sign up, verify your email, and link Google, Discord, and Steam from your dashboard.",
  },
  {
    icon: HiOutlineCreditCard,
    title: "Register for the season",
    copy: "Complete player details, pick a card bundle, apply BPC coins, and pay online in one checkout flow.",
  },
  {
    icon: HiOutlineUserGroup,
    title: "Substitute pool",
    copy: "When the registration cap is reached, main registration closes and the substitute pool opens — join free with MMR, roles, and availability.",
  },
  {
    icon: HiOutlineArrowsRightLeft,
    title: "Match-day substitutes",
    copy: "Registered players can request a sub before a match (rescind up to 4 hours before start). Admins assign from the pool, matching tier when possible.",
  },
];

function ComparisonTick({ included }) {
  if (included) {
    return (
      <span className="whats-new-page__tick" aria-label="Included">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  return <span className="whats-new-page__dash" aria-hidden="true">—</span>;
}

function SectionHead({ kicker, title, lead, titleId }) {
  return (
    <header className="whats-new-page__section-head">
      {kicker ? <p className="whats-new-page__section-kicker">{kicker}</p> : null}
      <h2 id={titleId} className="whats-new-page__section-title">
        {title}
      </h2>
      {lead ? <p className="whats-new-page__section-lead">{lead}</p> : null}
    </header>
  );
}

export function WhatsNewPage() {
  const { event } = usePublicTournament();
  const commerce = event?.commerce;
  const standardReg = commerce?.registrationFeeRupees ?? 300;
  const tiers = commerce?.cardTiers || {};

  return (
    <div className="community-page-layout whats-new-page">
      <section className="community-page__hero-band whats-new-page__hero" aria-labelledby="whats-new-title">
        <div className="community-page__hero-overlay" aria-hidden="true" />
        <div className="community-page__hero-inner">
          <p className="community-page__eyebrow">Season update</p>
          <h1 id="whats-new-title" className="community-page__hero-title">
            Introducing BPC Cards
          </h1>
          <p className="community-page__hero-lead">
            Your collectible player identity for the {SITE_BRAND_SHORT} season — on profiles, community, and team pages.
          </p>
          <ul className="whats-new-page__hero-chips" aria-label="Card highlights">
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Season duration</span>
              <span className="whats-new-page__hero-chip-value">Valid for one season</span>
            </li>
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Competitive</span>
              <span className="whats-new-page__hero-chip-value">Cosmetic only</span>
            </li>
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Visibility</span>
              <span className="whats-new-page__hero-chip-value">Public profiles</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="community-page whats-new-page__body">
        <section
          className="community-glass community-glass--liquid whats-new-page__panel"
          aria-labelledby="whats-new-compare-title"
        >
          <SectionHead
            kicker="Bundles"
            titleId="whats-new-compare-title"
            title="Compare card bundles"
            lead="Pick a bundle at checkout. Prices below reflect the active season; your dashboard shows the exact total before you pay."
          />

          <div className="whats-new-page__table-wrap">
            <table className="whats-new-page__table">
              <thead>
                <tr>
                  <th scope="col" className="whats-new-page__feature-col">
                    Feature
                  </th>
                  {CARD_TIER_ORDER.map((tierId) => {
                    const tier = tiers[tierId] || {};
                    if (tier.enabled === false) return null;
                    const bundleTotal = tier.bundleTotalRupees ?? bundleTotalForTier(tier, tierId, standardReg);
                    return (
                      <th
                        key={tierId}
                        scope="col"
                        className={`whats-new-page__tier-col whats-new-page__tier-col--${tierId}`}
                      >
                        <div className="whats-new-page__tier-head">
                          <CardTierPreviewImage tier={tierId} size="sm" className="whats-new-page__tier-img" />
                          <span className="whats-new-page__tier-label">{tier.label || tierId}</span>
                          <span className="whats-new-page__tier-price">₹{bundleTotal}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {CARD_TIER_COMPARISON_FEATURES.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="whats-new-page__feature-col">
                      {row.label}
                    </th>
                    {CARD_TIER_ORDER.map((tierId) => {
                      const tier = tiers[tierId] || {};
                      if (tier.enabled === false) return null;
                      return (
                        <td key={tierId} className={`whats-new-page__tier-col whats-new-page__tier-col--${tierId}`}>
                          <ComparisonTick included={Boolean(row.tiers[tierId])} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="whats-new-page__callouts">
            <p className="whats-new-page__callout">
              <span className="whats-new-page__callout-mark">*</span>
              Discord privileges and custom assets are reviewed by admins before going live on your profile.
            </p>
            <p className="whats-new-page__callout whats-new-page__callout--coins">
              <span className="whats-new-page__callout-mark">**</span>
              BPC coin grants: Champion — 200 coins (Holo) / 100 coins (Gold). Runner-up — 100 coins (Holo) / 50 coins (Gold).
            </p>
          </div>
        </section>

        <section
          className="community-glass community-glass--liquid whats-new-page__panel"
          aria-labelledby="whats-new-why-title"
        >
          <SectionHead
            kicker="Community first"
            titleId="whats-new-why-title"
            title="Why we built this"
            lead="Premium cards are cosmetic — but the impact on the league is real."
          />

          <div className="whats-new-page__manifesto">
            <p className="whats-new-page__manifesto-hook">
              🔥 This system is built for the community — by the community.
            </p>
            <p className="whats-new-page__manifesto-body">
              Your support directly helps us improve the tournament, grow the prize pool, and make {SITE_BRAND_SHORT}{" "}
              bigger every season.
            </p>
            <p className="whats-new-page__manifesto-close">
              Choose your card, support the scene, and build your {SITE_BRAND_SHORT} legacy. 👑
            </p>
          </div>

          <div className="whats-new-page__pillar-grid">
            {WHY_PILLARS.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="whats-new-page__pillar">
                <span className="whats-new-page__pillar-icon" aria-hidden="true">
                  <Icon />
                </span>
                <h3 className="whats-new-page__pillar-title">{title}</h3>
                <p className="whats-new-page__pillar-copy">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--accounts"
          aria-labelledby="whats-new-accounts-title"
        >
          <SectionHead
            kicker="Getting started"
            titleId="whats-new-accounts-title"
            title="Player accounts & registration"
            lead="One verified account powers registration, checkout, substitutes, and your public player card."
          />

          <div className="whats-new-page__intro-band">
            <p>
              Link Google, Discord, and Steam, confirm your email, and manage everything from the dashboard. No separate
              OTP forms or manual payment screenshots — tournament registration runs entirely through your account.
            </p>
          </div>

          <ol className="whats-new-page__timeline">
            {REGISTRATION_STEPS.map(({ icon: Icon, title, copy }, index) => (
              <li key={title} className="whats-new-page__timeline-step">
                <div className="whats-new-page__timeline-rail" aria-hidden="true">
                  <span className="whats-new-page__timeline-num">{index + 1}</span>
                  {index < REGISTRATION_STEPS.length - 1 ? <span className="whats-new-page__timeline-line" /> : null}
                </div>
                <article className="whats-new-page__timeline-card">
                  <span className="whats-new-page__timeline-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="whats-new-page__timeline-body">
                    <h3 className="whats-new-page__timeline-title">{title}</h3>
                    <p className="whats-new-page__timeline-copy">{copy}</p>
                  </div>
                </article>
              </li>
            ))}
          </ol>

          <div className="whats-new-page__cta-band">
            <div className="whats-new-page__cta-copy">
              <p className="whats-new-page__cta-eyebrow">Ready to join?</p>
              <p className="whats-new-page__cta-lead">Create your account and lock in your season card at checkout.</p>
            </div>
            <div className="whats-new-page__cta-row">
              <Link to="/register" className="whats-new-page__cta whats-new-page__cta--primary">
                Register for the season
              </Link>
              <Link to="/community" className="whats-new-page__cta">
                Browse community
              </Link>
              <Link to="/rules" className="whats-new-page__cta">
                Read rules
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
