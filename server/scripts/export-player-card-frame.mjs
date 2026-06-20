/**
 * Export basic/player card frame PNG from the offline engine into dota/public.
 *
 * Usage (from server/):
 *   node scripts/export-player-card-frame.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../../card generator/Basic player card engine.html");
const outDir = path.resolve(__dirname, "../../dota/public/cards/player");
const outFile = path.join(outDir, "frame.png");

async function main() {
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Engine HTML not found: ${htmlPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.waitForFunction(() => typeof window.exportFramePngDataUrl === "function");
    const dataUrl = await page.evaluate(() => window.exportFramePngDataUrl());
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(outFile, Buffer.from(base64, "base64"));
    console.log(`Wrote ${outFile}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
