import { Link } from "react-router-dom";
import { CardTierPreviewImage } from "../cards/CardTierPreviewImage.jsx";
import { BpcCoin, BpcCoinIcon } from "../coins/BpcCoin.jsx";
import { BpcCoinSlider } from "../coins/BpcCoinSlider.jsx";
import { DashboardActionIcon } from "./DashboardActionIcon.jsx";
import { cardTierDisplayLabel } from "../../constants/cardTierPreviews.js";
import { formatDiscountLabel } from "../../utils/commerceBundle.js";

const TIER_HINTS = {
  default: "Standard season registration",
  player: "Dark frame + stats",
  gold: "Gold frame + Custom logo slot",
  holo: "Holo frame, Custom Avatar slot + privileges*",
};

/**
 * Shared tier picker + order summary for registration checkout and card upgrades.
 */
export function BundleCheckoutPanel({
  mode = "registration",
  selectedTier,
  onSelectTier,
  tierEntries = [],
  preview,
  previewLoading = false,
  tournamentName = "",
  coinsToApply,
  onCoinsChange,
  onLiveCoinsChange,
  displayCoins,
  onPay,
  busy = false,
  confirmingPayment = false,
  payLabel = "Pay & register",
  footerLink = null,
  currentTierLabel = "",
  compact = false,
}) {
  const maxCoins = preview?.maxCoinsApplicable ?? 0;
  const coinBalance = preview?.coinBalance ?? 0;
  const coinSliderMax = Math.min(maxCoins, coinBalance);
  const minCash = preview?.commerce?.minCashRupees ?? 100;
  const subtotal = preview?.subtotal ?? 0;
  const appliedCoins = Math.min(displayCoins ?? coinsToApply, coinSliderMax);
  const displayTotal = preview ? Math.max(minCash, subtotal - appliedCoins) : 0;
  const tiers = preview?.commerce?.cardTiers || {};

  const title = mode === "upgrade" ? "Upgrade card" : "Card bundle";
  const subtitle =
    mode === "upgrade"
      ? "Choose a higher tier for this season"
      : "Pick the player card style for this season";

  return (
    <div className={`player-reg__layout player-reg__layout--checkout${compact ? " player-reg__layout--compact" : ""}`}>
      <section className="player-dash__card player-dash__section-card">
        <header className="player-dash__card-head player-dash__card-head--compact">
          <div className="player-dash__section-title-row">
            <span className="player-dash__section-icon" aria-hidden="true">
              <DashboardActionIcon name="tournaments" />
            </span>
            <div>
              <h2 className="player-dash__card-title">{title}</h2>
              <p className="player-dash__card-sub">{subtitle}</p>
            </div>
          </div>
        </header>

        {mode === "upgrade" && currentTierLabel ? (
          <p className="player-reg__upgrade-from">
            Current tier: <strong>{currentTierLabel}</strong>
          </p>
        ) : null}

        <div className="player-reg__tier-grid">
          {tierEntries.map(({ id, label, description, price, discountPercent }) => {
            const discountLabel = formatDiscountLabel(discountPercent);
            return (
              <button
                key={id}
                type="button"
                className={`player-reg__tier-card player-reg__tier-card--${id}${selectedTier === id ? " is-selected" : ""}`}
                onClick={() => onSelectTier(id)}
                aria-pressed={selectedTier === id}
              >
                <span className="player-reg__tier-card-label">{label || cardTierDisplayLabel(id)}</span>
                <span className="player-reg__tier-card-price">
                  {mode === "upgrade" ? `+₹${price}` : `₹${price}`}
                </span>
                <span className="player-reg__tier-card-desc">
                  {description || TIER_HINTS[id] || ""}
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
          <CardTierPreviewImage tier={selectedTier} size="md" className="player-reg__card-preview-art" />
        </div>
      </section>

      <aside className="player-reg__aside player-reg__aside--sticky">
        <section className="player-dash__card player-dash__section-card player-reg__summary">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <h2 className="player-dash__card-title">Order summary</h2>
            <p className="player-dash__card-sub">{tournamentName || "Tournament registration"}</p>
          </header>

          {mode === "upgrade" ? (
            <p className="player-reg__field-hint player-reg__upgrade-hint">
              Upgrade price is based on current season bundle pricing. Coins used at registration do not reduce this
              amount.
            </p>
          ) : null}

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
                    <span>{preview.lineItems[0]?.label || tiers[selectedTier]?.label || "Bundle"}</span>
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
                  onChange={onCoinsChange}
                  onLiveChange={onLiveCoinsChange}
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
                onClick={onPay}
                disabled={busy || confirmingPayment || !preview}
              >
                <DashboardActionIcon name="tournaments" />
                <span>
                  {busy ? "Processing…" : confirmingPayment ? "Confirming payment…" : payLabel}
                </span>
              </button>

              {footerLink ? (
                footerLink.external ? (
                  <button
                    type="button"
                    className="player-dash__action player-dash__action--public player-reg__back-link"
                    onClick={footerLink.onClick}
                  >
                    <span>{footerLink.label}</span>
                  </button>
                ) : (
                  <Link to={footerLink.to} className="player-dash__action player-dash__action--public player-reg__back-link">
                    <span>{footerLink.label}</span>
                  </Link>
                )
              ) : null}
            </>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
