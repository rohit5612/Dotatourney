import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const INDEX_PATH = path.join(REPO_ROOT, "dota", "src", "constants", "dotaHeroCatalog.json");

let slugById = null;
let nameById = null;

function ensureCatalog() {
  if (slugById) return;
  slugById = new Map();
  nameById = new Map();
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return;
  }
  for (const row of list) {
    if (row?.id == null || !row.slug) continue;
    slugById.set(Number(row.id), row.slug);
    if (row.localized_name) nameById.set(Number(row.id), row.localized_name);
  }
}

/** @param {number | string | null | undefined} heroId */
export function heroSlugById(heroId) {
  ensureCatalog();
  return slugById?.get(Number(heroId)) || "";
}

/** @param {number | string | null | undefined} heroId */
export function heroLocalizedNameById(heroId) {
  ensureCatalog();
  return nameById?.get(Number(heroId)) || "";
}
