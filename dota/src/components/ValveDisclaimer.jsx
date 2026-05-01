import { VALVE_DISCLAIMER } from "../constants/legal.js";

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {"default" | "hero" | "compact"} [props.variant]
 * @param {boolean} [props.showTag]
 */
export function ValveDisclaimer({ className = "", variant = "default", showTag = true }) {
  const textSize =
    variant === "hero"
      ? "text-[10px] leading-snug sm:text-[11px]"
      : variant === "compact"
        ? "text-[11px] leading-relaxed sm:text-xs"
        : "text-xs leading-relaxed";
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      {showTag ? (
        <span className="inline-flex w-fit items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200">
          Disclaimer
        </span>
      ) : null}
      <p className={`${textSize} text-muted-foreground`}>{VALVE_DISCLAIMER}</p>
    </div>
  );
}
