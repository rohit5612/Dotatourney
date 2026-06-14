/** Public logo path served from site root (`public/bpcl.png` in repo). Crawlers read absolute URL from built `index.html` when `VITE_SITE_URL` is set at build time. */
export const SITE_SHARING_IMAGE_PATH = "/bpcl.png";

/** Full rulebook PDF (`public/bpcl rules.pdf`). */
export const RULEBOOK_PDF_PATH = "/bpcl%20rules.pdf";

export const SITE_BRAND_SHORT = "BPC League";
export const SITE_BRAND_FULL = "Bharat Pro Circuit League";
export const SITE_BRAND_LINE = `${SITE_BRAND_SHORT} — ${SITE_BRAND_FULL}`;
export const SITE_ORIGIN = "https://bpcleague.in";

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

const TITLE_SUFFIX = " | BPC League";

const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/dashboard",
  "/login",
  "/signup",
  "/auth",
  "/verify-email",
  "/claim-account",
  "/forgot-password",
  "/reset-password",
];

/** Static public route titles and descriptions. */
const ROUTE_META = {
  "/": {
    title: SITE_META.title,
    description: SITE_META.description,
  },
  "/tournament": {
    title: `Tournament${TITLE_SUFFIX}`,
    description: "Live tournament hub — standings, bracket, and schedule for the current BPC League season.",
  },
  "/schedule": {
    title: `Bracket & Schedule${TITLE_SUFFIX}`,
    description: "Match schedule and bracket for the Bharat Pro Circuit League Dota 2 tournament.",
  },
  "/teams": {
    title: `Teams${TITLE_SUFFIX}`,
    description: "Competing teams in the current BPC League Dota 2 tournament.",
  },
  "/seasons": {
    title: `Seasons${TITLE_SUFFIX}`,
    description: "Past and present BPC League seasons — champions, archives, and tournament history.",
  },
  "/announcements": {
    title: `News & Announcements${TITLE_SUFFIX}`,
    description: "Latest news and announcements from BPC League.",
  },
  "/community": {
    title: `Community${TITLE_SUFFIX}`,
    description: "Join the BPC League community — Discord, socials, and circuit updates.",
  },
  "/rules": {
    title: `Rules & Conduct${TITLE_SUFFIX}`,
    description: "General rules and player conduct for BPC League tournaments.",
  },
  "/privacy": {
    title: `Privacy Policy${TITLE_SUFFIX}`,
    description: "How BPC League collects, uses, and protects your personal data.",
  },
  "/cookies": {
    title: `Cookie Policy${TITLE_SUFFIX}`,
    description: "How BPC League uses cookies and similar technologies.",
  },
  "/register": {
    title: `Register${TITLE_SUFFIX}`,
    description: "Register for the current BPC League Dota 2 tournament.",
  },
  "/register-legacy": {
    title: `Register${TITLE_SUFFIX}`,
    description: "Register for the current BPC League Dota 2 tournament.",
  },
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

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function matchRouteMeta(pathname) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  if (pathname.startsWith("/seasons/")) {
    return {
      title: `Season${TITLE_SUFFIX}`,
      description: "Season details, champions, and archives from BPC League.",
    };
  }
  if (pathname.startsWith("/player/")) {
    return {
      title: `Player Profile${TITLE_SUFFIX}`,
      description: "Public player profile on BPC League.",
    };
  }
  if (pathname.startsWith("/match/")) {
    return {
      title: `Match${TITLE_SUFFIX}`,
      description: "Match details and roster for a BPC League fixture.",
    };
  }
  return ROUTE_META["/"];
}

/**
 * Update document title, description, robots, and OG/Twitter tags for the current route.
 */
export function applyRouteMeta(pathname, overrides = {}) {
  if (typeof document === "undefined") return;

  const privateRoute = isPrivatePath(pathname);
  const base = privateRoute
    ? {
        title: privateRoute ? `Account${TITLE_SUFFIX}` : SITE_META.title,
        description: SITE_META.description,
        robots: "noindex, nofollow",
      }
    : matchRouteMeta(pathname);

  const title = overrides.title || base.title;
  const description = overrides.description || base.description;
  const robots = overrides.robots || base.robots || "index, follow";

  document.title = title;
  setMetaByName("description", description);
  setMetaByName("robots", robots);
  setMetaByProperty("og:title", title);
  setMetaByProperty("og:description", description);
  setMetaByName("twitter:title", title);
  setMetaByName("twitter:description", description);

  const origin = window.location.origin;
  const url = window.location.href.split("#")[0];
  const imageUrl = `${origin}${SITE_SHARING_IMAGE_PATH}`;

  setMetaByProperty("og:url", url);
  setMetaByProperty("og:image", imageUrl);
  setMetaByName("twitter:image", imageUrl);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = privateRoute ? `${origin}/` : url;
}

/**
 * Absolute Open Graph / Twitter URLs and canonical after load (helps link previews).
 * Call once from main.jsx (client only).
 */
export function applyClientMetaTags() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  applyRouteMeta(window.location.pathname);
}
