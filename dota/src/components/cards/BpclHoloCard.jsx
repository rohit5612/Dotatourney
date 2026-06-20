import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function BpclHoloCard({ manifest, size = "md", className = "", interactive = true, showAura = true }) {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(0);
  const shineRef = useRef({ x: 0.5, y: 0.5 });
  const dprRef = useRef(1);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [ready, setReady] = useState(false);

  const config = useMemo(() => holoPayloadFromManifest(manifest), [manifest]);
  const playerName = config.playerName || manifest?.displayName || "Player";
  const avatarUrl = resolveCardPortraitUrl(manifest);

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
          document.fonts.load('800 84px Oxanium'),
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
    const engine = engineRef.current;
    if (!avatarUrl) {
      engine.releaseAvatar();
      return undefined;
    }
    let cancelled = false;
    engine.loadAvatarFromUrl(avatarUrl).catch(() => {
      if (!cancelled) engine.releaseAvatar();
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

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
      engineRef.current?.releaseAvatar();
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
    },
    [interactive],
  );

  const onLeave = useCallback(() => {
    shineRef.current = { x: 0.5, y: 0.5 };
    tilt.current.tx = 0;
    tilt.current.ty = 0;
  }, []);

  return (
    <article
      className={`bpcl-holo-card bpcl-holo-card--${size} ${className}`.trim()}
      aria-label={`${playerName} holo card`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div ref={shellRef} className="bpcl-holo-card__tilt">
        <div className="bpcl-holo-card__radiate" aria-hidden="true" />
        {showAura ? <div className="bpcl-holo-card__glow" aria-hidden="true" /> : null}
        <div className="bpcl-holo-card__shell">
          <canvas
            ref={canvasRef}
            className="bpcl-holo-card__canvas"
            aria-hidden="true"
          />
          <div className="bpcl-holo-card__foil" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
