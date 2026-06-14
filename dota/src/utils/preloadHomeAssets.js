/** Critical static assets for the landing page — preloaded before first paint of "/". */

export const HOME_IMAGE_ASSETS = ["/bpcl.png", "/images/cards.jpg", "/images/overview.jpg"];
export const HOME_VIDEO_ASSET = "/herobg.mp4";

const HOME_PRELOAD_MAX_MS = 15_000;

/** @type {Promise<void> | null} */
let homeAssetsPromise = null;

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const finish = () => resolve();
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", finish, { once: true });
    img.src = src;
  });
}

function preloadVideo(src) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve();
    };

    video.addEventListener("canplaythrough", finish, { once: true });
    video.addEventListener("loadeddata", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    video.src = src;
    video.load();

    window.setTimeout(finish, HOME_PRELOAD_MAX_MS);
  });
}

export function preloadHomeAssets() {
  return Promise.all([preloadVideo(HOME_VIDEO_ASSET), ...HOME_IMAGE_ASSETS.map(preloadImage)]).then(() => {});
}

/** Start preloading as soon as the public shell mounts (parallel with tournament API). */
export function startHomeAssetsPreload() {
  if (typeof window === "undefined") return null;
  if (!homeAssetsPromise) {
    homeAssetsPromise = preloadHomeAssets();
  }
  return homeAssetsPromise;
}

/** Await landing asset preload; safe to call multiple times. */
export function waitForHomeAssetsPreload() {
  return startHomeAssetsPreload() ?? Promise.resolve();
}
