import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { BpclCard } from "../../components/cards/BpclCard.jsx";
import { BpcCoin, BpcCoinIcon } from "../../components/coins/BpcCoin.jsx";
import { BpcCoinSlider } from "../../components/coins/BpcCoinSlider.jsx";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import {
  buildCardManifest,
  RegistrationBody,
  RegistrationHero,
  RegistrationStepper,
  useRegistrationTournament,
} from "../../components/player/RegistrationFlow.jsx";
import { loadRazorpayScript, playerApi } from "../../lib/playerApi";

const TIER_ORDER = ["default", "player", "gold", "holo"];

const TIER_HINTS = {
  default: "Grey frame — included with registration",
  player: "Dark frame with MMR and role stats",
  gold: "Gold trim with custom logo slot",
  holo: "Full avatar showcase with tagline",
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
  const previewHardKey = useRef("");

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
  const cardManifest = buildCardManifest(account, cardTier);

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
      const Razorpay = await loadRazorpayScript();
      const rzp = new Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency || "INR",
        order_id: result.razorpayOrderId || result.orderId,
        name: "BPC League",
        description: "Tournament registration",
        handler: async () => {
          const status = await playerApi.checkoutStatus(result.orderId);
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

  if (step === "done") {
    const tierLabel = tiers[cardTier]?.label || cardTier;

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
          {cardManifest ? (
            <div className="player-reg__success-card">
              <BpclCard manifest={cardManifest} size="sm" />
            </div>
          ) : null}
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
            {TIER_ORDER.map((id) => {
              const t = tiers[id];
              if (t && t.enabled === false) return null;
              const price =
                id === "default" ? "Included" : `+₹${t?.bundledPriceRupees ?? 0}`;
              return (
                <button
                  key={id}
                  type="button"
                  className={`player-reg__tier-card player-reg__tier-card--${id}${cardTier === id ? " is-selected" : ""}`}
                  onClick={() => setCardTier(id)}
                  aria-pressed={cardTier === id}
                >
                  <span className="player-reg__tier-card-label">{t?.label || id}</span>
                  <span className="player-reg__tier-card-price">{price}</span>
                  <span className="player-reg__tier-card-desc">
                    {t?.description || TIER_HINTS[id] || ""}
                  </span>
                  {cardTier === id ? (
                    <span className="player-reg__tier-card-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {cardManifest ? (
            <div className="player-reg__card-preview">
              <p className="player-reg__card-preview-label">Live preview</p>
              <BpclCard manifest={cardManifest} size="md" className="player-reg__card-preview-art" />
            </div>
          ) : null}
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
                  {preview.lineItems?.map((item) => (
                    <li key={item.key} className="player-reg__line-item">
                      <span>{item.label}</span>
                      <span>₹{item.amount}</span>
                    </li>
                  ))}
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
                  disabled={busy || !preview}
                >
                  <DashboardActionIcon name="tournaments" />
                  <span>{busy ? "Processing…" : "Pay & register"}</span>
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
    </div>
  );
}
