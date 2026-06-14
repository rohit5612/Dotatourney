import { memo, useState } from "react";
import { FaDiscord, FaFacebook, FaInstagram, FaLinkedin, FaSteam, FaYoutube } from "react-icons/fa";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import { accentCssVars, useLogoAccent } from "../hooks/useLogoAccent.js";
import { sponsorTierLabel } from "../constants/sponsors.js";
import "../styles/landing-sponsors.css";

const SOCIAL_CONFIG = [
  { key: "website", label: "Website", Icon: HiOutlineGlobeAlt },
  { key: "youtube", label: "YouTube", Icon: FaYoutube },
  { key: "instagram", label: "Instagram", Icon: FaInstagram },
  { key: "discord", label: "Discord", Icon: FaDiscord },
  { key: "steam", label: "Steam", Icon: FaSteam },
  { key: "facebook", label: "Facebook", Icon: FaFacebook },
  { key: "linkedin", label: "LinkedIn", Icon: FaLinkedin },
];

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const SponsorCard = memo(function SponsorCard({
  sponsor,
  size = "medium",
  layout = "gallery",
  podiumPosition = null,
  index = 0,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const sampledAccent = useLogoAccent(sponsor.logoUrl, { enabled: true });
  const accentStyle = accentCssVars(sampledAccent);
  const socials = sponsor.socials || {};
  const links = SOCIAL_CONFIG.filter(({ key }) => {
    const url = socials[key];
    return typeof url === "string" && url.trim().length > 0;
  });
  const tierLabel = sponsor.tier === "co" ? sponsorTierLabel(sponsor) : null;

  return (
    <article
      className={`sponsor-card sponsor-card--${size} sponsor-card--${layout}${podiumPosition ? ` sponsor-card--${podiumPosition}` : ""}${sponsor.tier === "co" ? " sponsor-card--co" : ""}${sampledAccent ? " sponsor-card--accent-ready" : ""}`}
      style={{
        ...accentStyle,
        "--sponsor-stagger": index,
      }}
    >
      <div className="sponsor-card__frame">
        <div className="sponsor-card__brand">
          {tierLabel ? <span className="sponsor-card__tier-badge">{tierLabel}</span> : null}
          <div className="sponsor-card__logo-wrap">
            <span className="sponsor-card__logo-glow" aria-hidden />
            {imgFailed ? (
              <span className="sponsor-card__logo-fallback" aria-hidden>
                {initialsFromName(sponsor.name)}
              </span>
            ) : (
              <img
                src={sponsor.logoUrl}
                alt=""
                className="sponsor-card__logo"
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
        </div>
        <h3 className="sponsor-card__name">{sponsor.name}</h3>
        {sponsor.tagline ? <p className="sponsor-card__tagline">{sponsor.tagline}</p> : null}
        {links.length ? (
          <div className="sponsor-card__socials" role="list">
            {links.map(({ key, label, Icon }) => (
              <a
                key={key}
                role="listitem"
                href={socials[key].trim()}
                className={`sponsor-card__social-link sponsor-card__social-link--${key}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${sponsor.name} on ${label}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Icon aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});
