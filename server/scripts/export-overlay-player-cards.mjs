/**
 * Export community player cards as static overlay assets (PNG or WEBM) keyed by Steam32 ID.
 *
 * Usage (from server/):
 *   npm run export-overlay-cards
 *   npm run export-overlay-cards -- --base-url http://localhost:5173 --limit 5
 *   npm run export-overlay-cards -- --steam32 125144237 --only-missing
 *
 * Requires: npx playwright install chromium
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { pool } from "../src/db/pool.js";
import { listCommunityPlayersForExport } from "../src/services/playerProfileService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT_DIR = path.resolve(__dirname, "../../dota/public/cards/overlay");
const DEFAULT_BASE_URL = "https://bpcleague.in";
const CARD_SELECTORS = ".bpcl-default-card, .bpcl-player-card, .bpcl-gold-card, .bpcl-holo-card";
const HOLO_VIEWPORT = { width: 420, height: 640 };
const HOLO_RECORD_MS = 4000;

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    outDir: DEFAULT_OUT_DIR,
    onlyMissing: false,
    limit: null,
    steam32: null,
    delayMs: 1500,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      options.baseUrl = String(argv[++i] || "").replace(/\/$/, "");
    } else if (arg === "--out-dir") {
      options.outDir = path.resolve(argv[++i] || "");
    } else if (arg === "--only-missing") {
      options.onlyMissing = true;
    } else if (arg === "--limit") {
      options.limit = Math.max(1, Number(argv[++i]) || 0);
    } else if (arg === "--steam32") {
      options.steam32 = Number(argv[++i]);
    } else if (arg === "--delay-ms") {
      options.delayMs = Math.max(0, Number(argv[++i]) || 0);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHoloTier(tier) {
  return String(tier || "").trim().toLowerCase() === "holo";
}

function assetFileName(steam32Id, tier) {
  const ext = isHoloTier(tier) ? "webm" : "png";
  return `${steam32Id}.${ext}`;
}

function overlayUrl(baseUrl, bpcId) {
  const encoded = encodeURIComponent(String(bpcId || "").trim());
  return `${baseUrl}/overlay/card/${encoded}?size=lg`;
}

function loadExistingIndex(outDir) {
  const indexPath = path.join(outDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    return { generatedAt: null, baseUrl: "/cards/overlay/", players: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return {
      generatedAt: parsed.generatedAt || null,
      baseUrl: parsed.baseUrl || "/cards/overlay/",
      players: parsed.players && typeof parsed.players === "object" ? parsed.players : {},
    };
  } catch {
    return { generatedAt: null, baseUrl: "/cards/overlay/", players: {} };
  }
}

async function waitForCardReady(page) {
  const errorLocator = page.locator(".overlay-card-page__state");
  const cardLocator = page.locator(CARD_SELECTORS).first();

  await Promise.race([
    cardLocator.waitFor({ state: "visible", timeout: 45000 }),
    errorLocator.waitFor({ state: "visible", timeout: 45000 }).then(async () => {
      const message = (await errorLocator.textContent())?.trim() || "Unknown BPC ID";
      throw new Error(message);
    }),
  ]);

  await page.locator(".card-renderer-skeleton").first().waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(800);
}

async function startPortraitVideos(page) {
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((video) => {
      video.muted = true;
      video.loop = true;
      video.play().catch(() => {});
    });
  });
}

async function exportPngCard(page, outPath) {
  const card = page.locator(CARD_SELECTORS).first();
  await card.screenshot({ path: outPath, omitBackground: true });
}

async function exportHoloWebm(browser, url, outPath) {
  const tmpDir = fs.mkdtempSync(path.join(path.dirname(outPath), ".tmp-video-"));
  const context = await browser.newContext({
    viewport: HOLO_VIEWPORT,
    recordVideo: { dir: tmpDir, size: HOLO_VIEWPORT },
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForCardReady(page);
    await startPortraitVideos(page);
    await sleep(HOLO_RECORD_MS);
    const video = page.video();
    await page.close();
    await context.close();

    if (!video) {
      throw new Error("Playwright did not produce a video recording");
    }

    const recordedPath = await video.path();
    fs.copyFileSync(recordedPath, outPath);
    try {
      fs.unlinkSync(recordedPath);
    } catch {
      // ignore cleanup errors
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function exportPlayerCard(browser, player, options) {
  const fileName = assetFileName(player.steam32Id, player.tier);
  const outPath = path.join(options.outDir, fileName);
  const url = overlayUrl(options.baseUrl, player.bpcId);

  if (options.onlyMissing && fs.existsSync(outPath)) {
    return { skipped: true, fileName, outPath };
  }

  if (options.dryRun) {
    console.log(`[dry-run] ${player.bpcId} (${player.steam32Id}) ${player.tier} -> ${fileName}`);
    return { skipped: false, dryRun: true, fileName, outPath };
  }

  if (isHoloTier(player.tier)) {
    await exportHoloWebm(browser, url, outPath);
  } else {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForCardReady(page);
      await exportPngCard(page, outPath);
    } finally {
      await page.close();
    }
  }

  console.log(`Exported ${player.bpcId} (${player.steam32Id}) -> ${fileName}`);
  return { skipped: false, fileName, outPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outDir, { recursive: true });

  let players = await listCommunityPlayersForExport({
    steam32Id: options.steam32 ?? undefined,
  });

  if (options.steam32 != null && players.length === 0) {
    console.error(`No community player found for steam32 ${options.steam32}`);
    process.exitCode = 1;
    return;
  }

  if (options.limit != null) {
    players = players.slice(0, options.limit);
  }

  console.log(`Found ${players.length} community player(s) to export`);
  console.log(`Base URL: ${options.baseUrl}`);
  console.log(`Output: ${options.outDir}`);

  const index = loadExistingIndex(options.outDir);
  const browser = options.dryRun ? null : await chromium.launch();

  let exported = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const player of players) {
      try {
        const result = await exportPlayerCard(browser, player, options);
        if (result.skipped) {
          skipped += 1;
          console.log(`Skipped ${player.bpcId} (${player.steam32Id}) — ${result.fileName} exists`);
        } else if (!result.dryRun) {
          exported += 1;
          index.players[String(player.steam32Id)] = {
            bpcId: player.bpcId,
            tier: player.tier,
            file: result.fileName,
          };
        }

        if (options.delayMs > 0) {
          await sleep(options.delayMs);
        }
      } catch (error) {
        failed += 1;
        console.error(`Failed ${player.bpcId} (${player.steam32Id}): ${error.message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    await pool.end().catch(() => {});
  }

  if (!options.dryRun) {
    index.generatedAt = new Date().toISOString();
    index.baseUrl = "/cards/overlay/";
    const indexPath = path.join(options.outDir, "index.json");
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    console.log(`Wrote ${indexPath}`);
  }

  console.log(`Done. exported=${exported} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
