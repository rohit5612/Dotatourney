import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { pollCheckoutPaid, playerApi } from "../../lib/playerApi";

export function PlayerCheckoutReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") || "";
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setState("error");
      setError("Missing checkout order.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const status = await pollCheckoutPaid(orderId, { maxAttempts: 30, intervalMs: 2000 });
        if (cancelled) return;
        if (status?.status === "paid") {
          setState("paid");
          return;
        }
        const latest = await playerApi.checkoutStatus(orderId);
        if (cancelled) return;
        if (latest.status === "paid") setState("paid");
        else if (latest.status === "pending") {
          setState("pending");
          setError("Payment is still processing. Check your email or try again from checkout.");
        } else {
          setState("error");
          setError("We could not confirm your payment yet.");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err.message || "Could not verify payment.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div className="player-auth">
      <div className="player-auth__card">
        {state === "loading" ? (
          <>
            <h1 className="player-auth__title">Confirming payment…</h1>
            <p className="player-auth__sub">Please wait while we verify your registration payment.</p>
          </>
        ) : null}
        {state === "paid" ? (
          <>
            <h1 className="player-auth__title">Payment received</h1>
            <p className="player-auth__sub">
              Your registration payment was successful. An admin will review your entry shortly — check your email for
              the receipt.
            </p>
            <p className="player-auth__sub mt-3">
              If you purchased a premium card bundle, our team will process and upload your custom card within{" "}
              <strong>48 hours</strong>. Your default season card is visible until then.
            </p>
            <Link to="/dashboard" className="btn btn-primary player-auth__submit">
              Back to dashboard
            </Link>
          </>
        ) : null}
        {state === "pending" || state === "error" ? (
          <>
            <h1 className="player-auth__title">Payment status</h1>
            <p className="player-auth__sub">{error}</p>
            <Link to="/dashboard/tournaments" className="btn btn-primary player-auth__submit">
              View tournaments
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
