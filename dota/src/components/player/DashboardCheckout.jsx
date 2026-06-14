import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BpcCoin } from "../coins/BpcCoin.jsx";
import { BpcCoinSlider } from "../coins/BpcCoinSlider.jsx";
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

  const [liveCoins, setLiveCoins] = useState(0);

  useEffect(() => {
    if (!eligible || !registrationsOpen || !tournamentSlug) return;
    playerApi
      .checkoutPreview(tournamentSlug, { cardTier, coinsToApply })
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [cardTier, coinsToApply, eligible, registrationsOpen, tournamentSlug]);

  const maxCoins = preview?.maxCoinsApplicable ?? 0;
  const coinBalance = preview?.coinBalance ?? 0;
  const coinSliderMax = Math.min(maxCoins, coinBalance);

  useEffect(() => {
    if (!preview) return;
    setCoinsToApply((current) => (current > coinSliderMax ? coinSliderMax : current));
    setLiveCoins((current) => (current > coinSliderMax ? coinSliderMax : current));
  }, [preview, coinSliderMax]);

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

  if (!eligible) return null;

  if (!registrationsOpen) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-xl">Substitute pool</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Registration is closed. Join the substitute pool to be considered for open roster spots. Your MMR, roles, and
          contact info are taken from profile settings.
        </p>
        <Link to={`/dashboard/substitute/${tournamentSlug}`} className="btn btn-primary mt-4 inline-flex">
          Join substitute pool
        </Link>
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
            <BpcCoin size="xs">
              Apply BPC coins
              {coinBalance > 0 ? ` (balance: ${coinBalance})` : ""}
            </BpcCoin>
            <BpcCoinSlider
              value={coinsToApply}
              onChange={setCoinsToApply}
              onLiveChange={setLiveCoins}
              max={maxCoins}
              balance={coinBalance}
              disabled={!preview}
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
