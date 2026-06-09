import { Link, useNavigate } from "react-router-dom";
import { PUBLIC_CONTACT_EMAIL } from "../constants/legal.js";
import { useSiteNavLinks } from "../hooks/useSiteNavLinks.js";
import { ValveDisclaimer } from "./ValveDisclaimer.jsx";

export function AppFooter({ navigate, mode = "public" }) {
  const routerNavigate = useNavigate();
  const publicNavLinks = useSiteNavLinks();
  const quickLinks =
    mode === "admin"
      ? [
          ["registrations", "Registrations"],
          ["teams", "Teams"],
          ["setup", "Setup"],
          ["bracketSchedule", "Bracket & Schedule"],
        ]
      : publicNavLinks.map((item) => [item.href, item.label]);

  const legalLinks =
    mode === "public"
      ? [
          ["/privacy", "Privacy Policy"],
          ["/cookies", "Cookie Policy"],
        ]
      : [];

  function goTo(target) {
    if (navigate) {
      navigate(target);
      return;
    }
    if (mode === "admin") return;
    routerNavigate(target);
  }

  return (
    <footer className="border-t border-border bg-card/80">
      <div
        className={`mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted-foreground md:grid-cols-2 ${
          mode === "public" ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <div className="lg:col-span-1">
          <div className="font-serif text-xl font-semibold text-foreground">BPC League</div>
          <p className="mt-2 max-w-md leading-relaxed">
            Bharat Pro Circuit League — a Dota 2 tournament hub for registrations, rosters, brackets, schedules, standings, and match-day updates.
          </p>
          {mode === "public" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Contact:{" "}
              <a className="text-secondary underline underline-offset-2 hover:text-foreground" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                {PUBLIC_CONTACT_EMAIL}
              </a>
            </p>
          ) : null}
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-foreground">Quick links</div>
          <div className="mt-3 grid gap-2">
            {quickLinks.map(([target, label]) => (
              <button
                key={target}
                type="button"
                className="w-fit text-left transition hover:text-primary"
                onClick={() => goTo(target)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "public" ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-foreground">Legal</div>
            <div className="mt-3 grid gap-2">
              {legalLinks.map(([target, label]) => (
                <button
                  key={target}
                  type="button"
                  className="w-fit text-left transition hover:text-primary"
                  onClick={() => goTo(target)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-foreground">Community</div>
          <div className="mt-3 grid gap-2">
            <a className="w-fit transition hover:text-primary" href="https://discord.gg/sV2PhYc6A3" target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <ValveDisclaimer variant="compact" className="mx-auto max-w-4xl text-center" />
        </div>
      </div>
      <div className="border-t border-border">
        <div className="app-footer__bar mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          <span className="app-footer__bar-copy">
            &copy; {new Date().getFullYear()} Bharat Pro Circuit League (BPC League). All rights reserved.
          </span>
          <div className="app-footer__bar-utilities">
            {mode === "public" ? (
              <Link to="/admin" className="app-footer__staff-link">
                Staff portal
              </Link>
            ) : null}
            <span className="app-footer__powered">
              Powered by{" "}
              <a
                className="font-medium text-primary transition hover:text-foreground"
                href="https://nuvorn.com/"
                target="_blank"
                rel="noreferrer"
              >
                Nuvorn Technologies
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
