import fs from "fs";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const buf = fs.readFileSync(path.join(root, "dota/public/cards/player/frame-base.png"));

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPngRgba(buffer) {
  const w = buffer.readUInt32BE(16);
  const h = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  let palette = null;
  let offset = 8;
  const idat = [];
  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + len);
    if (type === "PLTE") palette = data;
    if (type === "IDAT") idat.push(data);
    offset += 12 + len;
  }
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * w * 4);
  const rows = [];
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const row = Buffer.alloc(w * bytesPerPixel);
    for (let x = 0; x < w * bytesPerPixel; x++) {
      let v = raw[pos++];
      const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const b = y > 0 ? rows[y - 1][x] : 0;
      const c = y > 0 && x >= bytesPerPixel ? rows[y - 1][x - bytesPerPixel] : 0;
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 0xff;
      row[x] = v;
    }
    rows.push(row);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (colorType === 6) {
        const j = x * 4;
        out[i] = row[j];
        out[i + 1] = row[j + 1];
        out[i + 2] = row[j + 2];
      } else if (colorType === 2) {
        const j = x * 3;
        out[i] = row[j];
        out[i + 1] = row[j + 1];
        out[i + 2] = row[j + 2];
      } else {
        const idx = row[x] * 3;
        out[i] = palette[idx];
        out[i + 1] = palette[idx + 1];
        out[i + 2] = palette[idx + 2];
      }
      out[i + 3] = 255;
    }
  }
  return { w, h, data: out };
}

const { w, h, data } = readPngRgba(buf);
const sx = 400 / w;
const sy = 600 / h;

function lum(x, y) {
  const i = (y * w + x) * 4;
  return (data[i] + data[i + 1] + data[i + 2]) / 3;
}

function centroid(threshold, y0, y1, x0, x1) {
  let sumX = 0,
    sumY = 0,
    n = 0,
    minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (lum(x, y) < threshold) {
        sumX += x;
        sumY += y;
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!n) return null;
  return {
    cx: sumX / n,
    cy: sumY / n,
    minX,
    maxX,
    minY,
    maxY,
    n,
  };
}

function pct(c) {
  return {
    cxPct: +((c.cx / w) * 100).toFixed(2),
    cyPct: +((c.cy / h) * 100).toFixed(2),
    wPct: +(((c.maxX - c.minX) / w) * 100).toFixed(2),
    hPct: +(((c.maxY - c.minY) / h) * 100).toFixed(2),
  };
}

const slots = {
  topPlaque: centroid(18, 80, 240, 150, 1050),
  basicBadge: centroid(18, 250, 400, 400, 800),
  circleHole: centroid(8, 420, 900, 320, 880),
  nameBand: centroid(35, 1000, 1180, 200, 1000),
  statsInner: centroid(18, 1320, 1680, 120, 1080),
};

console.log(JSON.stringify(slots, null, 2));
for (const [k, c] of Object.entries(slots)) {
  if (!c) continue;
  const p = pct(c);
  console.log(k, p, "display cy", +(c.cy * sy).toFixed(1), "diam", +((c.maxX - c.minX) * sx).toFixed(1));
}

// circle: use min of width/height for square portrait
if (slots.circleHole) {
  const c = slots.circleHole;
  const diam = Math.min(c.maxX - c.minX, c.maxY - c.minY);
  console.log("circleDiameterPct", +((diam / w) * 100).toFixed(2));
}
