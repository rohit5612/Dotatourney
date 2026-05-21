import { useEffect, useState } from "react";

const FALLBACK = { r: 233, g: 168, b: 74 };

/** @type {Map<string, { r: number; g: number; b: number }>} */
const accentCache = new Map();

/** @type {Map<string, Promise<{ r: number; g: number; b: number }>>} */
const accentPending = new Map();

function sampleLogoAccent(logoUrl) {
  const cached = accentCache.get(logoUrl);
  if (cached) return Promise.resolve(cached);

  const pending = accentPending.get(logoUrl);
  if (pending) return pending;

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      let color = FALLBACK;
      try {
        const canvas = document.createElement("canvas");
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;

          for (let i = 0; i < data.length; i += 16) {
            const pr = data[i];
            const pg = data[i + 1];
            const pb = data[i + 2];
            const pa = data[i + 3];
            if (pa < 100) continue;
            if (pr > 235 && pg > 235 && pb > 235) continue;
            if (pr > 210 && pg > 210 && pb > 210 && Math.abs(pr - pg) < 18 && Math.abs(pg - pb) < 18) continue;
            r += pr;
            g += pg;
            b += pb;
            count += 1;
          }

          if (count) {
            color = {
              r: Math.round(r / count),
              g: Math.round(g / count),
              b: Math.round(b / count),
            };
          }
        }
      } catch {
        color = FALLBACK;
      }
      accentCache.set(logoUrl, color);
      accentPending.delete(logoUrl);
      resolve(color);
    };
    img.onerror = () => {
      accentCache.set(logoUrl, FALLBACK);
      accentPending.delete(logoUrl);
      resolve(FALLBACK);
    };
    img.src = logoUrl;
  });

  accentPending.set(logoUrl, promise);
  return promise;
}

function scheduleAccentWork(run) {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(run, { timeout: 1200 });
  }
  return window.setTimeout(run, 48);
}

function cancelAccentWork(id) {
  if (typeof cancelIdleCallback === "function") {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Samples dominant non-white color from a logo for subtle card ambient tinting.
 * Results are cached per URL; sampling runs only when `enabled` is true.
 */
export function useLogoAccent(logoUrl, { enabled = true } = {}) {
  const [accent, setAccent] = useState(() => (logoUrl && enabled ? accentCache.get(logoUrl) ?? null : null));

  useEffect(() => {
    if (!logoUrl || !enabled) {
      return undefined;
    }

    const cached = accentCache.get(logoUrl);
    if (cached) {
      setAccent(cached);
      return undefined;
    }

    let cancelled = false;
    const idleId = scheduleAccentWork(() => {
      sampleLogoAccent(logoUrl).then((color) => {
        if (!cancelled) setAccent(color);
      });
    });

    return () => {
      cancelled = true;
      cancelAccentWork(idleId);
    };
  }, [logoUrl, enabled]);

  return accent;
}

export function accentCssVars(accent) {
  if (!accent) return undefined;
  return {
    "--team-accent": `${accent.r} ${accent.g} ${accent.b}`,
  };
}

/** Parses #rgb / #rrggbb into an "r g b" CSS triplet. */
export function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== "string") return null;
  let normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function teamAccentStyle(team, sampledAccent) {
  const hex = team?.accentColor || team?.accent_color;
  const fromHex = hexToRgbTriplet(hex);
  if (fromHex) return { "--team-accent": fromHex };
  return accentCssVars(sampledAccent);
}
