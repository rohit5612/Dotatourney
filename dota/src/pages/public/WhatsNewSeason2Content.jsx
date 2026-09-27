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
  cardTierDisplayLabel,
} from "../../constants/cardTierPreviews.js";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { bundleTotalForTier } from "../../utils/commerceBundle.js";
import { WhatsNewSectionHead, WhatsNewSectionLinks } from "./whatsNewShared.jsx";

const WHY_PILLARS = [
  {
    icon: HiOutlineUserGroup,
    title: "Community-funded",
    copy: "Card bundles help the scene fund seasons without one-off sponsors.",
  },
  {
    icon: HiOutlineTrophy,
    title: "Prize pool",
    copy: "Checkout support grows the pool and improves each campaign.",
  },
  {
    icon: HiOutlineIdentification,
    title: "Your identity",
    copy: "Tier, art, and profile presence across directory and team pages.",
  },
];

const REGISTRATION_STEPS = [
  {
    icon: HiOutlineUserPlus,
    title: "Create account",
    copy: "Verify email; link Google, Discord, and Steam.",
  },
  {
    icon: HiOutlineCreditCard,
    title: "Register & checkout",
    copy: "Player details, card bundle, BPC coins, UPI from the dashboard.",
  },
  {
    icon: HiOutlineUserGroup,
    title: "Substitute pool",
    copy: "After the cap, mains close — join the pool with MMR and roles.",
  },
  {
    icon: HiOutlineArrowsRightLeft,
    title: "Match-day subs",
    copy: "Request a sub before matches; admins assign from the pool.",
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
  return (
    <span className="whats-new-page__dash" aria-hidden="true">
      —
    </span>
  );
}

export function WhatsNewSeason2Content() {
  const { event } = usePublicTournament();
  const commerce = event?.commerce;
  const standardReg = commerce?.registrationFeeRupees ?? 300;
  const tiers = commerce?.cardTiers || {};

  return (
    <div className="whats-new-page__version-inner whats-new-page__version-inner--visual">
      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-compare-title"
      >
        <WhatsNewSectionHead
          kicker="Bundles"
          titleId="whats-new-compare-title"
          title="Compare card tiers"
          lead="Prices follow the active season — your dashboard shows the exact total before payment."
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
                        <span className="whats-new-page__tier-label">{tier.label || cardTierDisplayLabel(tierId)}</span>
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

        <ul className="whats-new-page__key-points whats-new-page__key-points--compact">
          <li>Discord perks and custom assets are admin-reviewed before going live.</li>
          <li>BPC coin grants: Champion 200 (Holo) / 100 (Gold); Runner-up 100 / 50.</li>
        </ul>
      </section>

      <section
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-why-title"
      >
        <WhatsNewSectionHead
          kicker="Why cards"
          titleId="whats-new-why-title"
          title={`Support ${SITE_BRAND_SHORT}`}
          lead="Premium cards are cosmetic — checkout helps fund the league you play in."
        />

        <div className="whats-new-page__pillar-grid whats-new-page__pillar-grid--tight">
          {WHY_PILLARS.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="whats-new-page__pillar whats-new-page__pillar--compact">
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
        className="community-glass community-glass--liquid whats-new-page__panel whats-new-page__panel--visual"
        aria-labelledby="whats-new-accounts-title"
      >
        <WhatsNewSectionHead
          kicker="Getting started"
          titleId="whats-new-accounts-title"
          title="Accounts & registration"
          lead="One verified account for checkout, substitutes, and your public card."
        />

        <ol className="whats-new-page__timeline whats-new-page__timeline--compact">
          {REGISTRATION_STEPS.map(({ icon: Icon, title, copy }, index) => (
            <li key={title} className="whats-new-page__timeline-step">
              <div className="whats-new-page__timeline-rail" aria-hidden="true">
                <span className="whats-new-page__timeline-num">{index + 1}</span>
                {index < REGISTRATION_STEPS.length - 1 ? <span className="whats-new-page__timeline-line" /> : null}
              </div>
              <article className="whats-new-page__timeline-card whats-new-page__timeline-card--compact">
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

        <WhatsNewSectionLinks
          links={[
            { to: "/register", label: "Register", primary: true },
            { to: "/community", label: "Community" },
            { to: "/rules", label: "Rules" },
          ]}
        />
      </section>
    </div>
  );
}
