import { useEffect, useMemo, useRef, useState } from "react";
import { getSponsorsForDisplay, SPONSORS_SECTION } from "../constants/sponsors.js";
import { buildSponsorStageLayout } from "../utils/sponsorStageLayout.js";
import { SponsorCard } from "./SponsorCard.jsx";
import "../styles/landing-sponsors.css";

const PODIUM_ORDER = ["left", "center", "right"];

export function LandingSponsors() {
  const sponsors = getSponsorsForDisplay();
  const { podium, gallery } = useMemo(() => buildSponsorStageLayout(sponsors), [sponsors]);
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
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!sponsors.length) return null;

  const podiumSorted = PODIUM_ORDER.map((position) => podium.find((slot) => slot.position === position)).filter(Boolean);

  return (
    <section
      ref={ref}
      className={`landing-sponsors${visible ? " landing-sponsors--in-view" : ""}`}
      aria-labelledby="landing-sponsors-title"
    >
      <div className="landing-sponsors__blend-top" aria-hidden="true" />
      <div className="landing-sponsors__mesh" aria-hidden="true" />
      <div className="landing-sponsors__glow-orb landing-sponsors__glow-orb--left" aria-hidden="true" />
      <div className="landing-sponsors__glow-orb landing-sponsors__glow-orb--right" aria-hidden="true" />

      <div className="landing-sponsors__inner">
        <header className="landing-sponsors__header">
          <p className="landing-sponsors__eyebrow">{SPONSORS_SECTION.eyebrow}</p>
          <h2 id="landing-sponsors-title" className="landing-sponsors__title">
            {SPONSORS_SECTION.title}
          </h2>
          <p className="landing-sponsors__subtitle">{SPONSORS_SECTION.subtitle}</p>
          <div className="landing-sponsors__divider" aria-hidden="true" />
        </header>

        {podiumSorted.length ? (
          <div className="landing-sponsors__podium" role="list" aria-label="Featured sponsors">
            {podiumSorted.map((slot, index) => (
              <SponsorCard
                key={slot.sponsor.id}
                sponsor={slot.sponsor}
                size={slot.size}
                layout="podium"
                podiumPosition={slot.position}
                index={index}
              />
            ))}
          </div>
        ) : null}

        {gallery.length ? (
          <div className="landing-sponsors__gallery" role="list" aria-label="Additional sponsors">
            {gallery.map((slot, index) => (
              <SponsorCard
                key={slot.sponsor.id}
                sponsor={slot.sponsor}
                size={slot.size}
                layout="gallery"
                index={podiumSorted.length + index}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
