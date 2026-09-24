/**
 * Download Dota 2 hero portraits + minimap icons into dota/public/dota-heroes/
 * for same-origin CDN serving. Re-run when Valve adds heroes.
 *
 * Usage: node scripts/download-dota-hero-portraits.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dota", "public", "dota-heroes");
const CATALOG_PATH = path.join(ROOT, "dota", "src", "constants", "dotaHeroCatalog.json");
const PORTRAITS_DIR = path.join(OUT_DIR, "portraits");
const ICONS_DIR = path.join(OUT_DIR, "icons");

const STEAM_HERO_BASE =
  "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes";

function heroSlugFromNpcName(npcName) {
  if (!npcName || typeof npcName !== "string") return "";
  return npcName.replace(/^npc_dota_hero_/, "");
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, { headers: { Accept: "image/*" } });
  if (!res.ok) return { ok: false, status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 64) return { ok: false, status: "empty" };
  await fs.writeFile(destPath, buf);
  return { ok: true, bytes: buf.length };
}

async function main() {
  await fs.mkdir(PORTRAITS_DIR, { recursive: true });
  await fs.mkdir(ICONS_DIR, { recursive: true });

  const heroesRes = await fetch(
    "https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json",
  );
  if (!heroesRes.ok) {
    console.error("Failed to fetch hero list:", heroesRes.status);
    process.exit(1);
  }
  const heroesRaw = await heroesRes.json();
  const heroes = Object.values(heroesRaw || {});

  const index = [];
  let portraitOk = 0;
  let iconOk = 0;
  let portraitMiss = 0;
  let iconMiss = 0;

  for (const hero of heroes || []) {
    const slug = heroSlugFromNpcName(hero.name);
    if (!slug) continue;

    const portraitUrl = `${STEAM_HERO_BASE}/${slug}.png`;
    const iconUrl = `${STEAM_HERO_BASE}/icons/${slug}.png`;
    const portraitPath = path.join(PORTRAITS_DIR, `${slug}.png`);
    const iconPath = path.join(ICONS_DIR, `${slug}.png`);

    const [portrait, icon] = await Promise.all([
      downloadFile(portraitUrl, portraitPath),
      downloadFile(iconUrl, iconPath),
    ]);

    if (portrait.ok) portraitOk += 1;
    else {
      portraitMiss += 1;
      await fs.rm(portraitPath, { force: true }).catch(() => {});
    }
    if (icon.ok) iconOk += 1;
    else {
      iconMiss += 1;
      await fs.rm(iconPath, { force: true }).catch(() => {});
    }

    index.push({
      id: hero.id,
      slug,
      localized_name: hero.localized_name,
      portrait: portrait.ok ? `/dota-heroes/portraits/${slug}.png` : null,
      icon: icon.ok ? `/dota-heroes/icons/${slug}.png` : null,
    });

    await new Promise((r) => setTimeout(r, 35));
    process.stdout.write(`\r${slug.padEnd(24)} portrait=${portrait.ok ? "ok" : "—"} icon=${icon.ok ? "ok" : "—"}`);
  }

  index.sort((a, b) => a.id - b.id);
  const catalogJson = `${JSON.stringify(index, null, 2)}\n`;
  await fs.writeFile(CATALOG_PATH, catalogJson, "utf8");

  console.log(
    `\nDone. portraits ${portraitOk}/${index.length}, icons ${iconOk}/${index.length}` +
      (portraitMiss || iconMiss ? ` (missing portrait ${portraitMiss}, icon ${iconMiss})` : ""),
  );
  console.log(`Assets: ${OUT_DIR}`);
  console.log(`Catalog: ${CATALOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
