import "../../styles/bpc-coin.css";

const ICON_SIZES = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
};

export function BpcCoinIcon({ size = "sm", className = "" }) {
  const px = typeof size === "number" ? size : (ICON_SIZES[size] ?? ICON_SIZES.sm);

  return (
    <img
      src="/bpc_coin.png"
      alt=""
      aria-hidden="true"
      className={`bpc-coin__icon ${className}`.trim()}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * Coin icon with optional amount + label, or custom children after the icon.
 */
export function BpcCoin({
  amount,
  label = "BPC coins",
  children,
  size = "sm",
  className = "",
  as: Tag = "span",
}) {
  return (
    <Tag className={`bpc-coin ${className}`.trim()}>
      <BpcCoinIcon size={size} />
      {children ?? (
        <>
          {amount != null ? <span className="bpc-coin__amount">{amount}</span> : null}
          <span className="bpc-coin__label">{label}</span>
        </>
      )}
    </Tag>
  );
}
