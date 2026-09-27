import { useState } from "react";
import { Link } from "react-router-dom";

export function WhatsNewSectionHead({ kicker, title, lead, titleId }) {
  return (
    <header className="whats-new-page__section-head whats-new-page__section-head--compact">
      {kicker ? <p className="whats-new-page__section-kicker">{kicker}</p> : null}
      <h2 id={titleId} className="whats-new-page__section-title">
        {title}
      </h2>
      {lead ? <p className="whats-new-page__section-lead">{lead}</p> : null}
    </header>
  );
}

export function WhatsNewKeyPoints({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="whats-new-page__key-points">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ShowcaseImage({ src, alt }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="whats-new-page__showcase-placeholder" role="img" aria-label={alt}>
        Preview unavailable
      </div>
    );
  }
  return (
    <img
      className="whats-new-page__showcase-img"
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

/** @typedef {'standard' | 'wide' | 'banner'} WhatsNewShotFit */

function showcaseCardClassName({ fit = "standard", spanFull = false }) {
  const parts = ["whats-new-page__showcase-card"];
  if (fit === "wide") parts.push("whats-new-page__showcase-card--wide");
  if (fit === "banner") parts.push("whats-new-page__showcase-card--banner");
  if (spanFull) parts.push("whats-new-page__showcase-card--span-full");
  return parts.join(" ");
}

export function WhatsNewShowcaseCard({ src, alt, title, text, fit = "standard", spanFull = false }) {
  return (
    <article className={showcaseCardClassName({ fit, spanFull })}>
      <div className={`whats-new-page__showcase-media whats-new-page__showcase-media--${fit}`}>
        <ShowcaseImage src={src} alt={alt} />
      </div>
      <div className="whats-new-page__showcase-body">
        <h3 className="whats-new-page__showcase-title">{title}</h3>
        {text ? <p className="whats-new-page__showcase-text">{text}</p> : null}
      </div>
    </article>
  );
}

export function WhatsNewShowcaseGrid({ children, columns = 2, className = "" }) {
  const colClass =
    columns === 3 ? " whats-new-page__showcase-grid--cols-3" : columns === 1 ? " whats-new-page__showcase-grid--cols-1" : "";
  return <div className={`whats-new-page__showcase-grid${colClass}${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function WhatsNewSpotlight({ src, alt, title, text, points, fit = "standard" }) {
  return (
    <div className="whats-new-page__spotlight">
      <div className={`whats-new-page__spotlight-media whats-new-page__spotlight-media--${fit}`}>
        <ShowcaseImage src={src} alt={alt} />
      </div>
      <div className="whats-new-page__spotlight-copy">
        {title ? <h3 className="whats-new-page__spotlight-title">{title}</h3> : null}
        {text ? <p className="whats-new-page__spotlight-text">{text}</p> : null}
        <WhatsNewKeyPoints items={points} />
      </div>
    </div>
  );
}

/** @param {{ to: string, label: string, primary?: boolean }[]} links */
export function WhatsNewSectionLinks({ links }) {
  if (!links?.length) return null;
  return (
    <div className="whats-new-page__section-links">
      {links.map(({ to, label, primary }) => (
        <Link
          key={to + label}
          to={to}
          className={`whats-new-page__cta${primary ? " whats-new-page__cta--primary" : ""}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
