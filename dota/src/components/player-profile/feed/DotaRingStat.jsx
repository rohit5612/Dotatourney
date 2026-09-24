const SIZES = {
  default: { ring: 92, stroke: 9 },
  compact: { ring: 58, stroke: 6 },
};

function ringGeometry(sizeKey = "default") {
  const { ring: RING_SIZE, stroke: STROKE } = SIZES[sizeKey] || SIZES.default;
  const r = (RING_SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  return { r, c, center: RING_SIZE / 2, RING_SIZE, STROKE };
}

function ringClass(size) {
  return `dota-ring-stat${size === "compact" ? " dota-ring-stat--compact" : ""}`;
}

/** Win / loss donut (reference: green wins, red losses). */
export function DotaRecordRing({ wins = 0, losses = 0, size = "default" }) {
  const total = wins + losses;
  if (!total) return null;
  const { r, c, center, RING_SIZE, STROKE } = ringGeometry(size);
  const winShare = wins / total;
  const winLen = c * winShare;
  const lossLen = c - winLen;

  return (
    <div className={ringClass(size)} title={`${wins} wins, ${losses} losses`}>
      <svg
        className="dota-ring-stat__svg"
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        role="img"
        aria-label={`${wins} wins, ${losses} losses`}
      >
        <circle className="dota-ring-stat__track" cx={center} cy={center} r={r} fill="none" strokeWidth={STROKE} />
        <circle
          className="dota-ring-stat__arc dota-ring-stat__arc--win"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${winLen} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        <circle
          className="dota-ring-stat__arc dota-ring-stat__arc--loss"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${lossLen} ${c}`}
          strokeDashoffset={-winLen}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="dota-ring-stat__label">
        <span className="dota-ring-stat__metric">
          <strong>{wins}</strong>
          <em>W</em>
        </span>
        <span className="dota-ring-stat__metric">
          <strong>{losses}</strong>
          <em>L</em>
        </span>
      </div>
    </div>
  );
}

export function DotaWinRateRing({ winRate, size = "default" }) {
  if (winRate == null) return null;
  const { r, c, center, RING_SIZE, STROKE } = ringGeometry(size);
  const pct = Math.min(100, Math.max(0, Number(winRate))) / 100;
  const arcLen = c * pct;

  return (
    <div className={ringClass(size)} title={`${winRate}% win rate`}>
      <svg
        className="dota-ring-stat__svg"
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        role="img"
        aria-label={`${winRate}% win rate`}
      >
        <circle className="dota-ring-stat__track" cx={center} cy={center} r={r} fill="none" strokeWidth={STROKE} />
        <circle
          className="dota-ring-stat__arc dota-ring-stat__arc--wr"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${arcLen} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="dota-ring-stat__label dota-ring-stat__label--single">
        <span className="dota-ring-stat__metric dota-ring-stat__metric--wr">
          <strong>{winRate}</strong>
          <em>%</em>
        </span>
        <span className="dota-ring-stat__caption">WR</span>
      </div>
    </div>
  );
}

export function DotaKdaRing({ avgKda, size = "default" }) {
  if (!avgKda) return null;
  const ratio = (() => {
    const d = Math.max(Number(avgKda.deaths) || 0, 1);
    return Math.round(((Number(avgKda.kills) + Number(avgKda.assists)) / d) * 10) / 10;
  })();
  const { r, c, center, RING_SIZE, STROKE } = ringGeometry(size);
  const fill = Math.min(1, ratio / 6);
  const arcLen = c * fill;

  return (
    <div className={ringClass(size)} title={`${avgKda.kills} / ${avgKda.deaths} / ${avgKda.assists} avg KDA`}>
      <svg
        className="dota-ring-stat__svg"
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        role="img"
        aria-label={`${ratio} KDA ratio`}
      >
        <circle className="dota-ring-stat__track" cx={center} cy={center} r={r} fill="none" strokeWidth={STROKE} />
        <circle
          className="dota-ring-stat__arc dota-ring-stat__arc--kda"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${arcLen} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="dota-ring-stat__label dota-ring-stat__label--single">
        <span className="dota-ring-stat__metric dota-ring-stat__metric--kda">
          <strong>{ratio}</strong>
        </span>
        <span className="dota-ring-stat__caption">KDA</span>
      </div>
    </div>
  );
}

const MINI_RING = 52;
const MINI_STROKE = 5;

/** Compact performance gauge with Dota-flavored icon (GPM, damage, etc.). */
export function DotaMiniMetricRing({ value, max, label, icon, displayValue, tone = "neutral" }) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return null;
  const cap = Math.max(Number(max) || 1, 1);
  const r = (MINI_RING - MINI_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const center = MINI_RING / 2;
  const fill = Math.min(1, Math.max(0, n / cap));
  const arcLen = c * fill;

  return (
    <div className={`dota-mini-metric dota-mini-metric--${tone}`} title={`${label}: ${displayValue ?? n}`}>
      <div className="dota-mini-metric__ring-wrap">
        <svg
          className="dota-mini-metric__svg"
          width={MINI_RING}
          height={MINI_RING}
          viewBox={`0 0 ${MINI_RING} ${MINI_RING}`}
          role="img"
          aria-label={`${label} ${displayValue ?? n}`}
        >
          <circle
            className="dota-mini-metric__track"
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={MINI_STROKE}
          />
          <circle
            className="dota-mini-metric__arc"
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={MINI_STROKE}
            strokeDasharray={`${arcLen} ${c}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <span className="dota-mini-metric__icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <span className="dota-mini-metric__value">{displayValue ?? n}</span>
      <span className="dota-mini-metric__label">{label}</span>
    </div>
  );
}
