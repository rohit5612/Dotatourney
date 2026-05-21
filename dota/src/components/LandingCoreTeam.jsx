import { useEffect, useRef, useState } from "react";
import { CORE_TEAM_SECTION, getCoreTeamForDisplay } from "../constants/coreTeam.js";
import { CoreTeamMemberCard } from "./CoreTeamMemberCard.jsx";
import "../styles/landing-core-team.css";

const CORE_TEAM_BG = "/images/coreteam.png";

export function LandingCoreTeam() {
  const members = getCoreTeamForDisplay();
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!members.length) return null;

  return (
    <section
      ref={ref}
      className={`landing-core-team${visible ? " landing-core-team--in-view" : ""}`}
      aria-labelledby="landing-core-team-title"
    >
      <div className="landing-core-team__top-fade" aria-hidden="true" />
      <div className="landing-core-team__bg" aria-hidden="true">
        <img
          src={CORE_TEAM_BG}
          alt=""
          className="landing-core-team__bg-image"
          loading="lazy"
          decoding="async"
        />
        <div className="landing-core-team__bg-overlay" />
        <span className="landing-core-team__bg-sweep" />
      </div>

      <div className="landing-core-team__inner">
        <header className="landing-core-team__header">
          <p className="landing-core-team__eyebrow">{CORE_TEAM_SECTION.eyebrow}</p>
          <h2 id="landing-core-team-title" className="landing-core-team__title">
            {CORE_TEAM_SECTION.title}
          </h2>
          <p className="landing-core-team__subtitle">{CORE_TEAM_SECTION.subtitle}</p>
          <div className="landing-core-team__divider" aria-hidden="true" />
        </header>

        <div className="landing-core-team__track-wrap">
          <div className="landing-core-team__track" role="list">
            {members.map((member, index) => (
              <CoreTeamMemberCard key={member.id} member={member} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
