import { useCallback, useEffect, useState } from "react";

/**
 * Fixed viewport position for navbar dropdowns — keeps panels out of document flow.
 */
export function useFloatingDropdownPosition(triggerRef, open, { offset = 9, edgeGap = 12 } = {}) {
  const [style, setStyle] = useState(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: Math.round(rect.bottom + offset),
      right: Math.max(edgeGap, Math.round(window.innerWidth - rect.right)),
      left: "auto",
      zIndex: 1300,
    });
  }, [edgeGap, offset, triggerRef]);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return undefined;
    }

    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true, capture: true });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}
