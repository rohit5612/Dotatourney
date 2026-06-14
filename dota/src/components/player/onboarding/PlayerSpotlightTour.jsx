import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../../styles/player-onboarding.css";

function getTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function TooltipPanel({ step, stepIndex, stepsLength, onNext, onBack, onSkip, targetRect }) {
  const isCenter = step.placement === "center" || !targetRect;
  const panelRef = useRef(null);
  const [style, setStyle] = useState({});

  useLayoutEffect(() => {
    if (isCenter) {
      setStyle({});
      return;
    }

    const panel = panelRef.current;
    if (!panel || !targetRect) return;

    const margin = 14;
    const panelRect = panel.getBoundingClientRect();
    let top = targetRect.top + targetRect.height + margin;
    let left = targetRect.left;

    if (step.placement === "right") {
      top = targetRect.top;
      left = targetRect.left + targetRect.width + margin;
    } else if (step.placement === "left") {
      top = targetRect.top;
      left = targetRect.left - panelRect.width - margin;
    } else if (step.placement === "top") {
      top = targetRect.top - panelRect.height - margin;
      left = targetRect.left;
    }

    const maxLeft = window.innerWidth - panelRect.width - 12;
    const maxTop = window.innerHeight - panelRect.height - 12;
    left = Math.max(12, Math.min(left, maxLeft));
    top = Math.max(12, Math.min(top, maxTop));

    setStyle({ top: `${top}px`, left: `${left}px` });
  }, [isCenter, step.placement, targetRect, step.title]);

  return (
    <div
      ref={panelRef}
      className={`player-tour__panel${isCenter ? " player-tour__panel--center" : ""}`}
      style={style}
      role="dialog"
      aria-labelledby="player-tour-title"
      aria-describedby="player-tour-body"
    >
      <p className="player-tour__step-count">
        Step {stepIndex + 1} of {stepsLength}
      </p>
      <h2 id="player-tour-title" className="player-tour__title">
        {step.title}
      </h2>
      <p id="player-tour-body" className="player-tour__body">
        {step.body}
      </p>
      <div className="player-tour__actions">
        {stepIndex > 0 ? (
          <button type="button" className="player-tour__btn player-tour__btn--ghost" onClick={onBack}>
            Back
          </button>
        ) : (
          <button type="button" className="player-tour__btn player-tour__btn--ghost" onClick={onSkip}>
            Skip tour
          </button>
        )}
        <button type="button" className="player-tour__btn player-tour__btn--primary" onClick={onNext}>
          {stepIndex < stepsLength - 1 ? "Next" : "Got it"}
        </button>
      </div>
    </div>
  );
}

export function PlayerSpotlightTour({ open, step, stepIndex, stepsLength, onNext, onBack, onSkip }) {
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!open || !step) return undefined;

    function updateRect() {
      setTargetRect(getTargetRect(step.target));
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    const observer = new ResizeObserver(updateRect);
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      observer.disconnect();
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onSkip();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onSkip]);

  if (!open || !step) return null;

  const isCenter = step.placement === "center" || !step.target || !targetRect;

  return createPortal(
    <div className="player-tour" aria-modal="true">
      <div className="player-tour__backdrop" aria-hidden="true" />
      {!isCenter && targetRect ? (
        <div
          className="player-tour__spotlight"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          aria-hidden="true"
        />
      ) : null}
      <TooltipPanel
        step={step}
        stepIndex={stepIndex}
        stepsLength={stepsLength}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        targetRect={isCenter ? null : targetRect}
      />
    </div>,
    document.body
  );
}
