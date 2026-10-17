import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const CASE_STUDY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public/case-study");

/** Gitignored static case study — must win over SPA fallback for /case-study and /case-study/ */
function caseStudyPublicPlugin() {
  const MIME = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain; charset=utf-8",
  };

  function serve(req, res, next) {
    if (!fs.existsSync(CASE_STUDY_ROOT)) return next();

    const pathname = (req.url || "").split("?")[0];
    if (!pathname.startsWith("/case-study")) return next();

    let rel = pathname.slice("/case-study".length) || "/";
    if (rel === "/" || rel.endsWith("/")) {
      rel = `${rel.replace(/\/$/, "")}/index.html`;
    }
    if (!rel.startsWith("/")) rel = `/${rel}`;

    const filePath = path.normalize(path.join(CASE_STUDY_ROOT, rel));
    if (!filePath.startsWith(CASE_STUDY_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return next();
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    if (MIME[ext]) res.setHeader("Content-Type", MIME[ext]);
    fs.createReadStream(filePath).pipe(res);
  }

  return {
    name: "case-study-public",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteOrigin = (env.VITE_SITE_URL || "").trim().replace(/\/$/, "");
  /** Crawlers fetch index.html without JS — OG/Twitter images must be absolute; use root-relative fallback if unset. */
  const ogImageAbs = siteOrigin ? `${siteOrigin}/bpcl.png` : "/bpcl.png";
  const ogUrlHome = siteOrigin ? `${siteOrigin}/` : "/";

  if (mode === "production" && !siteOrigin) {
    console.warn(
      "[vite] VITE_SITE_URL is unset — set it to your public origin (no trailing slash) so link previews embed the logo reliably.",
    );
  }

  const apiProxyTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || "http://localhost:3000";
  const apiProxy = {
    target: apiProxyTarget,
    changeOrigin: true,
  };

  /**
   * LightningCSS (Vite 8 default) drops unprefixed backdrop-filter when -webkit- is present.
   * Minified rules often omit the trailing semicolon before "}", so a naive replace misses them.
   */
  function fixBackdropFilterMinify() {
    return {
      name: "fix-backdrop-filter-minify",
      enforce: "post",
      generateBundle(_, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
          file.source = String(file.source).replace(/\{([^{}]*)\}/g, (rule, body) => {
            if (!body.includes("-webkit-backdrop-filter")) return `{${body}}`;
            if (/(?:^|[^-])backdrop-filter:/.test(body)) return `{${body}}`;
            const fixed = body.replace(
              /-webkit-backdrop-filter:([^;{}]+)/g,
              "-webkit-backdrop-filter:$1;backdrop-filter:$1",
            );
            return `{${fixed}}`;
          });
        }
      },
    };
  }

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("react-dom") || /[/\\]react[/\\]/.test(id)) return "vendor-react";
            if (id.includes("react-icons")) return "vendor-icons";
            if (id.includes("dompurify")) return "vendor-sanitize";
            return "vendor";
          },
        },
      },
    },
    plugins: [
      caseStudyPublicPlugin(),
      fixBackdropFilterMinify(),
      {
        name: "inject-sharing-meta",
        transformIndexHtml(html) {
          return html.replaceAll("__OG_IMAGE_ABS__", ogImageAbs).replaceAll("__OG_URL_HOME__", ogUrlHome);
        },
      },
      react(),
      tailwindcss(),
    ],
    server:
      mode === "development"
        ? {
            proxy: {
              "/api": apiProxy,
            },
          }
        : undefined,
    preview: {
      proxy: {
        "/api": apiProxy,
      },
    },
  };
});
