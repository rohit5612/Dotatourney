import { memo } from "react";
import { FaDiscord, FaFacebook, FaInstagram, FaLinkedin, FaSteam } from "react-icons/fa";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import { getSponsorSocialLinks } from "../constants/sponsors.js";
import "../styles/co-sponsor-spotlight.css";

const SOCIAL_ICONS = {
  instagram: { label: "Instagram", Icon: FaInstagram },
  discord: { label: "Discord", Icon: FaDiscord },
  steam: { label: "Steam", Icon: FaSteam },
  facebook: { label: "Facebook", Icon: FaFacebook },
  linkedin: { label: "LinkedIn", Icon: FaLinkedin },
  website: { label: "Website", Icon: HiOutlineGlobeAlt },
};

function HeroSocialLinks({ sponsor, links }) {
  if (!links.length) return null;
  return (
    <div className="co-sponsor-hero__socials" role="list" aria-label={`${sponsor.name} social links`}>
      {links.map(({ key, url }) => {
        const cfg = SOCIAL_ICONS[key];
        if (!cfg) return null;
        const { label, Icon } = cfg;
        return (
          <a
            key={key}
            role="listitem"
            href={url}
            className={`co-sponsor-hero__social co-sponsor-hero__social--${key}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${sponsor.name} on ${label}`}
          >
            <Icon aria-hidden />
          </a>
        );
      })}
    </div>
  );
}

function InlineSpotlight({ sponsor, links }) {
  const website = links.find((l) => l.key === "website");
  const logo = (
    <img src={sponsor.logoUrl} alt="" className="co-sponsor-spotlight__logo" loading="lazy" decoding="async" />
  );

  return (
    <div className="co-sponsor-spotlight co-sponsor-spotlight--inline" role="group" aria-label={`Co-sponsored by ${sponsor.name}`}>
      <p className="co-sponsor-spotlight__eyebrow">Co-Sponsor</p>
      <div className="co-sponsor-spotlight__main">
        {website ? (
          <a
            href={website.url}
            className="co-sponsor-spotlight__logo-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${sponsor.name} website`}
          >
            {logo}
          </a>
        ) : (
          <span className="co-sponsor-spotlight__logo-link co-sponsor-spotlight__logo-link--static">{logo}</span>
        )}
        <div className="co-sponsor-spotlight__copy">
          <p className="co-sponsor-spotlight__name">{sponsor.name}</p>
        </div>
      </div>
      {links.length ? (
        <div className="co-sponsor-spotlight__socials" role="list">
          {links.map(({ key, url }) => {
            const cfg = SOCIAL_ICONS[key];
            if (!cfg) return null;
            const { label, Icon } = cfg;
            return (
              <a
                key={key}
                role="listitem"
                href={url}
                className={`co-sponsor-spotlight__social co-sponsor-spotlight__social--${key}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${sponsor.name} on ${label}`}
              >
                <Icon aria-hidden />
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{ sponsor: import("../constants/sponsors.js").Sponsor, variant?: "hero" | "inline" }} props
 */
export const CoSponsorSpotlight = memo(function CoSponsorSpotlight({ sponsor, variant = "hero" }) {
  if (!sponsor) return null;

  const links = getSponsorSocialLinks(sponsor);
  const website = links.find((l) => l.key === "website");
  const brandHref = website?.url || links[0]?.url;

  if (variant === "hero") {
    const BrandTag = brandHref ? "a" : "span";
    const brandProps = brandHref
      ? { href: brandHref, target: "_blank", rel: "noopener noreferrer", className: "co-sponsor-hero__brand" }
      : { className: "co-sponsor-hero__brand" };

    return (
      <div className="co-sponsor-hero" role="group" aria-label={`Co-sponsored by ${sponsor.name}`}>
        <p className="co-sponsor-hero__line">
          <span className="co-sponsor-hero__label">Co-sponsored by</span>{" "}
          <BrandTag {...brandProps}>
            <img src={sponsor.logoUrl} alt="" className="co-sponsor-hero__logo" loading="lazy" decoding="async" />
            <span className="co-sponsor-hero__name">{sponsor.name}</span>
          </BrandTag>
        </p>
        <HeroSocialLinks sponsor={sponsor} links={links} />
      </div>
    );
  }

  return <InlineSpotlight sponsor={sponsor} links={links} />;
});
