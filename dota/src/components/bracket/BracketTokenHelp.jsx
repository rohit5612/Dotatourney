import { useEffect, useId, useRef, useState } from "react";
import "../../styles/bracket-token-help.css";

/**
 * Tap/click-friendly bracket placeholder explainer (mobile-safe; title alone is not).
 */
export function BracketTokenHelp({ help, label, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!help) return null;

  const ariaLabel = label ? `${label}: ${help}` : help;

  return (
    <span className={`bracket-token-help${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        type="button"
        className="bracket-token-help__btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={popoverId}
        title={help}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className="bracket-token-help__mark" aria-hidden>
          ?
        </span>
      </button>
      {open ? (
        <span id={popoverId} role="tooltip" className="bracket-token-help__popover">
          {help}
        </span>
      ) : null}
    </span>
  );
}
