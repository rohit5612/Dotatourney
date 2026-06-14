import { memo, useState } from "react";
import { accentCssVars, useLogoAccent } from "../../hooks/useLogoAccent.js";
import { CoreTeamMemberCard } from "../CoreTeamMemberCard.jsx";
import { ORG_ROSTER_TIER_META } from "../../utils/seasonContentSchema.js";
import "../../styles/landing-core-team.css";

const CORE_TEAM_BG = "/images/coreteam.png";

function initialsFromTag(gamerTag) {
  const parts = String(gamerTag || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MemberAvatar({ member, imgFailed, setImgFailed, variant = "default" }) {
  const showRings = variant !== "compact";

  return (
    <div className={`org-member-card__avatar-wrap${variant !== "default" ? ` org-member-card__avatar-wrap--${variant}` : ""}`}>
      {showRings ? (
        <>
          <span className="org-member-card__avatar-ring-outer" aria-hidden />
          <span className="org-member-card__avatar-ring" aria-hidden />
          <span className="org-member-card__holo" aria-hidden />
        </>
      ) : null}
      {imgFailed ? (
        <span className="org-member-card__fallback" aria-hidden>
          {initialsFromTag(member.gamerTag)}
        </span>
      ) : (
        <img
          src={member.avatarUrl}
          alt=""
          className="org-member-card__avatar"
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

export const OrgMemberCard = memo(function OrgMemberCard({ member, size = "admin", index = 0 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const isFounder = size === "founder";
  const isCompact = size === "compact";

  const sampledAccent = useLogoAccent(member.avatarUrl, { enabled: true });
  const accentStyle = {
    ...accentCssVars(sampledAccent),
    "--org-card-stagger": index,
  };

  const rootClass = [
    "org-member-card",
    `org-member-card--${size}`,
    isCompact ? "landing-v2-glass" : "",
    sampledAccent ? "org-member-card--accent-ready" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardProps = {
    className: rootClass,
    style: accentStyle,
  };

  const avatarProps = { member, imgFailed, setImgFailed };

  if (isFounder) {
    return (
      <article {...cardProps}>
        <div className="org-member-card__panel org-member-card__panel--founder">
          <div className="org-member-card__founder-bg" aria-hidden>
            {!imgFailed ? (
              <img
                src={member.avatarUrl}
                alt=""
                className="org-member-card__founder-bg-logo"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <div className="org-member-card__founder-bg-gradient" />
            <div className="org-member-card__founder-bg-aurora" />
          </div>
          <div className="org-member-card__founder-frame" aria-hidden />
          <div className="org-member-card__founder-body">
            <MemberAvatar {...avatarProps} variant="founder" />
            <p className="org-member-card__tag">{member.gamerTag}</p>
            <p className="org-member-card__name">{member.realName}</p>
            {member.role ? <span className="org-member-card__role">{member.role}</span> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article {...cardProps}>
      <MemberAvatar {...avatarProps} variant="compact" />
      <p className="org-member-card__tag">{member.gamerTag}</p>
      <p className="org-member-card__name">{member.realName}</p>
      {member.role ? <span className="org-member-card__role">{member.role}</span> : null}
    </article>
  );
});

export function LandingOrgRoster({ orgRoster }) {
  const members = orgRoster?.members || [];
  if (!members.length) return null;

  const byTier = {
    founder: members.filter((m) => m.tier === "founder"),
    admin: members.filter((m) => m.tier === "admin"),
    mod: members.filter((m) => m.tier === "mod"),
    caster: members.filter((m) => m.tier === "caster"),
  };

  const section = orgRoster?.section || {};

  return (
    <section className="landing-v2 landing-v2-section landing-v2-roster landing-v2-blue-edges" aria-labelledby="landing-org-roster">
      <div className="landing-v2-roster__bg" aria-hidden="true">
        <img
          src={CORE_TEAM_BG}
          alt=""
          className="landing-v2-roster__bg-image"
          loading="lazy"
          decoding="async"
        />
        <div className="landing-v2-roster__bg-overlay" />
      </div>
      <div className="landing-v2-section__inner landing-v2-roster__inner">
        {section.eyebrow ? <p className="landing-v2-section__eyebrow">{section.eyebrow}</p> : null}
        {section.title ? (
          <h2 id="landing-org-roster" className="landing-v2-section__title">
            {section.title}
          </h2>
        ) : null}

        {byTier.founder.length ? (
          <div className="landing-v2-roster__tier landing-v2-roster__tier--founder">
            <h3 className="landing-v2-roster__tier-label">{ORG_ROSTER_TIER_META.founder.label}</h3>
            <div className="landing-v2-roster__founders">
              {byTier.founder.map((member, index) => (
                <OrgMemberCard key={member.id} member={member} size="founder" index={index} />
              ))}
            </div>
          </div>
        ) : null}

        {byTier.admin.length ? (
          <div className="landing-v2-roster__tier landing-v2-roster__tier--admin">
            <h3 className="landing-v2-roster__tier-label">{ORG_ROSTER_TIER_META.admin.label}</h3>
            <div className="landing-v2-roster__admins landing-core-team__track-wrap landing-core-team--in-view">
              <div className="landing-core-team__track" role="list">
                {byTier.admin.map((member, index) => (
                  <CoreTeamMemberCard key={member.id} member={member} index={index} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {byTier.mod.length ? (
          <div className="landing-v2-roster__tier landing-v2-roster__tier--mod">
            <h3 className="landing-v2-roster__tier-label">{ORG_ROSTER_TIER_META.mod.label}</h3>
            <div className="landing-v2-roster__compact">
              {byTier.mod.map((member, index) => (
                <OrgMemberCard key={member.id} member={member} size="compact" index={index} />
              ))}
            </div>
          </div>
        ) : null}

        {byTier.caster.length ? (
          <div className="landing-v2-roster__tier landing-v2-roster__tier--caster">
            <h3 className="landing-v2-roster__tier-label">{ORG_ROSTER_TIER_META.caster.label}</h3>
            <div className="landing-v2-roster__compact">
              {byTier.caster.map((member, index) => (
                <OrgMemberCard key={member.id} member={member} size="compact" index={index} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
