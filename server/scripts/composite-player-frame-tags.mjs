import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = path.join(root, "card generator/player-frame-tags.html");
const out = path.join(root, "dota/public/cards/player/frame.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 600 } });
  await page.goto(`file:///${html.replace(/\\/g, "/")}`);
  await page.waitForTimeout(400);
  const buf = await page.locator("#stage").screenshot({ type: "png" });
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
