import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardTierDisplayLabel } from "../cards/CardTierBadge.jsx";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { pollCheckoutPaid, playerApi } from "../../lib/playerApi";
import { BundleCheckoutPanel } from "./BundleCheckoutPanel.jsx";

const CashfreeGatewayModal = lazy(() =>
  import("../payment/CashfreeGatewayModal.jsx").then((m) => ({
    default: m.CashfreeGatewayModal,
  })),
);

export function CardUpgradeModal({ open, eligibility, onClose, onSuccess }) {
  const slug = eligibility?.tournament?.slug;
  const upgradeOptions = eligibility?.upgradeOptions || [];
  const [targetTier, setTargetTier] = useState(upgradeOptions[0]?.tier || "");
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [liveCoins, setLiveCoins] = useState(0);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateway, setGateway] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const previewHardKey = useRef("");

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !gateway && !confirmingPayment) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, gateway, confirmingPayment]);

  useEffect(() => {
    if (!open) return;
    import("../../lib/cashfreeCheckout.js").then((m) => m.loadCashfreeScript()).catch(() => {});
    setError("");
    setGateway(null);
    const firstTier = upgradeOptions[0]?.tier || "";
    setTargetTier(firstTier);
    setCoinsToApply(0);
    setLiveCoins(0);
  }, [open, upgradeOptions]);

  useEffect(() => {
    if (!open || !slug || !targetTier) return;
    const hardKey = `${slug}:${targetTier}`;
    const isHardReload = previewHardKey.current !== hardKey;
    previewHardKey.current = hardKey;
    if (isHardReload) setPreviewLoading(true);

    playerApi
      .upgradePreview(slug, { targetTier, coinsToApply })
      .then(setPreview)
      .catch((err) => setError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [open, slug, targetTier, coinsToApply]);

  const maxCoins = preview?.maxCoinsApplicable ?? 0;
  const coinBalance = preview?.coinBalance ?? 0;
  const coinSliderMax = Math.min(maxCoins, coinBalance);

  useEffect(() => {
    if (!preview) return;
    setCoinsToApply((current) => (current > coinSliderMax ? coinSliderMax : current));
    setLiveCoins((current) => (current > coinSliderMax ? coinSliderMax : current));
  }, [preview, coinSliderMax]);

  const tierEntries = upgradeOptions.map((opt) => ({
    id: opt.tier,
    label: opt.label,
    description: opt.description,
    price: opt.upgradeDeltaRupees,
    discountPercent: preview?.commerce?.cardTiers?.[opt.tier]?.discountPercent,
  }));

  async function finishUpgrade(paidTier) {
    const resolvedTier = paidTier || targetTier;
    onClose();
    await onSuccess?.({
      targetTier: resolvedTier,
      tournamentName: eligibility?.tournament?.name || "",
    });
  }

  async function pay() {
    if (!slug || !targetTier) return;
    setBusy(true);
    setError("");
    try {
      const result = await playerApi.upgradeConfirm(slug, { targetTier, coinsToApply });
      if (result.provider === "manual" || result.manualMode) {
        await playerApi.simulatePay(result.orderId);
        const status = await playerApi.checkoutStatus(result.orderId);
        await finishUpgrade(status?.cardTier || targetTier);
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
    const paidTargetTier = targetTier;
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
      if (status?.status === "paid") {
        await finishUpgrade(status.cardTier || paidTargetTier);
      } else {
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

  if (!open) return null;

  return createPortal(
    <div
      className="player-upgrade-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade player card"
      onClick={onClose}
    >
      <div className="player-upgrade-modal__panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="player-upgrade-modal__close"
          onClick={onClose}
          aria-label="Close upgrade dialog"
        >
          Close
        </button>
        {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
        {confirmingPayment ? (
          <div className="player-dash__loading player-dash__loading--inline" style={{ marginBottom: "1rem" }}>
            <span className="player-dash__loading-pulse" aria-hidden="true" />
            <p className="player-auth__sub">Confirming your payment with Cashfree…</p>
          </div>
        ) : null}
        <BundleCheckoutPanel
          mode="upgrade"
          selectedTier={targetTier}
          onSelectTier={setTargetTier}
          tierEntries={tierEntries}
          preview={preview}
          previewLoading={previewLoading}
          tournamentName={eligibility?.tournament?.name}
          coinsToApply={coinsToApply}
          displayCoins={liveCoins}
          onCoinsChange={setCoinsToApply}
          onLiveCoinsChange={setLiveCoins}
          onPay={pay}
          busy={busy}
          confirmingPayment={confirmingPayment}
          payLabel="Pay & upgrade"
          currentTierLabel={cardTierDisplayLabel(eligibility?.currentTier)}
          compact
          footerLink={{
            external: true,
            label: "Cancel",
            onClick: onClose,
          }}
        />
      </div>
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
    </div>,
    document.body,
  );
}
