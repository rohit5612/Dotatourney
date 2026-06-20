import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { CardTierPreviewImage } from "../../components/cards/CardTierPreviewImage.jsx";
import { BpcCoin, BpcCoinIcon } from "../../components/coins/BpcCoin.jsx";
import { BpcCoinSlider } from "../../components/coins/BpcCoinSlider.jsx";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import {
  RegistrationBody,
  RegistrationHero,
  RegistrationStepper,
  useRegistrationTournament,
} from "../../components/player/RegistrationFlow.jsx";
import { CARD_TIER_ORDER } from "../../constants/cardTierPreviews.js";
import { pollCheckoutPaid, playerApi } from "../../lib/playerApi";
import { bundleTotalForTier, formatDiscountLabel } from "../../utils/commerceBundle.js";

const CashfreeGatewayModal = lazy(() =>
  import("../../components/payment/CashfreeGatewayModal.jsx").then((m) => ({
    default: m.CashfreeGatewayModal,
  })),
);

const TIER_HINTS = {
  default: "Standard season registration",
  player: "Dark frame + stats",
  gold: "Gold frame + Custom logo slot",
  holo: "Holo frame, Custom Avatar slot + privileges*",
};

export function PlayerCheckoutPage() {
  const { slug } = useParams();
  const { account } = useOutletContext();
  const { tournament } = useRegistrationTournament(slug);
  const [cardTier, setCardTier] = useState("default");
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [liveCoins, setLiveCoins] = useState(0);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [step, setStep] = useState("select");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateway, setGateway] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const previewHardKey = useRef("");

  useEffect(() => {
    import("../../lib/cashfreeCheckout.js").then((m) => m.loadCashfreeScript()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) return;
    const hardKey = `${slug}:${cardTier}`;
    const isHardReload = previewHardKey.current !== hardKey;
    previewHardKey.current = hardKey;
    if (isHardReload) setPreviewLoading(true);

    playerApi
      .checkoutPreview(slug, { cardTier, coinsToApply })
      .then(setPreview)
      .catch((err) => setError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [slug, cardTier, coinsToApply]);

  const maxCoins = preview?.maxCoinsApplicable ?? 0;
  const coinBalance = preview?.coinBalance ?? 0;
  const coinSliderMax = Math.min(maxCoins, coinBalance);
  const minCash = preview?.commerce?.minCashRupees ?? 100;
  const subtotal = preview?.subtotal ?? 0;
  const appliedCoins = Math.min(liveCoins, coinSliderMax);
  const displayTotal = preview ? Math.max(minCash, subtotal - appliedCoins) : 0;

  useEffect(() => {
    if (!preview) return;
    setCoinsToApply((current) => (current > coinSliderMax ? coinSliderMax : current));
    setLiveCoins((current) => (current > coinSliderMax ? coinSliderMax : current));
  }, [preview, coinSliderMax]);

  const tiers = preview?.commerce?.cardTiers || {};
  const standardReg = preview?.commerce?.registrationFeeRupees ?? 300;

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const result = await playerApi.checkoutConfirm(slug, { cardTier, coinsToApply });
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

  if (step === "done") {
    const tierLabel = tiers[cardTier]?.label || cardTier;
    const isPremiumCard = cardTier !== "default";

    return (
      <div className="player-reg">
        <RegistrationBody>
        <section className="player-dash__card player-reg__success">
          <div className="player-reg__success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
          </div>
          <h1 className="player-dash__hero-title player-reg__success-title">Registration complete</h1>
          <p className="player-auth__sub">
            Payment confirmed for <strong>{preview?.tournament?.name || tournament?.name || "this tournament"}</strong>.
            Your card tier: <strong>{tierLabel}</strong>.
          </p>
          {isPremiumCard ? (
            <p className="player-auth__sub mt-3">
              Our admins will process and upload your custom card within <strong>48 hours</strong>. Until then, your
              default season card appears on your profile and in the community directory.
            </p>
          ) : null}
          <div className="player-reg__success-card">
            <CardTierPreviewImage tier={cardTier} size="sm" />
          </div>
          <div className="player-reg__form-actions player-reg__form-actions--center">
            <Link to="/dashboard" className="player-dash__action player-dash__action--tournaments player-dash__action--lead">
              <DashboardNavIcon name="overview" />
              <span>Back to dashboard</span>
            </Link>
            <Link to="/dashboard/history" className="player-dash__action player-dash__action--public">
              <span>View history</span>
            </Link>
          </div>
        </section>
        </RegistrationBody>
      </div>
    );
  }

  return (
    <div className="player-reg">
      <RegistrationHero tournament={tournament || preview?.tournament} account={account} step={2} stepLabel="Step 2 of 2" />
      <RegistrationBody>
      <RegistrationStepper step={2} />

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      {confirmingPayment ? (
        <div className="player-dash__loading player-dash__loading--inline" style={{ marginBottom: "1rem" }}>
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Confirming your payment with Cashfree…</p>
        </div>
      ) : null}

      <div className="player-reg__layout player-reg__layout--checkout">
        <section className="player-dash__card player-dash__section-card">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <div className="player-dash__section-title-row">
              <span className="player-dash__section-icon" aria-hidden="true">
                <DashboardActionIcon name="tournaments" />
              </span>
              <div>
                <h2 className="player-dash__card-title">Card bundle</h2>
                <p className="player-dash__card-sub">Pick the player card style for this season</p>
              </div>
            </div>
          </header>

          <div className="player-reg__tier-grid">
            {CARD_TIER_ORDER.map((id) => {
              const t = tiers[id];
              if (t && t.enabled === false) return null;
              const bundleTotal =
                t?.bundleTotalRupees ?? bundleTotalForTier(t, id, standardReg);
              const discountLabel = formatDiscountLabel(t?.discountPercent);
              return (
                <button
                  key={id}
                  type="button"
                  className={`player-reg__tier-card player-reg__tier-card--${id}${cardTier === id ? " is-selected" : ""}`}
                  onClick={() => setCardTier(id)}
                  aria-pressed={cardTier === id}
                >
                  <span className="player-reg__tier-card-label">{t?.label || id}</span>
                  <span className="player-reg__tier-card-price">₹{bundleTotal}</span>
                  <span className="player-reg__tier-card-desc">
                    {t?.description || TIER_HINTS[id] || ""}
                  </span>
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

          <div className="player-reg__card-preview">
            <p className="player-reg__card-preview-label">Card preview</p>
            <CardTierPreviewImage tier={cardTier} size="md" className="player-reg__card-preview-art" />
          </div>
        </section>

        <aside className="player-reg__aside player-reg__aside--sticky">
          <section className="player-dash__card player-dash__section-card player-reg__summary">
            <header className="player-dash__card-head player-dash__card-head--compact">
              <h2 className="player-dash__card-title">Order summary</h2>
              <p className="player-dash__card-sub">
                {preview?.tournament?.name || tournament?.name || "Tournament registration"}
              </p>
            </header>

            {previewLoading && !preview ? (
              <div className="player-dash__loading player-dash__loading--inline">
                <span className="player-dash__loading-pulse" aria-hidden="true" />
                <p className="player-auth__sub">Calculating total…</p>
              </div>
            ) : preview ? (
              <>
                <ul className="player-reg__line-items">
                  {preview.lineItems?.length ? (
                    <li className="player-reg__line-item">
                      <span>{preview.lineItems[0]?.label || tiers[cardTier]?.label || "Bundle"}</span>
                      <span>₹{preview.lineItems[0]?.amount ?? preview.subtotal}</span>
                    </li>
                  ) : null}
                </ul>

                {preview.subtotal != null ? (
                  <div className="player-reg__line-item player-reg__line-item--muted">
                    <span>Subtotal</span>
                    <span>₹{preview.subtotal}</span>
                  </div>
                ) : null}

                <div className="player-reg__coin-block">
                  <div className="player-reg__coin-head">
                    <BpcCoin size="xs">Apply BPC coins</BpcCoin>
                    <span className="player-reg__coin-balance">
                      Balance: <BpcCoinIcon size="xs" /> {coinBalance}
                    </span>
                  </div>
                  <p className="player-reg__field-hint">
                    {coinBalance === 0
                      ? "No coins in your wallet yet."
                      : coinSliderMax < maxCoins
                        ? `Using up to ${coinSliderMax} of your ${coinBalance} coins (min ₹${minCash} cash due).`
                        : `Up to ${coinSliderMax} coins · minimum ₹${minCash} cash due`}
                  </p>
                  <BpcCoinSlider
                    value={coinsToApply}
                    onChange={setCoinsToApply}
                    onLiveChange={setLiveCoins}
                    max={maxCoins}
                    balance={coinBalance}
                    disabled={!preview}
                  />
                </div>

                <div className="player-reg__total">
                  <span>Total due</span>
                  <span className="player-reg__total-amount">₹{displayTotal}</span>
                </div>

                <button
                  type="button"
                  className="player-dash__action player-dash__action--tournaments player-dash__action--lead player-reg__pay-btn"
                  onClick={pay}
                  disabled={busy || confirmingPayment || !preview}
                >
                  <DashboardActionIcon name="tournaments" />
                  <span>
                    {busy ? "Processing…" : confirmingPayment ? "Confirming payment…" : "Pay & register"}
                  </span>
                </button>

                <Link
                  to={`/dashboard/register/${slug}`}
                  className="player-dash__action player-dash__action--public player-reg__back-link"
                >
                  <span>← Edit details</span>
                </Link>
              </>
            ) : null}
          </section>
        </aside>
      </div>
      </RegistrationBody>
      {gateway ? (
        <Suspense fallback={null}>
          <CashfreeGatewayModal
            open
            paymentSessionId={gateway.paymentSessionId}
            mode={gateway.cashfreeMode}
            onClose={() => setGateway(null)}
            onSettled={handleGatewaySettled}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
