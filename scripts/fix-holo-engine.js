import fs from "node:fs";

const p = "dota/src/utils/holoCardEngine.js";
let s = fs.readFileSync(p, "utf8");

s = s.replace(/function drawSparkles\(c, t, config\.foil\)/, "function drawSparkles(c, t, foil)");
s = s.replace(/function drawPremiumBody\(c, t, config\.foil, config\.glow\)/, "function drawPremiumBody(c, t, foil, glow)");
s = s.replace(/function drawFrameShell\(c, t, config\.foil, config\.glow\)/, "function drawFrameShell(c, t, foil, glow)");
s = s.replace(/function drawHoloHeader\(c, config\.foil, config\.glow\)/, "function drawHoloHeader(c, foil, glow)");

s = s.replace(
  "let startedAt = performance.now();",
  `let startedAt = performance.now();
  let shineX = 0.5;
  let shineY = 0.5;`,
);

s = s.replace(
  "function drawFrame(c, t, config, shine) {\n      const clip =",
  `function drawFrame(c, t, config, shine) {
      shineX = shine?.x ?? 0.5;
      shineY = shine?.y ?? 0.5;
      const foil = config.foil;
      const glow = config.glow;
      const clip =`,
);

s = s.replace(/drawPremiumBody\(c, t, config\.foil, config\.glow\)/g, "drawPremiumBody(c, t, foil, glow)");
s = s.replace(/drawFrameShell\(c, t, config\.foil, config\.glow\)/g, "drawFrameShell(c, t, foil, glow)");
s = s.replace(/drawHoloHeader\(c, config\.foil, config\.glow\)/g, "drawHoloHeader(c, foil, glow)");
s = s.replace(/drawSparkles\(c, t, config\.foil\)/g, "drawSparkles(c, t, foil)");

s = s.replace(
  /function drawInfoModule\(c, t, config, shine\) \{/,
  `function drawInfoModule(c, t, config, shine) {
      const foil = config.foil;
      const glow = config.glow;`,
);

s = s.replace(
  /\n    function render\(targetCtx = ctx[\s\S]*?targetCtx\.restore\(\);\n    \}\n\n    \n\n/,
  "\n\n",
);

s = s.replace(/\n    function drawSafeZones\(c\) \{[\s\S]*?\n    \}\n\n    \/\/ ─── Master draw/, "\n\n    // ─── Master draw");

fs.writeFileSync(p, s);
console.log("fixed", fs.statSync(p).size);
