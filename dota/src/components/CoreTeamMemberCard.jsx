import { memo, useState } from "react";
import { accentCssVars, useLogoAccent } from "../hooks/useLogoAccent.js";
import { useInView } from "../hooks/useInView.js";

function initialsFromTag(gamerTag) {
  const parts = String(gamerTag || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const CoreTeamMemberCard = memo(function CoreTeamMemberCard({ member, index }) {
  const { ref, inView } = useInView({ rootMargin: "120px 0px", threshold: 0.15 });
  const [hovered, setHovered] = useState(false);
  const sampledAccent = useLogoAccent(member.avatarUrl, { enabled: inView || hovered });
  const accentStyle = accentCssVars(sampledAccent);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      ref={ref}
      className={`core-team-card${sampledAccent ? " core-team-card--accent-ready" : ""}`}
      style={{
        ...accentStyle,
        "--core-stagger": index,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="core-team-card__panel">
        <div className="core-team-card__avatar-wrap">
          <span className="core-team-card__ring-outer" aria-hidden />
          <span className="core-team-card__ring" aria-hidden />
          <span className="core-team-card__holo" aria-hidden />
          {imgFailed ? (
            <span className="core-team-card__avatar-fallback" aria-hidden>
              {initialsFromTag(member.gamerTag)}
            </span>
          ) : (
            <img
              src={member.avatarUrl}
              alt=""
              className="core-team-card__avatar"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
        <p className="core-team-card__tag">{member.gamerTag}</p>
        <p className="core-team-card__name">{member.realName}</p>
        {member.role ? <span className="core-team-card__role">{member.role}</span> : null}
      </div>
    </article>
  );
});
