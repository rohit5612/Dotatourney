import { VALVE_DISCLAIMER } from "../constants/legal.js";

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {"default" | "hero" | "compact"} [props.variant]
 * @param {boolean} [props.showTag] — compact defaults to no tag
 */
export function ValveDisclaimer({ className = "", variant = "default", showTag }) {
  const showLabel = showTag ?? variant !== "compact";

  return (
    <div
      className={`valve-disclaimer valve-disclaimer--${variant}${className ? ` ${className}` : ""}`}
      role="note"
      aria-label="Valve trademark disclaimer"
    >
      {showLabel ? <span className="valve-disclaimer__label">Disclaimer</span> : null}
      <p className="valve-disclaimer__text">{VALVE_DISCLAIMER}</p>
    </div>
  );
}
