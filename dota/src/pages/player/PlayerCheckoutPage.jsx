import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { CardTierPreviewImage } from "../../components/cards/CardTierPreviewImage.jsx";
import { BundleCheckoutPanel } from "../../components/player/BundleCheckoutPanel.jsx";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import {
  RegistrationBody,
  RegistrationHero,
  RegistrationStepper,
  useRegistrationTournament,
} from "../../components/player/RegistrationFlow.jsx";
import { CARD_TIER_ORDER, cardTierDisplayLabel } from "../../constants/cardTierPreviews.js";
import { pollCheckoutPaid, playerApi } from "../../lib/playerApi";
import { bundleTotalForTier } from "../../utils/commerceBundle.js";

const CashfreeGatewayModal = lazy(() =>
  import("../../components/payment/CashfreeGatewayModal.jsx").then((m) => ({
    default: m.CashfreeGatewayModal,
  })),
);

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

  useEffect(() => {
    if (!preview) return;
    setCoinsToApply((current) => (current > coinSliderMax ? coinSliderMax : current));
    setLiveCoins((current) => (current > coinSliderMax ? coinSliderMax : current));
  }, [preview, coinSliderMax]);

  const tiers = preview?.commerce?.cardTiers || {};
  const standardReg = preview?.commerce?.registrationFeeRupees ?? 300;

  const tierEntries = useMemo(
    () =>
      CARD_TIER_ORDER.flatMap((id) => {
        const t = tiers[id];
        if (t && t.enabled === false) return [];
        return [
          {
            id,
            label: t?.label || cardTierDisplayLabel(id),
            description: t?.description,
            price: t?.bundleTotalRupees ?? bundleTotalForTier(t, id, standardReg),
            discountPercent: t?.discountPercent,
          },
        ];
      }),
    [tiers, standardReg],
  );

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
    const tierLabel = tiers[cardTier]?.label || cardTierDisplayLabel(cardTier);
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

      <BundleCheckoutPanel
        mode="registration"
        selectedTier={cardTier}
        onSelectTier={setCardTier}
        tierEntries={tierEntries}
        preview={preview}
        previewLoading={previewLoading}
        tournamentName={preview?.tournament?.name || tournament?.name}
        coinsToApply={coinsToApply}
        displayCoins={liveCoins}
        onCoinsChange={setCoinsToApply}
        onLiveCoinsChange={setLiveCoins}
        onPay={pay}
        busy={busy}
        confirmingPayment={confirmingPayment}
        payLabel="Pay & register"
        footerLink={{ to: `/dashboard/register/${slug}`, label: "← Edit details" }}
      />
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
