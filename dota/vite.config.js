import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
