import { useEffect, useMemo, useState } from "react";
import {
  formatTournamentDisplayDate,
  getTournamentDayPhase,
  getTournamentStatusCopy,
  parseTournamentStartInstant,
} from "../utils/tournamentStatus.js";
import "../styles/landing-countdown.css";

const BRACKET_SCHEDULE_PATH = "/schedule";

const DEFAULT_START = "2026-05-22T00:00:00+05:30";

function CountdownUnits({ targetTime }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetTime - Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, targetTime - Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetTime]);

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const units = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];

  return (
    <div className="landing-countdown__units" role="timer" aria-live="polite">
      {units.map((unit) => (
        <div key={unit.label} className="landing-countdown__unit">
          <div className="landing-countdown__unit-value">{String(unit.value).padStart(2, "0")}</div>
          <div className="landing-countdown__unit-label">{unit.label}</div>
        </div>
      ))}
    </div>
  );
}

function LiveStatusHint({ navigate }) {
  function go(event) {
    event.preventDefault();
    if (navigate) navigate(BRACKET_SCHEDULE_PATH);
    else window.location.assign(BRACKET_SCHEDULE_PATH);
  }

  return (
    <p className="landing-countdown__hint">
      Match results, brackets, and start times — see the{" "}
      <a className="landing-countdown__hint-link" href={BRACKET_SCHEDULE_PATH} onClick={go}>
        Bracket &amp; Schedule
      </a>{" "}
      page.
    </p>
  );
}

export function LandingTournamentStatus({ startDate, endDate, fallbackStart = DEFAULT_START, navigate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const phase = useMemo(
    () => getTournamentDayPhase(startDate, endDate, new Date(now)),
    [startDate, endDate, now],
  );

  const targetTime = useMemo(
    () => parseTournamentStartInstant(startDate, fallbackStart)?.getTime() ?? Date.now(),
    [startDate, fallbackStart],
  );

  const displayDate = formatTournamentDisplayDate(startDate, fallbackStart);
  const copy = getTournamentStatusCopy(phase);

  return (
    <div className="landing-countdown">
      <article className="landing-panel landing-countdown__panel" aria-labelledby="landing-countdown-date">
        <header className="landing-countdown__head">
          <p className="landing-countdown__eyebrow">{copy.eyebrow}</p>
          <span className={`landing-countdown__badge landing-countdown__badge--${phase}`}>
            <span className="landing-countdown__badge-dot" aria-hidden />
            {copy.statusLabel}
          </span>
        </header>

        <h3 id="landing-countdown-date" className="landing-countdown__date">
          {displayDate}
        </h3>
        {phase === "live" ? (
          <LiveStatusHint navigate={navigate} />
        ) : copy.statusHint ? (
          <p className="landing-countdown__hint">{copy.statusHint}</p>
        ) : null}

        {phase === "upcoming" ? <CountdownUnits targetTime={targetTime} /> : null}

        {phase === "live" ? (
          <div className="landing-countdown__live-hero" role="status">
            <p className="landing-countdown__live-label">Live</p>
            <p className="landing-countdown__live-sub">The arena is open — follow the bracket and today&apos;s schedule</p>
          </div>
        ) : null}

        {phase === "completed" ? (
          <p className="landing-countdown__completed" role="status">
            The scheduled tournament window has ended.
          </p>
        ) : null}
      </article>
    </div>
  );
}
