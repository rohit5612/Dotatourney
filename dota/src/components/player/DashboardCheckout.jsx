import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BpcCoin } from "../coins/BpcCoin.jsx";
import { BpcCoinSlider } from "../coins/BpcCoinSlider.jsx";
import { pollCheckoutPaid, playerApi } from "../../lib/playerApi";
import { cardTierDisplayLabel } from "../../constants/cardTierPreviews.js";
import { bundleTotalForTier, formatDiscountLabel } from "../../utils/commerceBundle.js";
import { CashfreeGatewayModal } from "../payment/CashfreeGatewayModal.jsx";

const TIER_ORDER = ["default", "player", "gold", "holo"];

export function DashboardCheckout({ tournamentSlug, registrationsOpen, eligible }) {
  const [cardTier, setCardTier] = useState("default");
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState("select");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateway, setGateway] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

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
  const tiers = preview?.commerce?.cardTiers || {};
  const standardReg = preview?.commerce?.registrationFeeRupees ?? 300;

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
      if (result.provider === "manual" || result.manualMode) {
        await playerApi.simulatePay(result.orderId);
        setStep("done");
        return;
      }
      if (!result.paymentSessionId) {
        throw new Error("Payment session unavailable. Try again.");
      }
      setGateway({
        orderId: result.orderId,
        paymentSessionId: result.paymentSessionId,
        cashfreeMode: result.cashfreeMode || "sandbox",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGatewaySettled(result) {
    const orderId = gateway?.orderId;
    setGateway(null);
    if (result?.error) {
      setError("Payment was not completed. You can try again when ready.");
      return;
    }
    if (!orderId) return;
    setConfirmingPayment(true);
    setError("");
    try {
      const status = await pollCheckoutPaid(orderId);
      if (status?.status === "paid") setStep("done");
      else {
        setError(
          "We could not confirm your payment yet. If money was deducted, wait a minute and refresh — or check your email.",
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmingPayment(false);
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
    const isPremiumCard = cardTier !== "default";
    const tierLabel = tiers[cardTier]?.label || cardTierDisplayLabel(cardTier);
    return (
      <section className="mt-8 rounded-lg border border-accent/40 bg-card p-5">
        <h2 className="font-serif text-xl text-accent">Registration complete</h2>
        <p className="mt-2 text-muted-foreground">Payment confirmed. Bundle: {tierLabel}.</p>
        {isPremiumCard ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Our admins will process and upload your custom card within <strong>48 hours</strong>. Until then, your
            default season card is shown on your profile and in the community directory.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-xl">Register for tournament</h2>
      <p className="mt-2 text-sm text-muted-foreground">Select your card bundle and complete checkout.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TIER_ORDER.map((id) => {
          const tier = tiers[id];
          if (tier && tier.enabled === false) return null;
          const bundleTotal = tier?.bundleTotalRupees ?? bundleTotalForTier(tier, id, standardReg);
          const discountLabel = formatDiscountLabel(tier?.discountPercent);
          return (
            <button
              key={id}
              type="button"
              className={`player-reg__tier-card player-reg__tier-card--${id}${cardTier === id ? " is-selected" : ""}`}
              onClick={() => setCardTier(id)}
              aria-pressed={cardTier === id}
            >
              <span className="player-reg__tier-card-label">{tier?.label || cardTierDisplayLabel(id)}</span>
              <span className="player-reg__tier-card-price">₹{bundleTotal}</span>
              <span className="player-reg__tier-card-desc">{tier?.description || ""}</span>
              {discountLabel ? (
                <span className="player-reg__tier-card-discount">{discountLabel}</span>
              ) : null}
              <span className="player-reg__tier-card-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      {preview ? (
        <div className="mt-4 space-y-2 text-sm">
          {preview.lineItems?.[0] ? (
            <div className="flex justify-between">
              <span>{preview.lineItems[0].label}</span>
              <span>₹{preview.lineItems[0].amount}</span>
            </div>
          ) : null}
          {preview.subtotal != null ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{preview.subtotal}</span>
            </div>
          ) : null}
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
            <span>Total due</span>
            <span>₹{preview.totalRupees ?? preview.total}</span>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-destructive text-sm">{error}</p> : null}
      {confirmingPayment ? (
        <p className="mt-3 text-sm text-muted-foreground">Confirming your payment with Cashfree…</p>
      ) : null}

      <button type="button" className="btn btn-primary mt-4" onClick={pay} disabled={busy || confirmingPayment || !preview}>
        {busy ? "Processing…" : confirmingPayment ? "Confirming payment…" : "Pay & register"}
      </button>
      <CashfreeGatewayModal
        open={Boolean(gateway)}
        paymentSessionId={gateway?.paymentSessionId}
        mode={gateway?.cashfreeMode}
        onClose={() => setGateway(null)}
        onSettled={handleGatewaySettled}
      />
    </section>
  );
}
