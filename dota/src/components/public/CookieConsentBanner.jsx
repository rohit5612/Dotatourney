import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COOKIE_CONSENT_KEY } from "../../constants/legal.js";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem(COOKIE_CONSENT_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          We use essential cookies for site function. See our{" "}
          <Link to="/cookies" className="text-primary underline hover:no-underline">
            cookie policy
          </Link>
          .
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
