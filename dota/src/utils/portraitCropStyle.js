import { holoPayloadFromManifest } from "./holoCardEngine.js";

export const DEFAULT_PORTRAIT_CROP = { mode: "fit", zoom: 1, x: 0, y: 0 };

export const PORTRAIT_CROP_TIERS = ["player", "gold", "holo"];

export const MIN_PORTRAIT_ZOOM = 0.15;
export const MAX_PORTRAIT_ZOOM = 5;

/**
 * x / y = pan offset in % of the viewport (unbounded — black shows when image edge is exposed).
 * zoom = scale from center (MIN..MAX). Below 1 shrinks the image inside the frame.
 */
export function normalizePortraitCrop(input = {}) {
  const zoom = Number(input.zoom ?? input.avatarZoom ?? DEFAULT_PORTRAIT_CROP.zoom);
  return {
    mode: input.mode === "fill" ? "fill" : "fit",
    zoom:
      Number.isFinite(zoom) && zoom > 0
        ? Math.min(MAX_PORTRAIT_ZOOM, Math.max(MIN_PORTRAIT_ZOOM, zoom))
        : 1,
    x: Number(input.x ?? input.avatarX ?? 0) || 0,
    y: Number(input.y ?? input.avatarY ?? 0) || 0,
  };
}

export function defaultPortraitCropMap() {
  return {
    player: { ...DEFAULT_PORTRAIT_CROP },
    gold: { ...DEFAULT_PORTRAIT_CROP },
    holo: { ...DEFAULT_PORTRAIT_CROP },
  };
}

export function normalizePortraitCropMap(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return PORTRAIT_CROP_TIERS.reduce((acc, tier) => {
    acc[tier] = normalizePortraitCrop(source[tier] || DEFAULT_PORTRAIT_CROP);
    return acc;
  }, {});
}

/** Legacy holo JSON crop → pan %. */
export function holoEngineOffsetsToPan(avatarX, avatarY) {
  return {
    x: (Number(avatarX) / 420) * 100,
    y: (Number(avatarY) / 420) * 100,
  };
}

/** Scale factor to fit natural media inside a box (contain). */
export function fitMediaInBox(nw, nh, boxW, boxH) {
  if (!nw || !nh || !boxW || !boxH) return 1;
  return Math.min(boxW / nw, boxH / nh);
}

/**
 * Convert editor pan/zoom (image fit in stage at zoom=1) → stored card crop (fit in frame).
 */
export function editorStateToCardCrop(editorZoom, panX, panY, media, stage, frame) {
  const nw = media?.w || 0;
  const nh = media?.h || 0;
  const stageW = stage?.w || 0;
  const stageH = stage?.h || 0;
  const frameW = frame?.w || 0;
  const frameH = frame?.h || 0;
  if (!nw || !nh || !stageW || !stageH || !frameW || !frameH) {
    return { ...DEFAULT_PORTRAIT_CROP };
  }

  const stageFit = fitMediaInBox(nw, nh, stageW, stageH);
  const frameFit = fitMediaInBox(nw, nh, frameW, frameH);
  const displayW = nw * stageFit * editorZoom;
  const containW = nw * frameFit;

  return normalizePortraitCrop({
    x: (panX / frameW) * 100,
    y: (panY / frameH) * 100,
    zoom: containW > 0 ? displayW / containW : 1,
    mode: "fit",
  });
}

/**
 * Convert stored card crop → editor pan/zoom for the framing UI.
 */
export function cardCropToEditorState(crop, media, stage, frame) {
  const nw = media?.w || 0;
  const nh = media?.h || 0;
  const stageW = stage?.w || 0;
  const stageH = stage?.h || 0;
  const frameW = frame?.w || 0;
  const frameH = frame?.h || 0;
  const normalized = normalizePortraitCrop(crop);

  if (!nw || !nh || !stageW || !stageH || !frameW || !frameH) {
    return { editorZoom: 1, panX: 0, panY: 0, baseW: 0, baseH: 0 };
  }

  const stageFit = fitMediaInBox(nw, nh, stageW, stageH);
  const frameFit = fitMediaInBox(nw, nh, frameW, frameH);
  const dw = nw * stageFit;
  const containW = nw * frameFit;
  const displayW = containW * normalized.zoom;
  const editorZoom = dw > 0 ? displayW / dw : 1;

  return {
    editorZoom,
    panX: (normalized.x / 100) * frameW,
    panY: (normalized.y / 100) * frameH,
    baseW: dw,
    baseH: nh * stageFit,
  };
}

