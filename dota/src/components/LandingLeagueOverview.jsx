import { useEffect, useRef, useState } from "react";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../constants/siteMeta.js";

const OVERVIEW_BG = "/images/overview.jpg";

/** Stagger index is set per item for reveal animation delay. */
const REVEAL_LINES = [
  {
    id: "brand",
    text: SITE_BRAND_FULL,
    className:
      "font-serif text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl",
    revealIndex: 0,
  },
  {
    id: "circuit",
    text: `${SITE_BRAND_SHORT} is India's community-run Dota 2 league.`,
    className:
      "font-serif text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]",
    revealIndex: 1,
  },
  {
    id: "mission",
    text: "We host structured seasons for players who want a real competitive lane—clear rules, published brackets, and standings you can follow from registration through the finals.",
    className: "max-w-3xl text-base font-medium leading-relaxed text-foreground/92 sm:text-lg md:text-xl md:leading-relaxed",
    revealIndex: 2,
  },
  {
    id: "community",
    text: "BPC is built for the Indian Dota community: open sign-ups, Discord as the player hub, and admins who draft approved players onto teams before the bracket goes live.",
    className: "max-w-3xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg md:text-xl md:leading-relaxed",
    revealIndex: 3,
  },
  {
    id: "play",
    text: "Register solo or with your stack. Lock your roster, play your series, and climb—whether you are chasing a prize pool spot or your first proper circuit run.",
    className: "max-w-3xl text-base font-medium leading-relaxed text-foreground/88 sm:text-lg md:leading-relaxed",
    revealIndex: 4,
  },
  {
    id: "pitch",
    text: "Open registration. Real brackets. A stage worth showing up for.",
    className:
      "max-w-3xl pt-1 font-serif text-xl font-semibold leading-snug tracking-tight text-secondary sm:text-2xl md:text-3xl",
    revealIndex: 5,
  },
];

export function LandingLeagueOverview() {
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
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`landing-overview relative left-1/2 flex min-h-svh w-screen -translate-x-1/2 scroll-mt-20 flex-col overflow-hidden${visible ? " landing-overview--visible" : ""}`}
      aria-labelledby="landing-league-overview-heading"
    >
      <div className="landing-overview__top-fade" aria-hidden="true" />

      <div className="landing-overview__media" aria-hidden="true">
        <img src={OVERVIEW_BG} alt="" className="landing-overview__img" loading="lazy" decoding="async" />
        <div className="landing-overview__shade landing-overview__shade--base" />
        <div className="landing-overview__shade landing-overview__shade--vignette" />
        <div className="landing-overview__shade landing-overview__shade--warm" />
      </div>

      <div className="landing-overview__content relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-20 sm:px-6 md:py-24">
        <p
          id="landing-league-overview-heading"
          className="landing-overview__eyebrow mb-8 text-xs font-semibold uppercase tracking-[0.28em] text-secondary sm:mb-10 sm:tracking-[0.34em]"
          style={{ "--landing-reveal-i": 0 }}
        >
          <span className="landing-overview__line-inner">What is BPC League?</span>
        </p>

        <div className="landing-overview__lines space-y-5 sm:space-y-6 md:space-y-7">
          {REVEAL_LINES.map((line) => (
            <p
              key={line.id}
              className={`landing-overview__line ${line.className}`}
              style={{ "--landing-reveal-i": line.revealIndex + 1 }}
            >
              <span className="landing-overview__line-inner">{line.text}</span>
            </p>
          ))}
        </div>
      </div>

      <div className="landing-overview__waterfall" aria-hidden="true" />
    </section>
  );
}
