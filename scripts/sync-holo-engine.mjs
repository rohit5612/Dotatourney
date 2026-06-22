import fs from "node:fs";

const p = "dota/src/utils/holoCardEngine.js";
let s = fs.readFileSync(p, "utf8");

s = s.replace("export const HOLO_WIDTH = 400;", "export const HOLO_WIDTH = 1086;");
s = s.replace("export const HOLO_HEIGHT = 600;", "export const HOLO_HEIGHT = 1448;");

s = s.replace(
  /\/\/ Portrait slot[\s\S]*?const ART_OPENING = \[[\s\S]*?\];/,
  `const ART_BOUNDS = { x: 67, y: 79, w: 950, h: 1019 };
  const ART_OPENING = [
    [67,130],[119,79],[334,79],[379,124],[707,124],[752,79],[967,79],[1017,129],
    [1017,1025],[954,1075],[883,1075],[850,1098],[236,1098],[203,1075],[132,1075],[67,1025]
  ];`,
);

s = s.replace(
  /function normalizeBlackLabelFrame\(img\) \{[\s\S]*?return frame;\n    \}/,
  `function normalizeBlackLabelFrame(img) {
      const frame=document.createElement('canvas');
      frame.width=HOLO_WIDTH; frame.height=HOLO_HEIGHT;
      const fc=frame.getContext('2d');
      fc.drawImage(img,0,0,HOLO_WIDTH,HOLO_HEIGHT);

      const sw=116, sy=112, sh=1218;
      const patch=document.createElement('canvas');
      patch.width=sw; patch.height=sh;
      const pc=patch.getContext('2d');
      pc.translate(sw,0); pc.scale(-1,1);
      pc.drawImage(img,HOLO_WIDTH-sw,sy,sw,sh,0,0,sw,sh);
      fc.drawImage(patch,0,sy);

      const bottomSw=178, bottomSy=1052, bottomSh=HOLO_HEIGHT-bottomSy;
      const bottomPatch=document.createElement('canvas');
      bottomPatch.width=bottomSw; bottomPatch.height=bottomSh;
      const bpc=bottomPatch.getContext('2d');
      bpc.translate(bottomSw,0); bpc.scale(-1,1);
      bpc.drawImage(img,HOLO_WIDTH-bottomSw,bottomSy,bottomSw,bottomSh,0,0,bottomSw,bottomSh);
      fc.drawImage(bottomPatch,0,bottomSy);

      const brandY=638, brandH=172, brandW=62;
      fc.drawImage(img,10,585,brandW,34,10,brandY,brandW,brandH);
      fc.drawImage(img,HOLO_WIDTH-72,585,brandW,34,HOLO_WIDTH-72,brandY,brandW,brandH);

      const edgeW=14;
      const edgePatch=document.createElement('canvas');
      edgePatch.width=edgeW; edgePatch.height=HOLO_HEIGHT;
      const ec=edgePatch.getContext('2d');
      ec.translate(edgeW,0); ec.scale(-1,1);
      ec.drawImage(frame,0,0,edgeW,HOLO_HEIGHT,0,0,edgeW,HOLO_HEIGHT);
      fc.drawImage(edgePatch,HOLO_WIDTH-edgeW,0);
      return frame;
    }`,
);

s = s.replaceAll("offsetX / 310", "offsetX / 840");
s = s.replaceAll("offsetY / 310", "offsetY / 840");

s = s.replace(
  /const body = \[\[[^\]]+\]\];/,
  "const body = [[36,0],[1050,0],[1086,36],[1086,1412],[1050,1448],[36,1448],[0,1412],[0,36]];",
);

s = s.replaceAll(
  /const cardClip=\[\[[^\]]+\]\];/g,
  "const cardClip=[[54,0],[1032,0],[1086,54],[1086,1394],[1032,1448],[54,1448],[0,1394],[0,54]];",
);

s = s.replace(
  /const clip = \[\[[^\]]+\]\];/,
  "const clip = [[54,0],[1032,0],[1086,54],[1086,1394],[1032,1448],[54,1448],[0,1394],[0,54]];",
);

