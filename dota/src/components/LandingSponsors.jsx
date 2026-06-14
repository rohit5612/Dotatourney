import { useEffect, useMemo, useRef, useState } from "react";
import { getSponsorsForDisplay } from "../constants/sponsors.js";
import { DEFAULT_SPONSORS_SECTION } from "../utils/seasonContentSchema.js";
import { buildSponsorStageLayout } from "../utils/sponsorStageLayout.js";
import { SponsorCard } from "./SponsorCard.jsx";
import "../styles/landing-sponsors.css";

const PODIUM_ORDER = ["left", "center", "right"];

function isSectionInViewport(el) {
  if (!el || typeof window === "undefined") return false;
  const rect = el.getBoundingClientRect();
  const margin = Math.min(window.innerHeight * 0.12, 96);
  return rect.top < window.innerHeight - margin && rect.bottom > margin;
}

export function LandingSponsors({ sponsorsConfig }) {
  const sponsors = useMemo(() => getSponsorsForDisplay(sponsorsConfig), [sponsorsConfig]);
  const section = sponsorsConfig?.section || DEFAULT_SPONSORS_SECTION;
  const { podium, gallery } = useMemo(() => buildSponsorStageLayout(sponsors), [sponsors]);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reveal = () => setVisible(true);

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return undefined;
    }

    const checkNow = () => {
      if (isSectionInViewport(el)) {
        reveal();
        return true;
      }
      return false;
    };

    if (checkNow()) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (checkNow()) return;
    });

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px 10% 0px" },
    );

    observer.observe(el);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [sponsors.length]);

  if (!sponsors.length) return null;

  const podiumSorted = PODIUM_ORDER.map((position) => podium.find((slot) => slot.position === position)).filter(Boolean);

  return (
    <section
      ref={ref}
      className={`landing-sponsors landing-v2-blue-edges landing-v2-blue-edges--no-top${visible ? " landing-sponsors--in-view" : ""}`}
      aria-labelledby="landing-sponsors-title"
    >
      <div className="landing-sponsors__blend-top" aria-hidden="true" />
      <div className="landing-sponsors__mesh" aria-hidden="true" />
      <div className="landing-sponsors__glow-orb landing-sponsors__glow-orb--left" aria-hidden="true" />
      <div className="landing-sponsors__glow-orb landing-sponsors__glow-orb--right" aria-hidden="true" />

      <div className="landing-sponsors__inner">
        <header className="landing-sponsors__header">
          <p className="landing-sponsors__eyebrow">{section.eyebrow || DEFAULT_SPONSORS_SECTION.eyebrow}</p>
          <h2 id="landing-sponsors-title" className="landing-sponsors__title">
            {section.title || DEFAULT_SPONSORS_SECTION.title}
          </h2>
          <p className="landing-sponsors__subtitle">{section.subtitle || DEFAULT_SPONSORS_SECTION.subtitle}</p>
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
