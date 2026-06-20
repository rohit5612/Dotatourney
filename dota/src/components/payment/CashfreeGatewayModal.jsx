import { useEffect, useRef, useState } from "react";
import { openCashfreeCheckout } from "../../lib/cashfreeCheckout.js";
import "../../styles/cashfree-gateway.css";

/**
 * Wide inline Cashfree checkout host (replaces narrow default popup).
 */
export function CashfreeGatewayModal({ open, paymentSessionId, mode = "sandbox", onClose, onSettled }) {
  const mountRef = useRef(null);
  const onSettledRef = useRef(onSettled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!open || !paymentSessionId) return undefined;

    let cancelled = false;

    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const mountEl = mountRef.current;
      if (!mountEl || cancelled) return;

      setBusy(true);
      setError("");
      mountEl.innerHTML = "";

      try {
        const result = await openCashfreeCheckout({
          paymentSessionId,
          mode,
          mountEl,
        });
        if (!cancelled) onSettledRef.current?.(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open payment gateway.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, paymentSessionId, mode]);

  if (!open) return null;

  return (
    <div className="cf-gateway-modal" role="dialog" aria-modal="true" aria-labelledby="cf-gateway-title">
      <button type="button" className="cf-gateway-modal__backdrop" aria-label="Close payment" onClick={onClose} />
      <div className="cf-gateway-modal__panel">
        <header className="cf-gateway-modal__head">
          <h2 id="cf-gateway-title" className="cf-gateway-modal__title">
            Complete payment
          </h2>
          <button type="button" className="cf-gateway-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        {error ? (
          <p className="player-auth__message player-auth__message--error" style={{ margin: "1rem" }}>
            {error}
          </p>
        ) : null}
        {busy && !error ? (
          <p className="player-auth__sub" style={{ margin: "1rem" }}>
            Loading secure checkout…
          </p>
        ) : null}
        <div ref={mountRef} className="cf-gateway-modal__mount" />
      </div>
    </div>
  );
}