s = s.replace(
  /function drawBottomCenterNeonPanel\(c, t, foil, glow\) \{[\s\S]*?const h = 34[\s\S]*?const h=34/,
  `function drawBottomCenterNeonPanel(c, t, foil, glow) {
      const cx=HOLO_WIDTH/2, y=1394;
      const w=210, h=34`,
);

s = s.replace(
  /const artBottomEdge[\s\S]*?c\.fillRect\([^)]+\);\n      c\.restore\(\);\n\n      c\.save\(\);\n      c\.beginPath\(\);/,
  `const artBottomEdge=[[67,1025],[132,1075],[203,1075],[236,1098],[850,1098],[883,1075],[954,1075],[1017,1025]];
      c.save();
      polyPath(c,ART_OPENING); c.clip();
      const contactShade=c.createLinearGradient(0,1010,0,1098);
      contactShade.addColorStop(0,'rgba(54,38,92,0)');
      contactShade.addColorStop(.55,'rgba(54,38,92,.08)');
      contactShade.addColorStop(.82,'rgba(48,32,84,.20)');
      contactShade.addColorStop(1,'rgba(36,22,68,.36)');
      c.fillStyle=contactShade; c.fillRect(67,1010,950,88);
      c.restore();

      c.save();
      c.beginPath();`,
);

s = s.replace(
  /\/\/ ── Top-center tier title[\s\S]*?c\.restore\(\);\n\n      \/\/ ── MOUSE SPECULAR/,
  `// ── Top-center tier title ────────────────────────────────────────────
      c.save();
      const badgeCenterX=(334+752)/2, badgeCenterY=(22+124)/2-9;
      c.font='800 68px "OxaniumPremium",Bahnschrift,"Arial Narrow",Arial';
      c.textAlign='center'; c.textBaseline='alphabetic';
      const badgeMetrics=c.measureText('HOLO');
      const badgeTextY=badgeCenterY+(badgeMetrics.actualBoundingBoxAscent-badgeMetrics.actualBoundingBoxDescent)/2;
      c.lineWidth=2.5; c.strokeStyle='rgba(64,54,112,.46)';
      c.shadowColor='rgba(96,210,255,.28)'; c.shadowBlur=11;
      c.strokeText('HOLO',badgeCenterX,badgeTextY);
      c.fillStyle=eliteNeonGradient(c,badgeCenterX-180,badgeCenterX+180,t,20);
      c.shadowColor=\`hsla(\${(t*38)%360},100%,65%,.82)\`; c.shadowBlur=20;
      c.fillText('HOLO',badgeCenterX,badgeTextY);
      c.restore();

      drawTopBrandPanel(c,252,27,t,35);
      drawTopBrandPanel(c,HOLO_WIDTH-252,27,t,215);
      c.save();
      [[HOLO_WIDTH-110,51],[HOLO_WIDTH-88,51]].forEach(([dx,dy],i)=>{
        c.fillStyle=i===0?'rgba(160,128,200,.68)':'rgba(110,100,158,.38)';
        c.beginPath(); c.arc(dx,dy,7,0,Math.PI*2); c.fill();
      });
      c.restore();

      // ── MOUSE SPECULAR`,
);

