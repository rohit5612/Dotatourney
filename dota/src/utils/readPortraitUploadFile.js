import { compressCoverImage } from "./compressCoverImage.js";

const MAX_GIF_BYTES = 8 * 1024 * 1024;
/** Keep under server avatarUrl limit (see admin playerAccounts patch route). */
const MAX_INLINE_DATA_URL_LENGTH = 3_900_000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

/** Portrait upload for CRM / cards — preserves animated GIF; other images are compressed to JPEG. */
export async function readPortraitUploadFile(file, { maxEdge = 512, quality = 0.88 } = {}) {
  if (!file) throw new Error("No file selected.");

  if (file.type === "image/gif") {
    if (file.size > MAX_GIF_BYTES) {
      throw new Error("GIF must be 8 MB or smaller. Host a larger file and paste the URL instead.");
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > MAX_INLINE_DATA_URL_LENGTH) {
      throw new Error("GIF is too large to store inline. Host it and paste the GIF URL instead.");
    }
    return dataUrl;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Upload an image or GIF file.");
  }

  return compressCoverImage(file, { maxEdge, quality });
}

/** GIF-only upload for hosted public folder (no inline base64 in DB). */
export async function readGifFileAsDataUrl(file) {
  if (!file) throw new Error("No file selected.");
  if (file.type !== "image/gif") {
    throw new Error("Hosted GIF upload accepts .gif files only.");
  }
  if (file.size > MAX_GIF_BYTES) {
    throw new Error("GIF must be 8 MB or smaller.");
  }
  return readFileAsDataUrl(file);
}

export function isAnimatedGifUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (/^data:image\/gif/i.test(value)) return true;
  try {
    const { pathname } = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://local");
    return /\.gif$/i.test(pathname);
  } catch {
    return /\.gif(\?|#|$)/i.test(value);
  }
}

export function isHostedPortraitGifUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const { pathname } = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://local");
    return /\/cards\/gifs\/[^/?#]+\.gif$/i.test(pathname);
  } catch {
    return /\/cards\/gifs\/[^/?#]+\.gif/i.test(value);
  }
}

/** Load raw GIF bytes from a data URL or remote .gif URL (for holo canvas animation). */
export async function loadGifBytesFromUrl(url) {
  const value = String(url || "").trim();
  if (!value) throw new Error("Missing GIF URL");

  const dataMatch = value.match(/^data:image\/gif(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (dataMatch) {
    const binary = atob(dataMatch[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  const response = await fetch(value);
  if (!response.ok) throw new Error(`GIF fetch failed (${response.status})`);
  return response.arrayBuffer();
}
