import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(join(dir, "bpcl-rulebook-shell.html"), "utf8");
const inner = readFileSync(join(dir, "bpcl-rulebook-inner.html"), "utf8");
const html = shell.replace("<!--INNER-->", inner.trim());
writeFileSync(join(dir, "../public/bpcl-rulebook.html"), html, "utf8");
console.log("Wrote public/bpcl-rulebook.html");
