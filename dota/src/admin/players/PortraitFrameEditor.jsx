import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BpclCardMini } from "../../components/cards/BpclCardRenderer.jsx";
import {
  MIN_PORTRAIT_ZOOM,
  MAX_PORTRAIT_ZOOM,
  PORTRAIT_CROP_TIERS,
  cardCropToEditorState,
  defaultPortraitCropMap,
  editorStateToCardCrop,
  estimateFrameSize,
  frameGuideStyle,
  normalizePortraitCrop,
  normalizePortraitCropMap,
} from "../../utils/portraitCropStyle.js";

const TIER_LABELS = {
  player: "Basic",
  gold: "Gold",
  holo: "Holo",
};

const PREVIEW_THROTTLE_MS = 100;
const DEFAULT_EDITOR_ZOOM = 1;

function readBoxSize(element) {
  if (!element) return { w: 0, h: 0 };
  const rect = element.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

const PortraitFrameCardPreview = memo(function PortraitFrameCardPreview({ manifest }) {
  if (!manifest) return null;
  return <BpclCardMini manifest={manifest} />;
});

export function PortraitFrameEditor({
  imageUrl,
  crops,
  cropsRef,
  onCropsChange,
  baseManifest,
  disabled = false,
  variant = "inline",
}) {
  const [activeTier, setActiveTier] = useState("player");
  const [localCrops, setLocalCrops] = useState(() => normalizePortraitCropMap(crops));
  const [previewCrops, setPreviewCrops] = useState(() => normalizePortraitCropMap(crops));
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [editorZoom, setEditorZoom] = useState(DEFAULT_EDITOR_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const liveEditorRef = useRef({ zoom: DEFAULT_EDITOR_ZOOM, panX: 0, panY: 0 });
  const dragRafRef = useRef(0);
  const previewTimerRef = useRef(0);
  const localCropsRef = useRef(localCrops);
  const geometryRef = useRef({ media: mediaSize, stage: stageSize, frame: frameSize });
  const initializedForImageRef = useRef("");
  const skipTierSyncRef = useRef(false);

  const isModal = variant === "modal";
  const geometryReady =
    mediaSize.w > 0 && mediaSize.h > 0 && stageSize.w > 0 && frameSize.w > 0;

  geometryRef.current = { media: mediaSize, stage: stageSize, frame: frameSize };

  const syncExternalCrops = useCallback(
    (nextCrops) => {
      const normalized = normalizePortraitCropMap(nextCrops);
      if (cropsRef) cropsRef.current = normalized;
      onCropsChange?.(normalized);
    },
    [cropsRef, onCropsChange],
  );

  const fitBase = useMemo(() => {
    if (!geometryReady) return { w: 0, h: 0 };
    const stageFit = Math.min(stageSize.w / mediaSize.w, stageSize.h / mediaSize.h);
    return { w: mediaSize.w * stageFit, h: mediaSize.h * stageFit };
  }, [geometryReady, mediaSize, stageSize]);

  const applyEditorToCrops = useCallback(
    (zoom, panX, panY, tier = activeTier) => {
      const { media, stage, frame } = geometryRef.current;
      const cardCrop = editorStateToCardCrop(zoom, panX, panY, media, stage, frame);
      const next = normalizePortraitCropMap(localCropsRef.current);
      next[tier] = cardCrop;
      return next;
    },
    [activeTier],
  );

  const syncEditorFromCrop = useCallback(
    (tier, cropMap = localCropsRef.current) => {
      const { media, stage, frame } = geometryRef.current;
      const derived = cardCropToEditorState(cropMap[tier] || normalizePortraitCrop(), media, stage, frame);
      liveEditorRef.current = { zoom: derived.editorZoom, panX: derived.panX, panY: derived.panY };
      setEditorZoom(derived.editorZoom);
      setPan({ x: derived.panX, y: derived.panY });
    },
    [],
  );

  useEffect(() => {
    localCropsRef.current = localCrops;
    syncExternalCrops(localCrops);
  }, [localCrops, syncExternalCrops]);

  useEffect(() => {
    initializedForImageRef.current = "";
    setMediaSize({ w: 0, h: 0 });
  }, [imageUrl]);

  useEffect(() => {
    if (!geometryReady || !imageUrl) return;
    if (initializedForImageRef.current === imageUrl) return;
    initializedForImageRef.current = imageUrl;
    skipTierSyncRef.current = true;

    liveEditorRef.current = { zoom: DEFAULT_EDITOR_ZOOM, panX: 0, panY: 0 };
    setEditorZoom(DEFAULT_EDITOR_ZOOM);
    setPan({ x: 0, y: 0 });

    const next = defaultPortraitCropMap();
    PORTRAIT_CROP_TIERS.forEach((tier) => {
      const frame = estimateFrameSize(tier, stageSize.w, stageSize.h, { variant });
      next[tier] = editorStateToCardCrop(
        DEFAULT_EDITOR_ZOOM,
        0,
        0,
        mediaSize,
        stageSize,
        frame,
      );
    });
    setLocalCrops(next);
    localCropsRef.current = next;
    setPreviewCrops(next);
    if (cropsRef) cropsRef.current = next;
  }, [cropsRef, geometryReady, imageUrl, mediaSize, stageSize, variant]);

  useEffect(() => {
    if (!geometryReady || !frameSize.w) return;
    if (skipTierSyncRef.current) {
      skipTierSyncRef.current = false;
      return;
    }
    syncEditorFromCrop(activeTier);
  }, [activeTier, frameSize.h, frameSize.w, geometryReady, syncEditorFromCrop]);

  useEffect(() => {
    const stageEl = stageRef.current;
    const frameEl = frameRef.current;
    if (!stageEl) return undefined;

    const measure = () => {
      setStageSize(readBoxSize(stageEl));
      setFrameSize(readBoxSize(frameEl));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stageEl);
    if (frameEl) observer.observe(frameEl);
    return () => observer.disconnect();
  }, [activeTier, imageUrl, isModal]);

  const syncPreviewNow = useCallback((nextCrops) => {
    window.clearTimeout(previewTimerRef.current);
    setPreviewCrops(normalizePortraitCropMap(nextCrops));
  }, []);

  const schedulePreviewSync = useCallback(
    (nextCrops) => {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = window.setTimeout(() => {
        syncPreviewNow(nextCrops);
      }, PREVIEW_THROTTLE_MS);
    },
    [syncPreviewNow],
  );

  const commitCrops = useCallback(
    (nextCrops) => {
      const normalized = normalizePortraitCropMap(nextCrops);
      setLocalCrops(normalized);
      localCropsRef.current = normalized;
      syncPreviewNow(normalized);
    },
    [syncPreviewNow],
  );

  const previewManifest = useMemo(() => {
    if (!baseManifest) return null;
    return {
      ...baseManifest,
      tier: activeTier,
      renderTier: activeTier,
      template: activeTier,
      customAvatarUrl: imageUrl,
      avatarUrl: imageUrl,
      customAvatarCrop: previewCrops,
      cardPayload: {
        ...(baseManifest.cardPayload || {}),
        template: activeTier,
        avatarUrl: imageUrl,
      },
    };
  }, [activeTier, baseManifest, imageUrl, previewCrops]);

  const onMediaLoad = useCallback((event) => {
    setMediaSize({
      w: event.currentTarget.naturalWidth || 0,
      h: event.currentTarget.naturalHeight || 0,
    });
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (disabled) return;
      stageRef.current?.setPointerCapture(event.pointerId);
      liveEditorRef.current = {
        zoom: editorZoom,
        panX: pan.x,
        panY: pan.y,
      };
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        baseX: pan.x,
        baseY: pan.y,
      };
    },
    [disabled, editorZoom, pan.x, pan.y],
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!dragRef.current.active || disabled) return;

      const clientX = event.clientX;
      const clientY = event.clientY;

      if (dragRafRef.current) {
        window.cancelAnimationFrame(dragRafRef.current);
      }

      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = 0;
        const panX = dragRef.current.baseX + (clientX - dragRef.current.startX);
        const panY = dragRef.current.baseY + (clientY - dragRef.current.startY);
        const zoom = liveEditorRef.current.zoom;

        liveEditorRef.current = { zoom, panX, panY };
        setPan({ x: panX, y: panY });

        const next = applyEditorToCrops(zoom, panX, panY);
        schedulePreviewSync(next);
      });
    },
    [applyEditorToCrops, disabled, schedulePreviewSync],
  );

  const finishPointer = useCallback(
    (event) => {
      dragRef.current.active = false;
      if (dragRafRef.current) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      if (stageRef.current?.hasPointerCapture(event.pointerId)) {
        stageRef.current.releasePointerCapture(event.pointerId);
      }
      const { zoom, panX, panY } = liveEditorRef.current;
      const next = applyEditorToCrops(zoom, panX, panY);
      commitCrops(next);
    },
    [applyEditorToCrops, commitCrops],
  );

  const onZoomInput = useCallback(
    (event) => {
      if (disabled) return;
      const zoom = Number(event.target.value);
      const panX = liveEditorRef.current.panX ?? pan.x;
      const panY = liveEditorRef.current.panY ?? pan.y;

      liveEditorRef.current = { zoom, panX, panY };
      setEditorZoom(zoom);
      setPan({ x: panX, y: panY });

      const next = applyEditorToCrops(zoom, panX, panY);
      schedulePreviewSync(next);
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = window.setTimeout(() => {
        commitCrops(next);
      }, PREVIEW_THROTTLE_MS);
    },
    [applyEditorToCrops, commitCrops, disabled, pan.x, pan.y, schedulePreviewSync],
  );

  const onTierChange = useCallback(
    (tier) => {
      if (dragRef.current.active) return;
      setActiveTier(tier);
      syncEditorFromCrop(tier);
    },
    [syncEditorFromCrop],
  );

  const resetFraming = useCallback(() => {
    const reset = defaultPortraitCropMap();
    liveEditorRef.current = { zoom: DEFAULT_EDITOR_ZOOM, panX: 0, panY: 0 };
    setEditorZoom(DEFAULT_EDITOR_ZOOM);
    setPan({ x: 0, y: 0 });

    if (geometryReady) {
      const frame = frameSize.w > 0 ? frameSize : estimateFrameSize(activeTier, stageSize.w, stageSize.h, { variant });
      PORTRAIT_CROP_TIERS.forEach((tier) => {
        const tierFrame =
          tier === activeTier
            ? frame
            : estimateFrameSize(tier, stageSize.w, stageSize.h, { variant });
        reset[tier] = editorStateToCardCrop(
          DEFAULT_EDITOR_ZOOM,
          0,
          0,
          mediaSize,
          stageSize,
          tierFrame,
        );
      });
    }
    commitCrops(reset);
  }, [activeTier, commitCrops, frameSize, geometryReady, mediaSize, stageSize, variant]);

  useEffect(() => {
    return () => {
      window.clearTimeout(previewTimerRef.current);
      if (dragRafRef.current) window.cancelAnimationFrame(dragRafRef.current);
    };
  }, []);

  const frameStyle = useMemo(() => frameGuideStyle(activeTier, { variant }), [activeTier, variant]);

  const imageStyle = useMemo(() => {
    if (!geometryReady || !fitBase.w) {
      return {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center center",
      };
    }
    return {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${fitBase.w}px`,
      height: `${fitBase.h}px`,
      transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${editorZoom})`,
      transformOrigin: "center center",
      willChange: "transform",
    };
  }, [editorZoom, fitBase.h, fitBase.w, geometryReady, pan.x, pan.y]);

  if (!imageUrl) return null;

  return (
    <div className={`portrait-frame-editor${isModal ? " portrait-frame-editor--modal" : ""}`}>
      <div className="portrait-frame-editor__tier-tabs" role="tablist" aria-label="Card tier selection">
        {PORTRAIT_CROP_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            role="tab"
            aria-selected={activeTier === tier}
            className={`portrait-frame-editor__tier-tab${activeTier === tier ? " is-active" : ""}`}
            disabled={disabled}
            onClick={() => onTierChange(tier)}
          >
            {TIER_LABELS[tier]}
          </button>
        ))}
      </div>

      <div className="portrait-frame-editor__workspace">
        <div className="portrait-frame-editor__controls">
          <p className="portrait-frame-editor__hint">
            The full image loads above. Use the dashed outline to choose what appears on each card tier. Drag to
            reposition, zoom to scale the entire image.
          </p>
          <div className="portrait-frame-editor__canvas-wrap">
            <div
              ref={stageRef}
              className="portrait-frame-editor__stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
            >
              <div
                ref={frameRef}
                className={`portrait-frame-editor__selection-backdrop portrait-frame-editor__selection-backdrop--${activeTier}`}
                style={frameStyle}
                aria-hidden="true"
              />
              <img
                key={imageUrl}
                src={imageUrl}
                alt=""
                className="portrait-frame-editor__media"
                style={imageStyle}
                draggable={false}
                onLoad={onMediaLoad}
              />
              <div
                className={`portrait-frame-editor__selection-mask portrait-frame-editor__selection-mask--${activeTier}`}
                style={frameStyle}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="portrait-frame-editor__toolbar">
            <label className="portrait-frame-editor__zoom">
              <span>Zoom</span>
              <input
                type="range"
                min={MIN_PORTRAIT_ZOOM}
                max={MAX_PORTRAIT_ZOOM}
                step="0.01"
                value={editorZoom}
                disabled={disabled}
                onInput={onZoomInput}
              />
              <span className="portrait-frame-editor__zoom-value">{editorZoom.toFixed(2)}×</span>
            </label>
            <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={resetFraming}>
              Reset framing
            </button>
          </div>
        </div>

        <div className="portrait-frame-editor__card-section">
          <p className="portrait-frame-editor__preview-label">Card preview</p>
          <div className="portrait-frame-editor__card-preview">
            <PortraitFrameCardPreview manifest={previewManifest} />
          </div>
        </div>
      </div>
    </div>
  );
}
