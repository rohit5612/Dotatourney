import { useEffect, useState } from "react";
import { BpcCoin } from "../coins/BpcCoin.jsx";
import { loadRazorpayScript, playerApi } from "../../lib/playerApi";

const CARD_TIERS = [
  { id: "default", label: "Default (grey)", desc: "Included with registration" },
  { id: "player", label: "Player card", desc: "Dark frame + stats" },
  { id: "gold", label: "Gold card", desc: "Custom logo slot" },
  { id: "holo", label: "Holo card", desc: "Avatar + tagline" },
];

export function DashboardCheckout({ tournamentSlug, registrationsOpen, eligible }) {
  const [cardTier, setCardTier] = useState("default");
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState("select");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [substitute, setSubstitute] = useState({ roles: ["Support"], mmr: 3000, availability: "", notes: "" });

  useEffect(() => {
    if (!eligible || !registrationsOpen || !tournamentSlug) return;
    playerApi
      .checkoutPreview(tournamentSlug, { cardTier, coinsToApply })
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [cardTier, coinsToApply, eligible, registrationsOpen, tournamentSlug]);

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const result = await playerApi.checkoutConfirm(tournamentSlug, { cardTier, coinsToApply });
      if (result.provider === "manual") {
        await playerApi.simulatePay(result.orderId);
        setStep("done");
        return;
      }
      const Razorpay = await loadRazorpayScript();
      const rzp = new Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency || "INR",
        order_id: result.orderId,
        name: "BPC League",
        description: "Season registration",
        handler: async () => {
          const status = await playerApi.checkoutStatus(result.checkoutOrderId || result.orderId);
          if (status.status === "paid") setStep("done");
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSubstitute(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await playerApi.substituteSignup(tournamentSlug, substitute);
      setStep("substitute-done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!eligible) return null;

  if (!registrationsOpen) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-xl">Substitute pool</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Registration is closed. Join the substitute pool to be considered for open roster spots.
        </p>
        {step === "substitute-done" ? (
          <p className="mt-4 text-accent">Substitute signup received. Admins will contact you if a spot opens.</p>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitSubstitute}>
            <label className="block text-sm">
              MMR
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-input bg-background p-2"
                value={substitute.mmr}
                onChange={(e) => setSubstitute((s) => ({ ...s, mmr: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-sm">
              Availability
              <input
                className="mt-1 w-full rounded-md border border-input bg-background p-2"
                value={substitute.availability}
                onChange={(e) => setSubstitute((s) => ({ ...s, availability: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background p-2"
                value={substitute.notes}
                onChange={(e) => setSubstitute((s) => ({ ...s, notes: e.target.value }))}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Join substitute pool
            </button>
          </form>
        )}
        {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      </section>
    );
  }

  if (step === "done") {
    return (
      <section className="mt-8 rounded-lg border border-accent/40 bg-card p-5">
        <h2 className="font-serif text-xl text-accent">Registration complete</h2>
        <p className="mt-2 text-muted-foreground">Payment confirmed. Your card tier: {cardTier}.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-xl">Register for tournament</h2>
      <p className="mt-2 text-sm text-muted-foreground">Select your card bundle and complete checkout.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {CARD_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className={`rounded-lg border p-3 text-left transition ${cardTier === tier.id ? "border-accent bg-accent/10" : "border-border bg-background"}`}
            onClick={() => setCardTier(tier.id)}
          >
            <span className="font-semibold">{tier.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{tier.desc}</span>
          </button>
        ))}
      </div>

      {preview ? (
        <div className="mt-4 space-y-2 text-sm">
          {preview.lineItems?.map((item) => (
            <div key={item.key} className="flex justify-between">
              <span>{item.label}</span>
              <span>₹{item.amount}</span>
            </div>
          ))}
          <label className="mt-3 block">
            <BpcCoin size="xs">Apply BPC coins (max {preview.maxCoinsApplicable ?? 0})</BpcCoin>
            <input
              type="range"
              min={0}
              max={preview.maxCoinsApplicable ?? 0}
              value={coinsToApply}
              onChange={(e) => setCoinsToApply(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total</span>
            <span>₹{preview.totalRupees ?? preview.total}</span>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}

      <button type="button" className="btn btn-primary mt-4" onClick={pay} disabled={busy || !preview}>
        {busy ? "Processing…" : "Pay & register"}
      </button>
    </section>
  );
}
