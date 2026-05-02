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

  return {
    plugins: [
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
              "/api": process.env.VITE_API_PROXY_TARGET || "http://localhost:3000",
            },
          }
        : undefined,
  };
});
