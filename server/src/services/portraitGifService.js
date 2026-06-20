import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { slugifyPlayer } from "../utils/playerSlug.js";

const MAX_GIF_BYTES = 8 * 1024 * 1024;
const PUBLIC_PATH_PREFIX = "/cards/gifs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_GIF_DIR = path.join(REPO_ROOT, "dota", "public", "cards", "gifs");

function portraitGifDir() {
  const configured = env.portraitGifDir?.trim();
  return configured ? path.resolve(configured) : DEFAULT_GIF_DIR;
}

function portraitGifUrlBase() {
  const configured = env.portraitGifUrlBase?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (env.nodeEnv === "production") {
    return `${env.apiPublicUrl}${PUBLIC_PATH_PREFIX}`;
  }
  return "";
}

export function getPortraitGifStaticDir() {
  return portraitGifDir();
}

export function buildPortraitGifPublicPath(filename) {
  return `${PUBLIC_PATH_PREFIX}/${filename}`;
}

export function buildPortraitGifPublicUrl(filename) {
  const base = portraitGifUrlBase();
  const relative = buildPortraitGifPublicPath(filename);
  return base ? `${base}/${filename}` : relative;
}

function parseGifDataUrl(dataUrl) {
  const value = String(dataUrl || "").trim();
  const match = value.match(/^data:image\/gif(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) {
    const error = new Error("Expected a GIF data URL (image/gif).");
    error.status = 400;
    throw error;
  }

  let buffer;
  try {
    buffer = Buffer.from(match[1], "base64");
  } catch {
    const error = new Error("Could not decode GIF data.");
    error.status = 400;
    throw error;
  }

  if (buffer.length < 6) {
    const error = new Error("Invalid GIF file.");
    error.status = 400;
    throw error;
  }

  const signature = buffer.subarray(0, 6).toString("ascii");
  if (signature !== "GIF87a" && signature !== "GIF89a") {
    const error = new Error("File is not a valid GIF.");
    error.status = 400;
    throw error;
  }

  if (buffer.length > MAX_GIF_BYTES) {
    const error = new Error("GIF must be 8 MB or smaller.");
    error.status = 400;
    throw error;
  }

  return buffer;
}

function portraitGifFilename(account) {
  const slug = slugifyPlayer(account?.slug || account?.displayName || account?.bpcId || "player");
  const suffix = String(account?.id || "")
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 8);
  return suffix ? `${slug}-${suffix}.gif` : `${slug}.gif`;
}

function sanitizeCatalogGifFilename(name) {
  const base = path.basename(String(name || "").trim()).replace(/\.gif$/i, "");
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return safe ? `${safe}.gif` : `portrait-${Date.now()}.gif`;
}

function portraitGifLabel(filename) {
  return filename.replace(/\.gif$/i, "").replace(/-/g, " ");
}

export async function listHostedPortraitGifs() {
  const dir = portraitGifDir();
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const gifs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.gif$/i.test(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const stat = await fs.stat(filePath);
    gifs.push({
      filename: entry.name,
      label: portraitGifLabel(entry.name),
      url: buildPortraitGifPublicUrl(entry.name),
      path: buildPortraitGifPublicPath(entry.name),
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  gifs.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return gifs;
}

export async function saveCatalogPortraitGif(dataUrl, preferredFilename) {
  const buffer = parseGifDataUrl(dataUrl);
  const filename = sanitizeCatalogGifFilename(preferredFilename);
  const dir = portraitGifDir();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);

  return {
    filename,
    path: buildPortraitGifPublicPath(filename),
    url: buildPortraitGifPublicUrl(filename),
    bytes: buffer.length,
  };
}

export async function savePlayerPortraitGif(account, dataUrl) {
  if (!account?.id) {
    const error = new Error("Player account not found.");
    error.status = 404;
    throw error;
  }

  const buffer = parseGifDataUrl(dataUrl);
  const filename = portraitGifFilename(account);
  const dir = portraitGifDir();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);

  const url = buildPortraitGifPublicUrl(filename);
  const pathOnly = buildPortraitGifPublicPath(filename);

  return {
    filename,
    path: pathOnly,
    url,
    bytes: buffer.length,
  };
}
