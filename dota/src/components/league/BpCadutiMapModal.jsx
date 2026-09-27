import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineMinus, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export const BP_CADUTI_MAP_IMAGE = "/lore/bpcaduti.png";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.2;
const VIEWPORT_PAD = 8;

function clampScale(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value) || MIN_SCALE));
}

function fitMapDimensions(viewportWidth, viewportHeight, naturalWidth, naturalHeight) {
  const maxW = Math.max(1, viewportWidth - VIEWPORT_PAD * 2);
  const maxH = Math.max(1, viewportHeight - VIEWPORT_PAD * 2);
  const aspect = naturalWidth / naturalHeight;
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return { width, height };
}

export function BpCadutiMapModal({ open, onClose }) {
  useBodyScrollLock(open);
  const chromeRef = useRef(null);
  const viewportRef = useRef(null);
  const naturalSizeRef = useRef(null);
  const panRef = useRef(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [fitSize, setFitSize] = useState(null);
  const [isPanning, setIsPanning] = useState(false);

  const recomputeFit = useCallback(() => {
    const viewport = viewportRef.current;
    const natural = naturalSizeRef.current;
    if (!viewport || !natural) return;
    setFitSize(
      fitMapDimensions(viewport.clientWidth, viewport.clientHeight, natural.w, natural.h),
    );
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setScale(MIN_SCALE);
      setFitSize(null);
      naturalSizeRef.current = null;
      return;
    }
    const viewport = viewportRef.current;
    const chrome = chromeRef.current;
    if (!viewport) return undefined;

    const observer = new ResizeObserver(() => {
      if (scale === MIN_SCALE) recomputeFit();
    });
    observer.observe(viewport);
    if (chrome) observer.observe(chrome);
    return () => observer.disconnect();
  }, [open, scale, recomputeFit]);

  const zoomBy = useCallback((delta) => {
    setScale((current) => clampScale(current + delta));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(MIN_SCALE);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    recomputeFit();
  }, [recomputeFit]);

  useEffect(() => {
    if (!open) return undefined;

    function onWheel(event) {
      const viewport = viewportRef.current;
      if (!viewport || !viewport.contains(event.target)) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((current) => clampScale(current + delta));
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [open]);

  const onImageLoad = useCallback(
    (event) => {
      const img = event.currentTarget;
      naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      recomputeFit();
      requestAnimationFrame(() => recomputeFit());
    },
    [recomputeFit],
  );

  useEffect(() => {
    if (!open || !naturalSizeRef.current) return undefined;
    const id = requestAnimationFrame(() => recomputeFit());
    return () => cancelAnimationFrame(id);
  }, [open, recomputeFit]);

  const endPan = useCallback((event) => {
    const viewport = viewportRef.current;
    const pan = panRef.current;
    if (!pan?.active) return;
    if (event?.pointerId != null && pan.pointerId !== event.pointerId) return;
    if (viewport && pan.pointerId != null) {
      try {
        viewport.releasePointerCapture(pan.pointerId);
      } catch {
        /* already released */
      }
    }
    panRef.current = null;
    setIsPanning(false);
  }, []);

  const onViewportPointerDown = useCallback(
    (event) => {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const canPan =
      scale > MIN_SCALE ||
      viewport.scrollWidth > viewport.clientWidth + 1 ||
      viewport.scrollHeight > viewport.clientHeight + 1;
    if (!canPan) return;

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    panRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
    },
    [scale],
  );

  const onViewportPointerMove = useCallback((event) => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan?.active || !viewport || pan.pointerId !== event.pointerId) return;

    event.preventDefault();
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    viewport.scrollLeft = pan.scrollLeft - dx;
    viewport.scrollTop = pan.scrollTop - dy;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    return () => {
      panRef.current = null;
      setIsPanning(false);
    };
  }, [open]);

  if (!open) return null;

  const zoomPercent = Math.round(scale * 100);
  const displayWidth = fitSize ? fitSize.width * scale : undefined;
  const displayHeight = fitSize ? fitSize.height * scale : undefined;
  return createPortal(
    <div className="bp-caduti-map-modal" role="presentation">
      <button
        type="button"
        className="bp-caduti-map-modal__backdrop"
        aria-label="Close map"
        onClick={onClose}
      />
      <div
        className="bp-caduti-map-modal__shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bp-caduti-map-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header ref={chromeRef} className="bp-caduti-map-modal__chrome">
          <div className="bp-caduti-map-modal__chrome-row">
            <div className="bp-caduti-map-modal__chrome-copy">
              <h2 id="bp-caduti-map-title" className="bp-caduti-map-modal__title">BP Caduti</h2>
              <p className="bp-caduti-map-modal__caption">
                Continental chart · after the Grand Fracturing, 266 BC
              </p>
            </div>
            <div className="bp-caduti-map-modal__toolbar">
              <div className="bp-caduti-map-modal__zoom" aria-label="Map zoom controls">
                <button
                  type="button"
                  className="bp-caduti-map-modal__zoom-btn"
                  aria-label="Zoom out"
                  disabled={scale <= MIN_SCALE}
                  onClick={() => zoomBy(-ZOOM_STEP)}
                >
                  <HiOutlineMinus aria-hidden />
                </button>
                <span className="bp-caduti-map-modal__zoom-label">{zoomPercent}%</span>
                <button
                  type="button"
                  className="bp-caduti-map-modal__zoom-btn"
                  aria-label="Zoom in"
                  disabled={scale >= MAX_SCALE}
                  onClick={() => zoomBy(ZOOM_STEP)}
                >
                  <HiOutlinePlus aria-hidden />
                </button>
                <button type="button" className="bp-caduti-map-modal__zoom-reset" onClick={resetZoom}>
                  Fit
                </button>
              </div>
              <button
                type="button"
                className="bp-caduti-map-modal__close"
                onClick={onClose}
                aria-label="Close map"
              >
                <HiOutlineXMark aria-hidden />
              </button>
            </div>
          </div>
          <p className="bp-caduti-map-modal__hint">Drag to pan · scroll to zoom</p>
        </header>

        <div
          ref={viewportRef}
          className={[
            "bp-caduti-map-modal__viewport",
            scale > MIN_SCALE ? "bp-caduti-map-modal__viewport--zoomed" : "bp-caduti-map-modal__viewport--fit",
            isPanning ? "bp-caduti-map-modal__viewport--panning" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          tabIndex={0}
          role="region"
          aria-label="Zoomable map of BP Caduti"
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={endPan}
        >
          <figure
            className="bp-caduti-map-modal__figure"
            style={
              displayWidth && displayHeight
                ? { width: `${displayWidth}px`, height: `${displayHeight}px` }
                : undefined
            }
          >
            <img
              className="bp-caduti-map-modal__img"
              src={BP_CADUTI_MAP_IMAGE}
              alt="Fantasy map of the continent BP Caduti showing the Icy North, Arid West, Tropical East, Warm South, and Central Core"
              decoding="async"
              draggable={false}
              onLoad={onImageLoad}
            />
          </figure>
        </div>
      </div>
    </div>,
    document.body,
  );
}
