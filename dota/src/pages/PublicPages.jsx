import { useEffect, useMemo, useRef, useState } from "react";
import { roles } from "../constants/tournament";
import { api } from "../lib/api";

const tournamentSlug = "the-forge";
const defaultTournamentStart = "2026-05-22T00:00:00+05:30";

function formatDate(value) {
  if (!value) return "TBA";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeAnnouncements(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return [];
}

const formatNameMap = {
  dse: "Double Elimination",
  se: "Single Elimination",
  gsl: "GSL Groups",
  rr: "Round Robin",
  swiss: "Swiss System",
  hybrid: "Group + Playoffs",
};

function getFormatName(format) {
  const key = String(format || "").toLowerCase();
  return formatNameMap[key] || "Double Elimination";
}

function parsePrizePool(value) {
  const text = String(value || "").trim();
  const match = text.match(/[\d,]+/);
  if (!match) return null;
  const amount = Number(match[0].replaceAll(",", ""));
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    prefix: text.slice(0, match.index),
    suffix: text.slice((match.index || 0) + match[0].length),
  };
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-IN");
}

function PublicHeader({ path, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const links = [
    ["/", "Home"],
    ["/tournament", "Tournament"],
    ["/schedule", "Bracket & schedule"],
    ["/register", "Register"],
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 transition-all duration-300 ${
        scrolled ? "border-b border-border bg-background/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:py-4">
        <button type="button" className="group flex w-fit items-center gap-3 text-left transition-transform duration-300 hover:-translate-y-0.5" onClick={() => navigate("/")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 font-serif text-lg text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            F
          </span>
          <span>
            <h1 className="font-serif text-xl tracking-wide text-primary transition-colors duration-300 group-hover:text-red-400">The Forge</h1>
            <p className="text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground">Dota tournament platform</p>
          </span>
        </button>
        <nav
          className={`mx-auto flex w-full flex-wrap justify-center gap-1 rounded-2xl border px-2 py-1 transition-all duration-300 sm:w-fit sm:rounded-full ${
            scrolled ? "border-border bg-card/85 shadow-lg backdrop-blur-xl" : "border-transparent bg-transparent"
          }`}
        >
          {links.map(([href, label]) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={`rounded-full border px-3 py-1 text-xs transition-all duration-300 hover:-translate-y-0.5 sm:text-sm ${
                path === href
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex justify-center md:justify-end">
          <button
            type="button"
            className={`w-full rounded-full border px-5 py-2 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg sm:w-auto ${
              scrolled ? "border-border/80 bg-card/40" : "border-transparent bg-transparent"
            }`}
            onClick={() => navigate("/admin")}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  );
}

function EventShell({ path, navigate, children }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader path={path} navigate={navigate} />
      <section className={path === "/" ? "space-y-20" : "mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-28"}>{children}</section>
    </main>
  );
}

export function PublicApp({ path, navigate }) {
  const [event, setEvent] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getPublicTournament(tournamentSlug)
      .then((payload) => {
        if (active) setEvent(payload);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (path === "/register") {
    return (
      <EventShell path={path} navigate={navigate}>
        <RegistrationPage event={event} setEvent={setEvent} message={message} setMessage={setMessage} />
      </EventShell>
    );
  }

  if (path === "/schedule") {
    return (
      <EventShell path={path} navigate={navigate}>
        <PublicSchedule event={event} message={message} />
      </EventShell>
    );
  }

  if (path === "/tournament") {
    return (
      <EventShell path={path} navigate={navigate}>
        <TournamentInfo event={event} message={message} />
      </EventShell>
    );
  }

  return (
    <EventShell path={path} navigate={navigate}>
      <LandingPage event={event} navigate={navigate} message={message} />
    </EventShell>
  );
}

function LandingPage({ event, navigate, message }) {
  const tournament = event?.tournament;
  const announcements = normalizeAnnouncements(tournament?.announcements);
  return (
    <>
      {message ? <p className="mx-auto mt-4 max-w-6xl rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 md:py-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#b8141433_0%,transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#09090c_100%)]" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-secondary sm:tracking-[0.35em]">Dota 2 community tournament</p>
          <h2 className="font-serif text-5xl tracking-wide text-primary sm:text-6xl md:text-7xl">The Forge</h2>
          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Forge your squad, prove your coordination, and compete in a clean, high-stakes Dota tournament format.
          </p>
          <div className="w-full max-w-sm rounded-xl border border-primary/40 bg-card/60 px-6 py-5 shadow-2xl backdrop-blur sm:px-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Prize pool</p>
            <AnimatedPrizePool value={tournament?.prize_pool || "TBA"} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="w-full rounded-md bg-primary px-6 py-3 text-base text-primary-foreground shadow-lg sm:w-auto" onClick={() => navigate("/register")}>
              Register now
            </button>
            {tournament?.discord_url ? (
              <a className="w-full rounded-md border border-border px-6 py-3 text-center text-base sm:w-auto" href={tournament.discord_url} target="_blank" rel="noreferrer">
                Join Discord
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <RevealSection>
        <section className="mx-auto max-w-6xl space-y-4 px-4">
          <div className="mx-auto max-w-xl rounded-2xl border border-primary/30 bg-card p-5 text-center shadow-xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Tournament starts</p>
            <p className="mt-2 font-serif text-3xl text-primary">{formatDate(tournament?.start_date || defaultTournamentStart)}</p>
          </div>
          <div className="flex justify-center">
            <CountdownTimer targetDate={tournament?.start_date || defaultTournamentStart} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Dates" value={`${formatDate(tournament?.start_date)} - ${formatDate(tournament?.end_date)}`} />
            <Metric label="Format" value={getFormatName(tournament?.format)} />
            <Metric label="Teams" value={tournament?.team_count || "TBA"} />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-wider text-secondary">
              <span>Overview</span>
              <span>⚔️</span>
            </div>
            <h3 className="font-serif text-3xl text-primary md:text-4xl">{tournament?.name || "The Forge"}</h3>
            <p className="mt-3 text-muted-foreground">
              {tournament?.description || "Tournament details are being forged. Check Discord for live communications."}
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <img
              src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
              alt="Esports arena visual"
              className="h-64 w-full object-cover opacity-80 lg:h-full lg:min-h-64"
            />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="relative flex min-h-screen items-center overflow-hidden py-16 md:py-20">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80"
              alt="Gaming setup background"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#b8141426_0%,transparent_60%)]" />
          </div>
          <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] w-full items-stretch px-4 md:px-8">
            <div className="mx-auto flex w-full flex-col rounded-2xl border border-border bg-card/70 p-5 shadow-2xl backdrop-blur sm:p-8 md:w-[80vw] md:p-10">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs uppercase tracking-wider text-secondary">
                <span>Basic Rule Book</span>
                <span>📜</span>
              </div>
              <h3 className="font-serif text-3xl text-primary sm:text-4xl md:text-5xl">Rules Of The Forge</h3>
              <p className="mt-5 flex-1 overflow-y-auto whitespace-pre-line pr-1 text-sm leading-7 text-muted-foreground sm:text-base md:text-lg">
                {tournament?.rulebook || "Rules will be published here before the tournament starts."}
              </p>
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="mx-auto max-w-6xl space-y-2 px-4">
          <h3 className="font-serif text-2xl">Announcements</h3>
          {(announcements.length ? announcements : ["Announcements will appear here."]).map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              {item}
            </div>
          ))}
        </section>
      </RevealSection>

      <RevealSection>
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mb-3 text-3xl">💬</div>
            <h3 className="font-serif text-3xl text-primary">Join our Discord</h3>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Match-day communication, payment confirmation, announcements, and support happen in our Discord server.
            </p>
            {tournament?.discord_url ? (
              <a
                className="mt-6 inline-flex rounded-md bg-primary px-6 py-3 text-primary-foreground"
                href={tournament.discord_url}
                target="_blank"
                rel="noreferrer"
              >
                Join Discord
              </a>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Discord link will appear once configured by admins.</p>
            )}
          </div>
        </section>
      </RevealSection>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-xl">{value}</div>
    </div>
  );
}

function AnimatedPrizePool({ value }) {
  const parsed = useMemo(() => parsePrizePool(value), [value]);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!parsed) return undefined;
    let animationFrame;
    const startedAt = performance.now();
    const duration = 1200;

    function animate(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(parsed.amount * eased);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    }

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [parsed]);

  if (!parsed) {
    return <p className="mt-2 font-serif text-3xl text-primary sm:text-4xl">{value || "TBA"}</p>;
  }

  return (
    <p className="mt-2 font-serif text-3xl text-primary tabular-nums sm:text-4xl">
      {parsed.prefix}
      {formatNumber(displayValue)}
      {parsed.suffix}
    </p>
  );
}

function CountdownTimer({ targetDate }) {
  const targetTime = useMemo(() => new Date(targetDate || defaultTournamentStart).getTime(), [targetDate]);
  const [remaining, setRemaining] = useState(() => Math.max(0, targetTime - Date.now()));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemaining(Math.max(0, targetTime - Date.now()));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [targetTime]);

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card/45 p-4 shadow-2xl backdrop-blur">
      <div className="grid grid-cols-4 gap-2 text-center">
        <CountdownUnit label="Days" value={days} />
        <CountdownUnit label="Hours" value={hours} />
        <CountdownUnit label="Minutes" value={minutes} />
        <CountdownUnit label="Seconds" value={seconds} />
      </div>
    </div>
  );
}

function CountdownUnit({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="font-serif text-2xl text-primary tabular-nums sm:text-3xl">{String(value).padStart(2, "0")}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</div>
    </div>
  );
}

function TournamentInfo({ event, message, compact = false }) {
  const tournament = event?.tournament;
  const announcements = normalizeAnnouncements(tournament?.announcements);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary lg:col-span-2">{message}</p> : null}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-2xl">{tournament?.name || "The Forge"}</h2>
        <p className="text-muted-foreground">
          {tournament?.description || "Tournament details are being forged. Check Discord for live communications."}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Format" value={tournament?.format?.toUpperCase() || "TBA"} />
          <Metric label="Teams" value={tournament?.team_count || "TBA"} />
          <Metric label="Registration closes" value={formatDate(tournament?.registration_deadline)} />
        </div>
      </section>
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg">Rule book</h3>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {tournament?.rulebook || "Rules will be published here before the tournament starts."}
        </p>
      </section>
      {!compact ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 className="font-serif text-lg">Announcements</h3>
          {(announcements.length ? announcements : ["Announcements will appear here."]).map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
              {item}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function RevealSection({ children }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      {children}
    </div>
  );
}

function PublicSchedule({ event, message }) {
  const groupedMatches = useMemo(() => {
    const groups = {};
    (event?.matches || []).forEach((match) => {
      if (!groups[match.stageKey]) groups[match.stageKey] = [];
      groups[match.stageKey].push(match);
    });
    return groups;
  }, [event]);
  const activeTab = event?.tabs?.[0]?.id;

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-2xl">Bracket & Schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {event?.tournament?.visibility_mode === "demo"
            ? "Demo mode is active. Brackets are previews and real team names unlock when tournament mode begins."
            : "Live tournament mode is active. Match names, scores, and standings reflect the current tournament state."}
        </p>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {(groupedMatches[activeTab] || event?.matches || []).map((match) => (
          <div key={match.id} className="rounded-md border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{match.stageKey} round {match.roundIndex + 1}</div>
            <div className="mt-1 font-medium">{match.team1} vs {match.team2}</div>
            <div className="mt-1 text-sm text-muted-foreground">{match.meta?.score ? `Score: ${match.meta.score}` : "Score TBA"}</div>
            {match.winner ? <div className="mt-1 text-sm text-secondary">Winner: {match.winner}</div> : null}
          </div>
        ))}
      </div>
      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg">Scheduled matches</h3>
        {(event?.schedule || []).map((slot) => {
          const match = event?.matches?.find((entry) => entry.id === slot.matchId);
          return (
            <div key={slot.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="font-medium">{match ? `${match.team1} vs ${match.team2}` : slot.matchId}</div>
              <div className="text-muted-foreground">{new Date(slot.startAt).toLocaleString()} - {slot.stream}</div>
              <div className="capitalize text-secondary">{slot.status}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function RegistrationPage({ event, setMessage }) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    roles: ["Carry"],
    mmr: "",
    steamName: "",
    steamProfile: "",
    discordHandle: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function toggleRole(role) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter((item) => item !== role) : [...prev.roles, role],
    }));
  }

  async function submit(eventSubmit) {
    eventSubmit.preventDefault();
    const payload = {
      ...form,
      mmr: form.mmr ? Number(form.mmr) : null,
    };
    await api.registerPlayer(tournamentSlug, payload);
    setSubmitted(true);
    setMessage("Registration submitted. Complete payment in Discord and admins will approve it manually.");
  }

  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={submit}>
      <div>
        <h2 className="font-serif text-2xl">Register for {event?.tournament?.name || "The Forge"}</h2>
        <p className="text-sm text-muted-foreground">Submit accurate Steam details so admins can verify the same player is competing throughout.</p>
      </div>
      {submitted ? <p className="rounded-md border border-border bg-background p-3 text-sm text-secondary">Registration received.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Player name" value={form.name} onChange={(name) => setForm((prev) => ({ ...prev, name }))} required />
        <Input label="Location / place" value={form.location} onChange={(location) => setForm((prev) => ({ ...prev, location }))} />
        <Input label="MMR" type="number" value={form.mmr} onChange={(mmr) => setForm((prev) => ({ ...prev, mmr }))} />
        <Input label="Discord handle" value={form.discordHandle} onChange={(discordHandle) => setForm((prev) => ({ ...prev, discordHandle }))} />
        <Input label="Steam name" value={form.steamName} onChange={(steamName) => setForm((prev) => ({ ...prev, steamName }))} required />
        <Input label="Steam ID / profile link" value={form.steamProfile} onChange={(steamProfile) => setForm((prev) => ({ ...prev, steamProfile }))} required />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Roles</p>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-md border px-3 py-1 text-sm ${form.roles.includes(role) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        Notes
        <textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-2" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
      </label>
      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
        Submit registration
      </button>
    </form>
  );
}

function Input({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block text-sm">
      {label}
      <input
        required={required}
        type={type}
        className="mt-1 w-full rounded-md border border-input bg-background p-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
