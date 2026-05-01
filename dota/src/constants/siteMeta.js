/** Default document meta (also mirrored in index.html for no-JS crawlers). */
export const SITE_META = {
  title: "BPC League | Bharat Pro Circuit League — Dota 2",
  description:
    "Bharat Pro Circuit League (BPC League) — Dota 2 tournaments, registrations, brackets, and schedules for the Indian circuit.",
  keywords: "BPC League, Bharat Pro Circuit, Dota 2, esports, tournament, India, bracket, registration",
  author: "BPC League",
  siteName: "BPC League",
  locale: "en_IN",
  twitterCard: "summary_large_image",
};

function setMetaByProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Absolute Open Graph / Twitter URLs and canonical after load (helps link previews).
 * Call once from main.jsx (client only).
 */
export function applyClientMetaTags() {
  if (typeof document === "undefined") return;
  const origin = window.location.origin;
  const url = window.location.href.split("#")[0];
  const imageUrl = `${origin}/bpcl.png`;

  setMetaByProperty("og:url", url);
  setMetaByProperty("og:image", imageUrl);
  setMetaByName("twitter:image", imageUrl);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}
