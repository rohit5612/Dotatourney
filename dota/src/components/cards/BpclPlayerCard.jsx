import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveCardPortraitUrl } from "../../utils/resolvePlayerAvatar.js";
import { portraitCropTransform, resolvePortraitCropForTier } from "../../utils/portraitCropStyle.js";
import { ResponsiveCardName } from "./ResponsiveCardName.jsx";
import "./PlayerCardStyles.css";

function statValue(stats, key) {
  if (!stats) return "--";
  const value = stats[key];
  return value == null || value === "" ? "--" : String(value);
}

export function BpclPlayerCard({ manifest, size = "md", className = "", interactive = true }) {
  const cardRef = useRef(null);
  const shimmerRef = useRef(null);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const payload = manifest?.cardPayload || {};
  const stats = payload.stats || manifest?.stats || {};
  const playerName = payload.playerName || manifest?.displayName || "Player";
  const avatarUrl = resolveCardPortraitUrl(manifest);
  const portraitCrop = useMemo(() => resolvePortraitCropForTier(manifest, "player"), [manifest]);
  const portraitStyle = useMemo(
    () => (portraitCrop ? portraitCropTransform(portraitCrop) : undefined),
    [portraitCrop],
  );

  const statRows = [
    { key: "kda", label: "KDA", value: statValue(stats, "kda") },
    { key: "gpm", label: "AVG GPM", value: statValue(stats, "gpm") },
    { key: "xpm", label: "AVG XPM", value: statValue(stats, "xpm") },
    { key: "winrate", label: "WINRATE", value: statValue(stats, "winrate") },
  ];

  function statValueSizeClass(key, value) {
    const text = String(value ?? "--");
    if (key !== "kda") {
      if (text.length > 4) return "bpcl-player-card__stat-value--compact";
      return "";
    }
    if (text.includes("/")) {
      if (text.length >= 9) return "bpcl-player-card__stat-value--kda-ratio-xs";
      if (text.length >= 7) return "bpcl-player-card__stat-value--kda-ratio-sm";
      return "bpcl-player-card__stat-value--kda-ratio";
    }
    if (text.length > 5) return "bpcl-player-card__stat-value--kda-decimal-sm";
    return "bpcl-player-card__stat-value--kda-decimal";
  }

  useEffect(() => {
    if (!interactive) return undefined;
    let raf;
    const tick = () => {
      const t = tilt.current;
      const dx = (t.tx - t.x) * 0.12;
      const dy = (t.ty - t.y) * 0.12;
      if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) {
        t.x += dx;
        t.y += dy;
        if (cardRef.current) {
          cardRef.current.style.transform = `perspective(900px) rotateX(${t.x}deg) rotateY(${t.y}deg)`;
        }
      } else if (t.x !== 0 || t.y !== 0) {
        t.x = 0;
        t.y = 0;
        if (cardRef.current) cardRef.current.style.transform = "";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  const onMove = useCallback(
    (event) => {
      if (!interactive) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = (event.clientX - rect.left) / rect.width;
      const my = (event.clientY - rect.top) / rect.height;
      tilt.current.tx = (my - 0.5) * 12;
      tilt.current.ty = (0.5 - mx) * 12;
      if (shimmerRef.current) {
        shimmerRef.current.style.background = `radial-gradient(ellipse 70% 70% at ${mx * 100}% ${my * 100}%, rgba(255,255,255,.12) 0%, transparent 58%)`;
      }
    },
    [interactive],
  );

  const onLeave = useCallback(() => {
    tilt.current.tx = 0;
    tilt.current.ty = 0;
    if (shimmerRef.current) shimmerRef.current.style.background = "";
  }, []);

  return (
    <article
      className={`bpcl-player-card bpcl-player-card--${size} ${className}`.trim()}
      aria-label={`${playerName} player card`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div ref={cardRef} className="bpcl-player-card__tilt">
        <div className="bpcl-player-card__glow" aria-hidden="true" />
        <div className="bpcl-player-card__frame-wrap">
          <div className="bpcl-player-card__portrait-slot">
            <img
              {...(avatarUrl ? { src: avatarUrl } : {})}
              alt=""
              className="bpcl-player-card__portrait"
              style={portraitStyle}
              hidden={!avatarUrl}
              decoding="async"
            />
            <div
              className="bpcl-player-card__portrait bpcl-player-card__portrait--empty"
              aria-hidden="true"
              hidden={Boolean(avatarUrl)}
            />
            <div className="bpcl-player-card__portrait-shine" aria-hidden="true" />
          </div>
          <img src="/cards/player/frame-base.png" alt="" className="bpcl-player-card__frame" decoding="async" />
          <div className="bpcl-player-card__art">
            <div className="bpcl-player-card__top-plaque" aria-hidden="true">
              <p className="bpcl-player-card__bpcl-logo">BPCL</p>
              <p className="bpcl-player-card__bpcl-league">Bharat Pro Circuit League</p>
            </div>
            <span className="bpcl-player-card__tier-badge" aria-hidden="true">
              Basic
            </span>
            <div className="bpcl-player-card__name-plate">
              <ResponsiveCardName className="bpcl-player-card__name">{playerName}</ResponsiveCardName>
            </div>
            <dl className="bpcl-player-card__stats">
              {statRows.map((row) => (
                <div key={row.key} className="bpcl-player-card__stat">
                  <dt>{row.label}</dt>
                  <dd className={statValueSizeClass(row.key, row.value)}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div ref={shimmerRef} className="bpcl-player-card__shimmer" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
