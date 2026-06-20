import { useCallback, useEffect, useRef } from "react";
import { resolveCardPortraitUrl } from "../../utils/resolvePlayerAvatar.js";
import "./GoldCardStyles.css";

function statValue(stats, key) {
  if (!stats) return "--";
  const value = stats[key];
  return value == null || value === "" ? "--" : String(value);
}

export function BpclGoldCard({ manifest, size = "md", className = "", interactive = true }) {
  const cardRef = useRef(null);
  const shimmerRef = useRef(null);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const payload = manifest?.cardPayload || {};
  const stats = payload.stats || manifest?.stats || {};
  const playerName = payload.playerName || manifest?.displayName || "Player";
  const avatarUrl = resolveCardPortraitUrl(manifest);
  const statRows = [
    { label: "KDA", value: statValue(stats, "kda") },
    { label: "AVG GPM", value: statValue(stats, "gpm") },
    { label: "AVG XPM", value: statValue(stats, "xpm") },
    { label: "WINRATE", value: statValue(stats, "winrate") },
  ];

  function statValueSizeClass(label, value) {
    const text = String(value ?? "--");
    if (label !== "KDA") {
      if (text.length > 4) return "bpcl-gold-card__stat-value--compact";
      return "";
    }
    if (text.includes("/")) {
      if (text.length >= 9) return "bpcl-gold-card__stat-value--kda-ratio-xs";
      if (text.length >= 7) return "bpcl-gold-card__stat-value--kda-ratio-sm";
      return "bpcl-gold-card__stat-value--kda-ratio";
    }
    if (text.length > 5) return "bpcl-gold-card__stat-value--kda-decimal-sm";
    return "bpcl-gold-card__stat-value--kda-decimal";
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
      tilt.current.tx = (my - 0.5) * 14;
      tilt.current.ty = (0.5 - mx) * 14;
      if (shimmerRef.current) {
        shimmerRef.current.style.background = `radial-gradient(ellipse 70% 70% at ${mx * 100}% ${my * 100}%, rgba(255,255,220,.16) 0%, transparent 58%)`;
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
      className={`bpcl-gold-card bpcl-gold-card--${size} ${className}`.trim()}
      aria-label={`${playerName} Gold card`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div ref={cardRef} className="bpcl-gold-card__tilt">
        <div className="bpcl-gold-card__glow" aria-hidden="true" />
        <div className="bpcl-gold-card__frame-wrap">
          <img src="/cards/gold/frame.png" alt="" className="bpcl-gold-card__frame" decoding="async" />
          <div className="bpcl-gold-card__portrait-slot">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="bpcl-gold-card__portrait" decoding="async" />
            ) : (
              <div className="bpcl-gold-card__portrait bpcl-gold-card__portrait--empty" aria-hidden="true" />
            )}
            <div className="bpcl-gold-card__portrait-shine" aria-hidden="true" />
          </div>
          <div ref={shimmerRef} className="bpcl-gold-card__shimmer" aria-hidden="true" />
          <div className="bpcl-gold-card__name-plate">
            <p className="bpcl-gold-card__name">{playerName}</p>
          </div>
          <dl className="bpcl-gold-card__stats">
            {statRows.map((row) => (
              <div key={row.label} className="bpcl-gold-card__stat">
                <dt>{row.label}</dt>
                <dd className={statValueSizeClass(row.label, row.value)}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </article>
  );
}
