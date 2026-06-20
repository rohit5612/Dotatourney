import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = path.join(root, "card generator/Basic player card engine.html");
const out = path.join(root, "card generator/_engine-preview.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`file:///${html.replace(/\\/g, "/")}`);
  await page.waitForTimeout(600);
  const card = page.locator("#captureTarget");
  await card.screenshot({ path: out });
  console.log("Wrote", out);
} finally {
  await browser.close();
}
