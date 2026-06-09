import { useCallback, useEffect, useRef, useState } from "react";
import { BpcCoinIcon } from "./BpcCoin.jsx";

function clampCoins(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(0, Math.round(n)), Math.max(0, max));
}

export function BpcCoinSlider({
  value,
  onChange,
  onLiveChange,
  max = 0,
  balance = 0,
  disabled = false,
}) {
  const [local, setLocal] = useState(() => clampCoins(value, max));
  const [inputText, setInputText] = useState(() => String(clampCoins(value, max)));
  const dragging = useRef(false);
  const debounceRef = useRef(null);
  const maxRef = useRef(max);

  maxRef.current = max;

  const emitLive = useCallback(
    (n) => {
      onLiveChange?.(n);
    },
    [onLiveChange],
  );

  const commit = useCallback(
    (raw) => {
      const clamped = clampCoins(raw, maxRef.current);
      setLocal(clamped);
      setInputText(String(clamped));
      emitLive(clamped);
      clearTimeout(debounceRef.current);
      onChange(clamped);
    },
    [onChange, emitLive],
  );

  const setLocalSmooth = useCallback(
    (raw) => {
      const clamped = clampCoins(raw, maxRef.current);
      setLocal(clamped);
      setInputText(String(clamped));
      emitLive(clamped);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(clamped), 140);
    },
    [onChange, emitLive],
  );

  useEffect(() => {
    if (dragging.current) return;
    const clamped = clampCoins(value, max);
    setLocal(clamped);
    setInputText(String(clamped));
    emitLive(clamped);
  }, [value, max, emitLive]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function onManualInput(e) {
    const raw = e.target.value;
    setInputText(raw);
    if (raw === "") return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) setLocalSmooth(parsed);
  }

  function onManualCommit() {
    commit(inputText === "" ? 0 : Number(inputText));
  }

  const pct = max > 0 ? (local / max) * 100 : 0;
  const discount = Math.min(local, balance, max);

  return (
    <div className="player-reg__coin-slider">
      <div
        className="player-reg__coin-track-wrap"
        style={{ "--pct": `${pct}%` }}
      >
        <div className="player-reg__coin-track-bg" aria-hidden="true" />
        <div className="player-reg__coin-track-fill" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={local}
          disabled={disabled || max === 0}
          className="player-reg__coin-range"
          aria-label="BPC coins to apply"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={local}
          onPointerDown={() => {
            dragging.current = true;
          }}
          onPointerUp={() => {
            dragging.current = false;
            clearTimeout(debounceRef.current);
            onChange(clampCoins(local, max));
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onInput={(e) => setLocalSmooth(Number(e.target.value))}
        />
      </div>

      <div className="player-reg__coin-input-row">
        <label className="player-reg__coin-manual">
          <BpcCoinIcon size="xs" />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            step={1}
            value={inputText}
            disabled={disabled || max === 0}
            onChange={onManualInput}
            onBlur={onManualCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onManualCommit();
                e.currentTarget.blur();
              }
            }}
            className="player-reg__coin-number"
            aria-label="BPC coins to apply (manual entry)"
          />
          <span className="player-reg__coin-manual-suffix">coins</span>
        </label>
        <span className="player-reg__coin-discount">−₹{discount}</span>
      </div>
    </div>
  );
}