s = s.replace(
  /function drawInfoModule\(c, t, config, shine\) \{[\s\S]*?line\(c,80,1365,HOLO_WIDTH-80,1365,rl,1\);\n    \}/,
  `function drawInfoModule(c, t, config, shine) {
      const foil = config.foil;
      const glow = config.glow;
      const fam = '"OrbitronPremium",Bahnschrift,"Arial Narrow","Segoe UI",Arial';
      const nameFamily = '"OxaniumPremium",Bahnschrift,"Arial Narrow","Segoe UI",Arial';

      c.save();
      const dl=c.createLinearGradient(54,0,HOLO_WIDTH-54,0);
      dl.addColorStop(0,'rgba(140,156,182,0)'); dl.addColorStop(.16,'rgba(140,156,182,.22)');
      dl.addColorStop(.5,'rgba(170,186,208,.34)'); dl.addColorStop(.84,'rgba(140,156,182,.22)'); dl.addColorStop(1,'rgba(140,156,182,0)');
      line(c,54,1112,HOLO_WIDTH-54,1112,dl,1.25); c.restore();

      const name=String(config.playerName).trim()||'Player';
      const nameSz=fitText(c,name,884,84,42,nameFamily,800);
      c.save();
      c.font=\`800 \${nameSz}px \${nameFamily}\`; c.textAlign='center'; c.textBaseline='middle';
      c.lineWidth=3; c.strokeStyle='rgba(40,28,78,.62)';
      c.shadowColor=\`hsla(\${(t*38)%360},100%,65%,\${.86*glow})\`; c.shadowBlur=20;
      c.strokeText(name,HOLO_WIDTH/2,1188);
      c.fillStyle=eliteNeonGradient(c,112,HOLO_WIDTH-112,t); c.fillText(name,HOLO_WIDTH/2,1188);
      c.globalCompositeOperation='screen'; c.globalAlpha=.22+.12*foil;
      c.fillStyle='rgba(255,255,255,.72)'; c.fillText(name,HOLO_WIDTH/2-1,1186);
      c.restore();

      c.save();
      const rl=c.createLinearGradient(80,0,HOLO_WIDTH-80,0);
      rl.addColorStop(0,'rgba(140,156,182,0)'); rl.addColorStop(.18,'rgba(140,156,182,.18)');
      rl.addColorStop(.5,'rgba(170,186,208,.28)'); rl.addColorStop(.82,'rgba(140,156,182,.18)'); rl.addColorStop(1,'rgba(140,156,182,0)');
      line(c,80,1238,HOLO_WIDTH-80,1238,rl,1); c.restore();

      const stats=[
        {label:'KDA', value:config.stats.kda},
        {label:'GPM', value:config.stats.gpm},
        {label:'XPM', value:config.stats.xpm},
        {label:'WIN%',value:(String(config.stats.winrate || '').replace('%','') + '%')}
      ];
      const sL=88,sT=1248,sW2=(HOLO_WIDTH-176)/4;
      stats.forEach(({label,value},i)=>{
        const cx=sL+i*sW2+sW2/2+(i<3?18:0)+(i===0?8:0);
        if (i>0) {
          const dg=c.createLinearGradient(sL+i*sW2,sT,sL+i*sW2,sT+100);
          dg.addColorStop(0,'rgba(155,162,198,0)'); dg.addColorStop(.5,'rgba(155,162,198,.30)'); dg.addColorStop(1,'rgba(155,162,198,0)');
          line(c,sL+i*sW2,sT+8,sL+i*sW2,sT+92,dg,1);
        }
        c.save(); c.textAlign='center'; c.textBaseline='middle';
        c.font=\`800 17px \${nameFamily}\`; c.fillStyle=eliteNeonGradient(c,cx-72,cx+72,t,i*45);
        c.shadowColor=\`hsla(\${(t*38+i*45)%360},100%,65%,.72)\`; c.shadowBlur=9;
        c.fillText(label,cx,sT+16); c.restore();
        c.save(); c.textAlign='center'; c.textBaseline='middle';
        c.font=\`900 46px \${fam}\`; c.lineWidth=2; c.strokeStyle='rgba(38,28,76,.58)';
        c.strokeText(value||'--',cx,sT+66);
        c.fillStyle=eliteNeonGradient(c,cx-100,cx+100,t,i*45);
        c.shadowColor=\`hsla(\${(t*38+i*45)%360},100%,65%,\${.82*glow})\`; c.shadowBlur=16;
        c.fillText(value||'--',cx,sT+66); c.restore();
      });
      line(c,80,1365,HOLO_WIDTH-80,1365,rl,1);
    }`,
);

s = s.replace(
  /const moduleGlows=\[[\s\S]*?\];/,
  `const moduleGlows=[
        [250,48,86,0],[836,48,86,70],
        [35,230,72,130],[35,520,72,190],[35,790,72,250],[35,1190,82,310],
        [1051,230,72,40],[1051,520,72,100],[1051,790,72,160],[1051,1190,82,220],
        [250,1408,92,280],[836,1408,92,340]
      ];`,
);

s = s.replace(
  /const cx = HOLO_WIDTH \/ 2;\n      const cy = ART_BOUNDS\.y \+ ART_BOUNDS\.h \/ 2;/,
  "const cx=HOLO_WIDTH/2, cy=542;",
);

fs.writeFileSync(p, s);
console.log("patched", p);
