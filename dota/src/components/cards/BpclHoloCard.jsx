import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { resolveCardPortraitUrl } from "../../utils/resolvePlayerAvatar.js";
import {
  HOLO_HEIGHT,
  HOLO_WIDTH,
  createHoloCardEngine,
  holoPayloadFromManifest,
} from "../../utils/holoCardEngine.js";
import "./HoloCardStyles.css";

function readDisplayDpr() {
  if (typeof window === "undefined") return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5);
}

function isVideoPortraitUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (/^data:video\//i.test(value)) return true;
  try {
    const { pathname } = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://local");
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(pathname);
  } catch {
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value);
  }
}

function holoPortraitZoom(config) {
  const zoom = Number(config.avatarZoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function holoPortraitStyle(config) {
  const cropMode = config.cropMode === "fit" ? "contain" : "cover";
  const posX = Math.max(0, Math.min(100, (0.5 + config.avatarX / 840) * 100));
  const posY = Math.max(0, Math.min(100, (0.42 + config.avatarY / 840) * 100));
  const zoom = holoPortraitZoom(config);
  return {
    objectFit: cropMode,
    objectPosition: `${posX}% ${posY}%`,
    ...(zoom > 1 ? { transform: `scale(${zoom})` } : {}),
  };
}

function holoPortraitTransform(config, translate = { x: 0, y: 0 }) {
  const zoom = holoPortraitZoom(config);
  const { x, y } = translate;
  const hasTranslate = x !== 0 || y !== 0;
  if (!hasTranslate && zoom <= 1) return "";
  if (!hasTranslate) return `scale(${zoom})`;
  if (zoom <= 1) return `translate3d(${x}px, ${y}px, 0)`;
  return `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
}

export function BpclHoloCard({ manifest, size = "md", className = "", interactive = true }) {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const portraitRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(0);
  const shineRef = useRef({ x: 0.5, y: 0.5 });
  const dprRef = useRef(1);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [ready, setReady] = useState(false);
  const auraId = useId().replace(/:/g, "");

  const config = useMemo(() => holoPayloadFromManifest(manifest), [manifest]);
  const playerName = config.playerName || manifest?.displayName || "Player";
  const avatarUrl = resolveCardPortraitUrl(manifest);
  const isVideoPortrait = isVideoPortraitUrl(avatarUrl);
  const portraitStyle = useMemo(() => holoPortraitStyle(config), [config]);

  if (!engineRef.current) {
    engineRef.current = createHoloCardEngine();
  }

  const syncCanvasSurface = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = readDisplayDpr();
    dprRef.current = dpr;
    const pixelW = Math.round(HOLO_WIDTH * dpr);
    const pixelH = Math.round(HOLO_HEIGHT * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return ctx;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (typeof document !== "undefined" && document.fonts?.load) {
        await Promise.all([
          document.fonts.load('800 68px Oxanium'),
          document.fonts.load('900 46px Orbitron'),
          document.fonts.load('800 97px Oxanium'),
        ]).catch(() => {});
        await document.fonts.ready;
      }
      await engineRef.current.ensureFrame().catch(() => null);
      if (!cancelled) setReady(true);
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return undefined;

    const onResize = () => syncCanvasSurface();
    onResize();
    window.addEventListener("resize", onResize);

    const tick = () => {
      const ctx = syncCanvasSurface();
      if (ctx) {
        engineRef.current.render(ctx, config, shineRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [config, ready, syncCanvasSurface]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!interactive) return undefined;
    let raf;
    const smoothTilt = () => {
      const t = tilt.current;
      const dx = (t.tx - t.x) * 0.12;
      const dy = (t.ty - t.y) * 0.12;
      if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) {
        t.x += dx;
        t.y += dy;
        if (shellRef.current) {
          shellRef.current.style.transform = `perspective(900px) rotateX(${t.x}deg) rotateY(${t.y}deg)`;
        }
      } else if (t.x !== 0 || t.y !== 0) {
        t.x = 0;
        t.y = 0;
        if (shellRef.current) shellRef.current.style.transform = "";
      }
      raf = requestAnimationFrame(smoothTilt);
    };
    raf = requestAnimationFrame(smoothTilt);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  const onMove = useCallback(
    (event) => {
      if (!interactive) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = (event.clientX - rect.left) / rect.width;
      const my = (event.clientY - rect.top) / rect.height;
      shineRef.current = { x: mx, y: my };
      tilt.current.tx = (my - 0.5) * 14;
      tilt.current.ty = (0.5 - mx) * 14;
      if (portraitRef.current) {
        const px = (mx - 0.5) * 6;
        const py = (my - 0.5) * 5;
        portraitRef.current.style.transform = holoPortraitTransform(config, { x: px, y: py });
      }
    },
    [interactive, config],
  );

  const onLeave = useCallback(() => {
    shineRef.current = { x: 0.5, y: 0.5 };
    tilt.current.tx = 0;
    tilt.current.ty = 0;
    if (portraitRef.current) {
      portraitRef.current.style.transform = holoPortraitTransform(config);
    }
  }, [config]);

  return (
    <article
      className={`bpcl-holo-card bpcl-holo-card--${size} ${className}`.trim()}
      aria-label={`${playerName} holo card`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div ref={shellRef} className="bpcl-holo-card__tilt">
        <div className="bpcl-holo-card__aura" aria-hidden="true">
          <svg
            className="bpcl-holo-card__aura-svg"
            viewBox="0 0 400 600"
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <linearGradient id={`${auraId}-grad-a`} gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="360" y2="600">
                <stop offset="0%" stopColor="#ff4fbf" />
                <stop offset="22%" stopColor="#a979ff" />
                <stop offset="44%" stopColor="#42cfff" />
                <stop offset="66%" stopColor="#49f0bb" />
                <stop offset="88%" stopColor="#ffe36e" />
                <stop offset="100%" stopColor="#ff739d" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  from="0 200 300"
                  to="360 200 300"
                  dur="14s"
                  repeatCount="indefinite"
                />
              </linearGradient>
              <linearGradient id={`${auraId}-grad-b`} gradientUnits="userSpaceOnUse" x1="360" y1="0" x2="40" y2="600">
                <stop offset="0%" stopColor="#42cfff" />
                <stop offset="30%" stopColor="#49f0bb" />
                <stop offset="55%" stopColor="#ffe36e" />
                <stop offset="78%" stopColor="#ff4fbf" />
                <stop offset="100%" stopColor="#a979ff" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  from="360 200 300"
                  to="0 200 300"
                  dur="18s"
                  repeatCount="indefinite"
                />
              </linearGradient>
              <filter id={`${auraId}-depth`} x="-60%" y="-40%" width="220%" height="200%" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#08061a" floodOpacity="0.72" />
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <filter id={`${auraId}-glow-soft`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter id={`${auraId}-glow-mid`} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <polygon
              className="bpcl-holo-card__aura-shadow"
              points="16,0 384,0 400,24 400,576 384,600 16,600 0,576 0,24"
              fill="none"
              stroke="#120e28"
              filter={`url(#${auraId}-depth)`}
            />
            <polygon
              className="bpcl-holo-card__aura-stroke bpcl-holo-card__aura-stroke--wide"
              points="16,0 384,0 400,24 400,576 384,600 16,600 0,576 0,24"
              fill="none"
              stroke={`url(#${auraId}-grad-a)`}
              filter={`url(#${auraId}-glow-soft)`}
            />
            <polygon
              className="bpcl-holo-card__aura-stroke bpcl-holo-card__aura-stroke--mid"
              points="16,0 384,0 400,24 400,576 384,600 16,600 0,576 0,24"
              fill="none"
              stroke={`url(#${auraId}-grad-b)`}
              filter={`url(#${auraId}-glow-mid)`}
            />
          </svg>
        </div>
        <div className="bpcl-holo-card__shell">
          <div className="bpcl-holo-card__portrait-slot">
            {avatarUrl && isVideoPortrait ? (
              <video
                ref={portraitRef}
                src={avatarUrl}
                className="bpcl-holo-card__portrait"
                style={portraitStyle}
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
              />
            ) : avatarUrl ? (
              <img
                ref={portraitRef}
                src={avatarUrl}
                alt=""
                className="bpcl-holo-card__portrait"
                style={portraitStyle}
                decoding="async"
              />
            ) : (
              <div className="bpcl-holo-card__portrait bpcl-holo-card__portrait--empty" aria-hidden="true" />
            )}
          </div>
          <canvas
            ref={canvasRef}
            className="bpcl-holo-card__canvas"
            aria-hidden="true"
          />
          <div className="bpcl-holo-card__portrait-fx" aria-hidden="true">
            <div className="bpcl-holo-card__portrait-vignette" />
            <div className="bpcl-holo-card__portrait-rim" />
            <div className="bpcl-holo-card__portrait-depth" />
          </div>
          <div className="bpcl-holo-card__frame-edge-soften" aria-hidden="true" />
        </div>
        <div className="bpcl-holo-card__foil" aria-hidden="true">
          <span className="bpcl-holo-card__foil-shine" />
        </div>
      </div>
    </article>
  );
}