/**
 * Transform-based crop — image uses contain inside the card slot.
 */
export function portraitCropTransform(crop) {
  const { x, y, zoom, mode } = normalizePortraitCrop(crop);
  return {
    objectFit: mode === "fit" ? "contain" : "cover",
    transform: `translate(${x}%, ${y}%) scale(${zoom})`,
    transformOrigin: "center center",
  };
}

/** @deprecated Use portraitCropTransform */
export function portraitCropStyle(crop, _options = {}) {
  return portraitCropTransform(crop);
}

export function resolvePortraitCropForTier(manifest, tier) {
  const customAvatar = String(manifest?.customAvatarUrl || "").trim();
  const accountCrops = manifest?.customAvatarCrop || {};
  const tierCrop = accountCrops[tier];

  if (customAvatar && tierCrop) {
    return normalizePortraitCrop(tierCrop);
  }

  // Custom avatar without saved crop — show natural portrait until framing is saved.
  if (customAvatar) return null;

  if (tier === "holo") {
    const payload = holoPayloadFromManifest(manifest);
    const payloadCrop = manifest?.cardPayload?.crop;
    if (payloadCrop || payload.avatarX || payload.avatarY || payload.avatarZoom !== 1) {
      const pan = holoEngineOffsetsToPan(payload.avatarX, payload.avatarY);
      return normalizePortraitCrop({
        mode: payload.cropMode,
        zoom: payload.avatarZoom,
        x: pan.x,
        y: pan.y,
      });
    }
  }

  return null;
}

/** Frame viewport sizes for the CRM editor (centered in canvas wrap). */
export const TIER_FRAME_GUIDES = {
  player: {
    kind: "circle",
    widthPct: 42,
    maxWidthPx: 220,
  },
  gold: {
    kind: "rect",
    widthPct: 88,
    maxWidthPx: 480,
    aspectRatio: 62.5 / 41.67,
  },
  holo: {
    kind: "rect",
    widthPct: 56,
    maxWidthPx: 280,
    aspectRatio: 350 / 420,
  },
};

/** Larger crop frames for the upload modal. */
export const TIER_FRAME_GUIDES_MODAL = {
  player: {
    kind: "circle",
    widthPct: 72,
    maxWidthPx: 340,
  },
  gold: {
    kind: "rect",
    widthPct: 96,
    maxWidthPx: 620,
    aspectRatio: 62.5 / 41.67,
  },
  holo: {
    kind: "rect",
    widthPct: 78,
    maxWidthPx: 400,
    aspectRatio: 350 / 420,
  },
};

export function estimateFrameSize(tier, stageW, stageH, { variant = "inline" } = {}) {
  const guide = variant === "modal" ? TIER_FRAME_GUIDES_MODAL[tier] : TIER_FRAME_GUIDES[tier];
  if (!guide || !stageW || !stageH) return { w: 0, h: 0 };
  const width = Math.min(stageW * (guide.widthPct / 100), guide.maxWidthPx);
  const height = guide.kind === "circle" ? width : width / guide.aspectRatio;
  return { w: width, h: height };
}

export function frameGuideStyle(tier, { variant = "inline" } = {}) {
  const guide = variant === "modal" ? TIER_FRAME_GUIDES_MODAL[tier] : TIER_FRAME_GUIDES[tier];
  if (!guide) return {};
  return {
    width: `min(${guide.widthPct}%, ${guide.maxWidthPx}px)`,
    aspectRatio: guide.kind === "circle" ? "1" : String(guide.aspectRatio),
    borderRadius: guide.kind === "circle" ? "999px" : "0.5rem",
  };
}
