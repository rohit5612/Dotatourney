import { Link, useNavigate } from "react-router-dom";
import { PUBLIC_CONTACT_EMAIL } from "../constants/legal.js";
import { useSiteNavLinks } from "../hooks/useSiteNavLinks.js";
import { ValveDisclaimer } from "./ValveDisclaimer.jsx";

export function AppFooter({ navigate, mode = "public", className = "" }) {
  const routerNavigate = useNavigate();
  const publicNavLinks = useSiteNavLinks();
  const quickLinks =
    mode === "admin"
      ? [
          ["playerCrm", "Player CRM"],
          ["teams", "Teams"],
          ["setup", "Setup"],
          ["bracketSchedule", "Bracket & Schedule"],
        ]
      : publicNavLinks.map((item) => [item.href, item.label]);

  const legalLinks =
    mode === "public"
      ? [
          ["/terms", "Terms & Conditions"],
          ["/privacy", "Privacy Policy"],
          ["/refund-policy", "Return & Refund Policy"],
          ["/cancellation-policy", "Cancellation Policy"],
          ["/about", "About Us"],
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
    <footer className={`app-footer app-footer-glass ${className}`.trim()}>
      <div className="app-footer__inner">
        <div className="app-footer__main">
          <div
            className={`app-footer__grid ${
              mode === "public" ? "app-footer__grid--public" : "app-footer__grid--admin"
            }`}
          >
            <div>
              <p className="app-footer__brand">BPC League</p>
              <p className="app-footer__tagline">
                Bharat Pro Circuit League — built for India&apos;s Dota community: structured seasons, roster drafts,
                fair brackets, and a real run to finals.
              </p>
              {mode === "public" ? (
                <p className="app-footer__contact">
                  Contact:{" "}
                  <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>
                </p>
              ) : null}
            </div>

            <div>
              <p className="app-footer__heading">Quick links</p>
              <div className="app-footer__links">
                {quickLinks.map(([target, label]) => (
                  <button
                    key={target}
                    type="button"
                    className="app-footer__link"
                    onClick={() => goTo(target)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "public" ? (
              <div>
                <p className="app-footer__heading">Legal</p>
                <div className="app-footer__links">
                  {legalLinks.map(([target, label]) => (
                    <button
                      key={target}
                      type="button"
                      className="app-footer__link"
                      onClick={() => goTo(target)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="app-footer__heading">Community</p>
              <div className="app-footer__links">
                <a
                  className="app-footer__link"
                  href="https://discord.gg/sV2PhYc6A3"
                  target="_blank"
                  rel="noreferrer"
                >
                  Join Discord
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="app-footer__divider" aria-hidden="true" />

        <div className="app-footer__disclaimer">
          <ValveDisclaimer variant="compact" showTag={false} />
        </div>

        <div className="app-footer__divider" aria-hidden="true" />

        <div className="app-footer__bar">
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
              <a href="https://nuvorn.com/" target="_blank" rel="noreferrer">
                Nuvorn Technologies
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
