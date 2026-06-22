/** BPCL Holo card canvas engine */
export const HOLO_WIDTH = 1086;
export const HOLO_HEIGHT = 1448;
export const HOLO_FRAME_SRC = '/cards/holo/frame.png';

export const DEFAULT_HOLO_CONFIG = {
  playerName: 'Player',
  stats: { kda: '--', gpm: '--', xpm: '--', winrate: '--' },
  foil: 0.82,
  glow: 0.7,
  cropMode: 'fill',
  avatarZoom: 1,
  avatarX: 0,
  avatarY: 0,
};

export function normalizeHoloConfig(input = {}) {
  const stats = { ...DEFAULT_HOLO_CONFIG.stats, ...(input.stats || {}) };
  return {
    ...DEFAULT_HOLO_CONFIG,
    ...input,
    stats,
    playerName: String(input.playerName || DEFAULT_HOLO_CONFIG.playerName).trim() || 'Player',
    foil: Number(input.foil ?? DEFAULT_HOLO_CONFIG.foil),
    glow: Number(input.glow ?? DEFAULT_HOLO_CONFIG.glow),
    cropMode: input.cropMode === 'fit' ? 'fit' : 'fill',
    avatarZoom: Number(input.avatarZoom ?? DEFAULT_HOLO_CONFIG.avatarZoom),
    avatarX: Number(input.avatarX ?? DEFAULT_HOLO_CONFIG.avatarX),
    avatarY: Number(input.avatarY ?? DEFAULT_HOLO_CONFIG.avatarY),
  };
}

export function holoPayloadFromManifest(manifest) {
  const payload = manifest?.cardPayload || manifest || {};
  return normalizeHoloConfig({
    playerName: payload.playerName || manifest?.displayName,
    stats: payload.stats || manifest?.stats,
    foil: payload.foil,
    glow: payload.glow,
    cropMode: payload.crop?.mode || payload.cropMode,
    avatarZoom: payload.crop?.zoom ?? payload.avatarZoom,
    avatarX: payload.crop?.x ?? payload.avatarX,
    avatarY: payload.crop?.y ?? payload.avatarY,
  });
}

export function buildHoloCardPayload(fields = {}) {
  const normalized = normalizeHoloConfig({
    playerName: fields.playerName,
    stats: fields.stats,
    foil: fields.foil,
    glow: fields.glow,
    cropMode: fields.crop?.mode ?? fields.cropMode,
    avatarZoom: fields.crop?.zoom ?? fields.avatarZoom,
    avatarX: fields.crop?.x ?? fields.avatarX,
    avatarY: fields.crop?.y ?? fields.avatarY,
  });
  return {
    version: 1,
    template: 'holo',
    tier: 'holo',
    playerName: normalized.playerName,
    avatarUrl: fields.avatarUrl || '',
    stats: normalized.stats,
    foil: normalized.foil,
    glow: normalized.glow,
    crop: {
      mode: normalized.cropMode,
      zoom: normalized.avatarZoom,
      x: normalized.avatarX,
      y: normalized.avatarY,
    },
  };
}


import { isAnimatedGifUrl } from './readPortraitUploadFile.js';

export function createHoloCardEngine({ frameSrc = HOLO_FRAME_SRC } = {}) {
  let avatar = null;
  let avatarObjectUrl = null;
  let gifDecoder = null;
  let gifTimer = 0;
  let gifToken = 0;
  let frameImage = null;
  let frameOverlay = null;
  let frameReady = null;
  let startedAt = performance.now();
  let shineX = 0.5;
  let shineY = 0.5;

  const ART_BOUNDS = { x: 67, y: 79, w: 950, h: 1019 };
  const ART_OPENING = [
    [67,130],[119,79],[334,79],[379,124],[707,124],[752,79],[967,79],[1017,129],
    [1017,1025],[954,1075],[883,1075],[850,1098],[236,1098],[203,1075],[132,1075],[67,1025]
  ];

function polyPath(c, points) {
      c.beginPath();
      points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.closePath();
    }

    function clipFrameMaterial(c, outer) {
      c.beginPath();
      outer.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.closePath();
      ART_OPENING.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.closePath();
      c.clip('evenodd');
    }

    function prismTextGradient(c, x1, x2) {
      const travel = (shineX - 0.5) * 180;
      const g = c.createLinearGradient(x1 + travel, 0, x2 + travel, 0);
      g.addColorStop(0, '#ff4fbf');
      g.addColorStop(.18, '#a979ff');
      g.addColorStop(.38, '#42cfff');
      g.addColorStop(.58, '#49f0bb');
      g.addColorStop(.78, '#ffe36e');
      g.addColorStop(1, '#ff739d');
      return g;
    }

    function staticHoloTextGradient(c, x1, x2) {
      const g = c.createLinearGradient(x1, 0, x2, 0);
      g.addColorStop(0, '#ff4fbf');
      g.addColorStop(0.18, '#a979ff');
      g.addColorStop(0.38, '#42cfff');
      g.addColorStop(0.58, '#49f0bb');
      g.addColorStop(0.78, '#ffe36e');
      g.addColorStop(1, '#ff739d');
      return g;
    }

    function pulsingHoloTextGradient(c, x1, x2, t, offset = 0) {
      const pulse = 0.78 + 0.22 * Math.sin(t * 2.6 + offset * 0.025);
      const sweep = (shineX - 0.5) * 120 + Math.sin(t * 1.9 + offset * 0.035) * 110;
      const hue = (t * 44 + offset) % 360;
      const g = c.createLinearGradient(x1 + sweep, 0, x2 + sweep, 0);
      const stops = [
        [0, hue],
        [0.16, hue + 58],
        [0.34, hue + 128],
        [0.52, hue + 198],
        [0.7, hue + 268],
        [0.86, hue + 328],
        [1, hue + 360],
      ];
      stops.forEach(([pos, h]) => {
        g.addColorStop(pos, `hsl(${h % 360} 88% ${54 + pulse * 14}%)`);
      });
      return g;
    }

    function staticPrismGradient(c, x1, x2) {
      return prismTextGradient(c, x1, x2);
    }

    function eliteNeonGradient(c, x1, x2, t, offset = 0) {
      return pulsingHoloTextGradient(c, x1, x2, t, offset);
    }

    function drawEmbossedBrand(c, x, y, rotation, t, offset = 0) {
      c.save();
      c.translate(x, y);
      // Both side brands are drawn as identical vertical titanium insets.
      // Do not rotate/mirror the canvas here: the frame rails are not perfectly
      // symmetric in the source art, so mirrored text makes the two sides feel
      // different. A shared slot geometry keeps the marks aligned.
      const slotW=34, slotH=112, r=8;
      c.globalCompositeOperation='source-over';
      const pocket=c.createLinearGradient(-slotW/2,0,slotW/2,0);
      pocket.addColorStop(0,'rgba(4,7,14,.88)');
      pocket.addColorStop(.48,'rgba(18,24,36,.96)');
      pocket.addColorStop(1,'rgba(5,8,15,.88)');
      c.shadowColor='rgba(0,0,0,.78)'; c.shadowBlur=10;
      roundedRect(c,-slotW/2,-slotH/2,slotW,slotH,r); c.fillStyle=pocket; c.fill();

      c.shadowColor=`hsla(${(t*38+offset)%360},100%,65%,.68)`; c.shadowBlur=11;
      const rim=eliteNeonGradient(c,-slotW/2,slotW/2,t,offset);
      c.strokeStyle=rim; c.lineWidth=2.2;
      roundedRect(c,-slotW/2+3,-slotH/2+3,slotW-6,slotH-6,r-3); c.stroke();

      c.globalCompositeOperation='screen';
      const inner=c.createLinearGradient(0,-slotH/2,0,slotH/2);
      inner.addColorStop(0,'rgba(255,78,218,.24)');
      inner.addColorStop(.34,'rgba(76,220,255,.24)');
      inner.addColorStop(.68,'rgba(92,255,194,.22)');
      inner.addColorStop(1,'rgba(255,226,100,.20)');
      roundedRect(c,-5,-slotH/2+12,10,slotH-24,5); c.fillStyle=inner; c.fill();

      c.globalCompositeOperation='source-over';
      c.font='900 24px "Oxanium",Bahnschrift,Arial';
      c.textAlign='center'; c.textBaseline='middle';
      const letters=['B','P','C','L'];
      const top=-34, step=22;
      letters.forEach((ch,i)=>{
        const yy=top+i*step;
        c.lineWidth=3.6; c.strokeStyle='rgba(1,3,8,.96)'; c.strokeText(ch,0,yy+1.2);
        c.lineWidth=1.1; c.strokeStyle='rgba(218,242,255,.46)'; c.strokeText(ch,0,yy-1);
        c.fillStyle=eliteNeonGradient(c,-22,22,t,offset+i*22);
        c.shadowColor=`hsla(${(t*38+offset+i*22)%360},100%,66%,.82)`;
        c.shadowBlur=10;
        c.fillText(ch,0,yy);
        c.globalCompositeOperation='screen'; c.globalAlpha=.24;
        c.fillStyle='rgba(255,255,255,.86)'; c.fillText(ch,-.45,yy-.55);
        c.globalAlpha=1; c.globalCompositeOperation='source-over';
      });
      c.restore();
    }

    function drawBottomCenterNeonPanel(c, t, foil, glow) {
      const cx = HOLO_WIDTH / 2;
      const y = 1394;
      const w = 210;
      const h = 34;

      c.save();
      const shell=[[cx-w/2+18,y],[cx+w/2-18,y],[cx+w/2,y+12],[cx+w/2-28,y+h],[cx-w/2+28,y+h],[cx-w/2,y+12]];
      polyPath(c,shell);
      const base=c.createLinearGradient(cx-w/2,y,cx+w/2,y+h);
      base.addColorStop(0,'rgba(6,9,18,.92)');
      base.addColorStop(.5,'rgba(21,30,48,.94)');
      base.addColorStop(1,'rgba(5,8,16,.92)');
      c.shadowColor='rgba(0,0,0,.70)'; c.shadowBlur=14; c.fillStyle=base; c.fill();

      c.shadowBlur=0;
      const rim=staticPrismGradient(c,cx-w/2,cx+w/2);
      c.strokeStyle=rim; c.lineWidth=2.8; polyPath(c,shell); c.stroke();
      c.strokeStyle='rgba(245,252,255,.52)'; c.lineWidth=1;
      polyPath(c,[[cx-w/2+25,y+5],[cx+w/2-25,y+5],[cx+w/2-40,y+11],[cx-w/2+40,y+11]]);
      c.stroke();

      const slotCount=7, slotW=14, gap=10;
      const start=cx-(slotCount*slotW+(slotCount-1)*gap)/2;
      for(let i=0;i<slotCount;i++){
        const x=start+i*(slotW+gap);
        const sg=c.createLinearGradient(x,y+9,x+slotW,y+27);
        sg.addColorStop(0,'#8ed8ff');
        sg.addColorStop(.5,'rgba(255,255,255,.92)');
        sg.addColorStop(1,'#c8a8ff');
        roundedRect(c,x,y+11,slotW,14,4);
        c.fillStyle=sg; c.fill();
        c.fillStyle='rgba(255,255,255,.72)';
        c.fillRect(x+2,y+12,slotW-4,2);
      }
      c.restore();
    }

    function drawTopBrandPanel(c, x, y, t, offset = 0) {
      c.save();
      c.translate(x,y);
      c.globalCompositeOperation='source-over';
      c.font='900 24px "Oxanium",Bahnschrift,Arial';
      c.textAlign='center';
      c.textBaseline='middle';
      c.shadowBlur=0;
      c.shadowColor='transparent';
      c.lineJoin='round';
      c.miterLimit=2;
      c.lineWidth=3.8;
      c.strokeStyle='rgba(1,3,8,.98)';
      drawTrackedText(c,'BPCL',0,0.8,1.35,true);
      c.fillStyle='#dffcff';
      drawTrackedText(c,'BPCL',0,0,1.35,false);
      c.globalCompositeOperation='source-atop';
      const crispTint=c.createLinearGradient(-44,0,44,0);
      crispTint.addColorStop(0,'rgba(255,92,222,.45)');
      crispTint.addColorStop(.32,'rgba(100,236,255,.40)');
      crispTint.addColorStop(.66,'rgba(116,255,172,.38)');
      crispTint.addColorStop(1,'rgba(255,232,100,.42)');
      c.fillStyle=crispTint;
      drawTrackedText(c,'BPCL',0,0,1.35,false);
      c.restore();
    }

    function roundedRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function line(c, x1, y1, x2, y2, color, width) {
      c.strokeStyle = color;
      c.lineWidth   = width;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }

    function strokePoly(c, points, color, width, shadowColor = 'transparent', shadowBlur = 0) {
      c.save();
      c.strokeStyle  = color;
      c.lineWidth    = width;
      c.shadowColor  = shadowColor;
      c.shadowBlur   = shadowBlur;
      polyPath(c, points);
      c.stroke();
      c.restore();
    }

    function fillPoly(c, points, fill, shadowColor = 'transparent', shadowBlur = 0, shadowY = 0) {
      c.save();
      c.fillStyle      = fill;
      c.shadowColor    = shadowColor;
      c.shadowBlur     = shadowBlur;
      c.shadowOffsetY  = shadowY;
      polyPath(c, points);
      c.fill();
      c.restore();
    }

    function fitText(c, text, maxWidth, startSize, minSize, family, weight = 900) {
      let size = startSize;
      do {
        c.font = `${weight} ${size}px ${family}`;
        if (c.measureText(text).width <= maxWidth) return size;
        size -= 1;
      } while (size >= minSize);
      return minSize;
    }

    function drawTrackedText(c, text, centerX, y, tracking, stroke = false) {
      const widths = [...text].map(ch => c.measureText(ch).width);
      const total  = widths.reduce((s, w) => s + w, 0) + tracking * (widths.length - 1);
      let x = centerX - total / 2;
      [...text].forEach((ch, i) => {
        if (stroke) c.strokeText(ch, x, y);
        else c.fillText(ch, x, y);
        x += widths[i] + tracking;
      });
    }

    function drawNeonText(c, text, x, y, size, align = 'center') {
      c.save();
      c.font          = `900 ${size}px Orbitron, "Segoe UI", Arial`;
      c.textAlign     = align;
      c.textBaseline  = 'middle';
      c.shadowColor   = 'rgba(122,245,255,.65)';
      c.shadowBlur    = 26;
      const g = c.createLinearGradient(x - 360, y, x + 360, y);
      g.addColorStop(0,   '#ffffff');
      g.addColorStop(.25, '#aef8ff');
      g.addColorStop(.5,  '#ffe2fb');
      g.addColorStop(.75, '#d6dcff');
      g.addColorStop(1,   '#ffffff');
      c.fillStyle = g;
      c.fillText(text, x, y);
      c.restore();
    }

    function drawPositionedImage(c, img, x, y, w, h, mode, zoom, offsetX, offsetY) {
      c.imageSmoothingEnabled  = true;
      c.imageSmoothingQuality  = 'high';
      const imageWidth = img.naturalWidth || img.videoWidth || img.displayWidth || img.codedWidth || img.width;
      const imageHeight = img.naturalHeight || img.videoHeight || img.displayHeight || img.codedHeight || img.height;
      const scale = (mode === 'fit'
        ? Math.min(w / imageWidth, h / imageHeight)
        : Math.max(w / imageWidth, h / imageHeight)) * zoom;
      const dw = imageWidth  * scale;
      const dh = imageHeight * scale;
      const posX = Math.max(0, Math.min(1, 0.5 + offsetX / 840));
      const posY = Math.max(0, Math.min(1, 0.42 + offsetY / 840));
      const dx = dw >= w ? x - (dw - w) * posX : x + (w - dw) * posX;
      const dy = dh >= h ? y - (dh - h) * posY : y + (h - dh) * posY;
      c.drawImage(img, dx, dy, dw, dh);
    }

    function buildFrameOverlay(img) {
      const ov  = document.createElement('canvas');
      ov.width  = HOLO_WIDTH; ov.height = HOLO_HEIGHT;
      const oc  = ov.getContext('2d');
      oc.drawImage(img, 0, 0, HOLO_WIDTH, HOLO_HEIGHT);
      oc.globalCompositeOperation = 'destination-out';
      polyPath(oc, ART_OPENING);
      oc.fillStyle = '#000';
      oc.fill();
      oc.globalCompositeOperation = 'source-over';
      return ov;
    }

    function normalizeBlackLabelFrame(img) {
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
    }

    function sampleArtworkTone(img) {
      try {
        const s = document.createElement('canvas');
        s.width = 32; s.height = 32;
        const sc = s.getContext('2d', { willReadFrequently: true });
        sc.drawImage(img, 0, 0, 32, 32);
        const data = sc.getImageData(0, 12, 32, 20).data;
        let r = 0, g = 0, b = 0, wt = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 32) continue;
          const lum = (data[i] + data[i+1] + data[i+2]) / 3;
          const w   = 0.35 + (255 - lum) / 255;
          r += data[i] * w; g += data[i+1] * w; b += data[i+2] * w; wt += w;
        }
      } catch (e) {}
    }

    // ─── Placeholder ────────────────────────────────────────────────

    // ── Sparkle points — precomputed deterministic positions ──────────
    function getSparkles() {
      if (getSparkles._pts) return getSparkles._pts;
      let s = 0xdeadbeef;
      const r = () => { s = ((s^(s<<13))>>>0); s = ((s^(s>>>17))>>>0); s = ((s^(s<<5))>>>0); return s/0xffffffff; };
      getSparkles._pts = Array.from({length:220}, (_,i) => ({
        x:36+r()*(HOLO_WIDTH-72), y:26+r()*(HOLO_HEIGHT-52), rad:2+r()*6, hue:r()*360, ph:r()*Math.PI*2, br:0.4+r()*0.6
      }));
      return getSparkles._pts;
    }

    function drawSparkles(c, t, foil) {
      return;
    }

    function drawAvatarPlaceholder(c, t) {
      const cx=HOLO_WIDTH/2, cy=542;
      // Camera placeholder icon — subtle on metallic holo bg
      c.save(); c.translate(cx,cy-16);
      c.fillStyle='rgba(125,220,255,.12)';
      roundedRect(c,-58,-40,116,82,14); c.fill();
      c.strokeStyle='rgba(125,220,255,.30)'; c.lineWidth=5;
      c.beginPath(); c.arc(0,6,30,0,Math.PI*2); c.stroke();
      c.strokeStyle='rgba(255,80,215,.24)'; c.lineWidth=3.5;
      c.beginPath(); c.arc(0,6,18,0,Math.PI*2); c.stroke();
      c.restore();
      c.save(); c.font='600 24px Bahnschrift SemiCondensed,Bahnschrift,"Arial Narrow",Arial';
      c.textAlign='center'; c.textBaseline='middle';
      c.fillStyle='rgba(165,228,255,.52)'; c.fillText('UPLOAD PHOTO',cx,cy+96); c.restore();
    }

    // ─── Card body ──────────────────────────────────────────────────

    function drawPremiumBody(c, t, foil, glow) {
      const body = [[36,0],[1050,0],[1086,36],[1086,1412],[1050,1448],[36,1448],[0,1412],[0,36]];

      // Card drop shadow — frame image handles all visual design
      c.save();
      c.shadowColor='rgba(0,0,0,.50)'; c.shadowBlur=58; c.shadowOffsetY=24;
      polyPath(c,body); c.fillStyle='#d4d0ca'; c.fill();
      c.restore();
      // Pearl fallback base (only visible if the frame image hasn't loaded yet)
      if (!frameImage) {
        c.save(); polyPath(c,body); c.fillStyle='#fdfcfb'; c.fill(); c.restore();
      }
      // (pearl layers removed — reference frame PNG handles all card visuals)

      // ── PASTEL PRISM — large soft colour washes ───────────────────────
      // source-over at 38-44% on near-white = visible pastel rainbow (real holo feel)
      // Layer 1: diagonal TL→BR  pink→lavender→blue→mint→gold
      c.save();
      const p1=c.createLinearGradient(0,0,HOLO_WIDTH,HOLO_HEIGHT);
      p1.addColorStop(0,    `rgba(255,148,195,${.40*foil})`);
      p1.addColorStop(0.18, `rgba(210,168,255,${.38*foil})`);
      p1.addColorStop(0.36, `rgba(148,202,255,${.42*foil})`);
      p1.addColorStop(0.54, `rgba(148,238,208,${.38*foil})`);
      p1.addColorStop(0.72, `rgba(255,238,158,${.34*foil})`);
      p1.addColorStop(0.90, `rgba(255,168,200,${.32*foil})`);
      p1.addColorStop(1,    `rgba(210,168,255,${.28*foil})`);
      polyPath(c,body); c.fillStyle=p1; c.fill(); c.restore();
      // Layer 2: orthogonal TR→BL for cross-shimmer depth
      c.save();
      const p2=c.createLinearGradient(HOLO_WIDTH,0,0,HOLO_HEIGHT);
      p2.addColorStop(0,    `rgba(168,215,255,${.26*foil})`);
      p2.addColorStop(0.25, `rgba(255,215,240,${.24*foil})`);
      p2.addColorStop(0.50, `rgba(210,255,228,${.24*foil})`);
      p2.addColorStop(0.75, `rgba(255,242,178,${.22*foil})`);
      p2.addColorStop(1,    `rgba(228,178,255,${.24*foil})`);
      polyPath(c,body); c.fillStyle=p2; c.fill(); c.restore();
      // Layer 3: mouse-reactive band — shifts angle + zone with cursor
      const ang=Math.atan2(shineY-.5,shineX-.5)+Math.PI*.18;
      const mpx=HOLO_WIDTH*.28+shineX*(HOLO_WIDTH*.44), mpy=HOLO_HEIGHT*.28+shineY*(HOLO_HEIGHT*.44), md=920;
      const mca=Math.cos(ang),msa=Math.sin(ang);
      const p3=c.createLinearGradient(mpx-mca*md,mpy-msa*md,mpx+mca*md,mpy+msa*md);
      p3.addColorStop(0,    `rgba(255,202,232,${.22*foil})`);
      p3.addColorStop(0.20, `rgba(232,202,255,${.24*foil})`);
      p3.addColorStop(0.38, `rgba(192,228,255,${.26*foil})`);
      p3.addColorStop(0.56, `rgba(192,252,222,${.24*foil})`);
      p3.addColorStop(0.74, `rgba(255,250,192,${.22*foil})`);
      p3.addColorStop(0.90, `rgba(255,208,238,${.20*foil})`);
      p3.addColorStop(1,    `rgba(232,202,255,${.16*foil})`);
      c.save(); polyPath(c,body); c.fillStyle=p3; c.fill(); c.restore();

      // ── SPARKLE LAYER ─────────────────────────────────────────────────
      drawSparkles(c, t, foil);

      // ── Mouse specular hotspot ────────────────────────────────────────
      const hx2=80+shineX*(HOLO_WIDTH-160), hy2=80+shineY*(HOLO_HEIGHT-160);
      const hi2=c.createRadialGradient(hx2,hy2,0,hx2,hy2,360);
      hi2.addColorStop(0,`rgba(255,255,255,${.62*foil})`);
      hi2.addColorStop(.30,`rgba(255,255,255,${.20*foil})`);
      hi2.addColorStop(1,'rgba(255,255,255,0)');
      c.save(); polyPath(c,body); c.fillStyle=hi2; c.fill(); c.restore();

      // ── Corner screws — subtle chrome ─────────────────────────────────
      [[60,60],[1026,60],[1026,1388],[60,1388]].forEach(([x,y])=>{
        c.save();
        c.shadowColor='rgba(0,0,0,.18)'; c.shadowBlur=5; c.shadowOffsetY=1;
        const s=c.createRadialGradient(x-3,y-3,0,x,y,13);
        s.addColorStop(0,'rgba(255,255,255,.99)'); s.addColorStop(.30,'rgba(220,224,234,.90)');
        s.addColorStop(.62,'rgba(165,172,192,.82)'); s.addColorStop(1,'rgba(110,118,142,.55)');
        c.fillStyle=s; c.beginPath(); c.arc(x,y,13,0,Math.PI*2); c.fill(); c.restore();
        line(c,x-5,y+5,x+5,y-5,'rgba(80,88,115,.38)',2.5);
        line(c,x-4,y-4,x+4,y+4,'rgba(255,255,255,.60)',1.5);
      });
    }

    // ─── Frame shell ────────────────────────────────────────────────

    function drawBlackLabelMaterial(c, t, foil, glow) {
      return;
    }

    function drawFrameShell(c, t, foil, glow) {
      const cardClip=[[54,0],[1032,0],[1086,54],[1086,1394],[1032,1448],[54,1448],[0,1394],[0,54]];

      drawBlackLabelMaterial(c,t,foil,glow);

      // Frame is the reference PNG template (loaded above).
      // Here we only add the dynamic holo prism + sparkles + specular.

      // ── PASTEL PRISM — source-over on the frame's near-white surface ─────
      // source-over at 38% on near-white adds visible pastel rainbow
      // source-over on frame's existing iridescent areas makes them more vivid
      const pr1=c.createLinearGradient(0,0,HOLO_WIDTH,HOLO_HEIGHT);
      pr1.addColorStop(0,    `rgba(255,70,205,${.06*foil})`);
      pr1.addColorStop(0.18, `rgba(145,92,255,${.05*foil})`);
      pr1.addColorStop(0.36, `rgba(45,205,255,${.08*foil})`);
      pr1.addColorStop(0.54, `rgba(102,255,195,${.05*foil})`);
      pr1.addColorStop(0.72, `rgba(205,255,82,${.05*foil})`);
      pr1.addColorStop(0.90, `rgba(255,70,205,${.05*foil})`);
      pr1.addColorStop(1,    `rgba(145,92,255,${.04*foil})`);
      c.save(); clipFrameMaterial(c,cardClip); c.fillStyle=pr1; c.fillRect(0,0,HOLO_WIDTH,HOLO_HEIGHT); c.restore();
      // Mouse-reactive band
      const mang=Math.atan2(shineY-.5,shineX-.5)+Math.PI*.18;
      const mpx=HOLO_WIDTH*.28+shineX*(HOLO_WIDTH*.44), mpy=HOLO_HEIGHT*.28+shineY*(HOLO_HEIGHT*.44), mmd=940;
      const mca=Math.cos(mang),msa=Math.sin(mang);
      const pr2=c.createLinearGradient(mpx-mca*mmd,mpy-msa*mmd,mpx+mca*mmd,mpy+msa*mmd);
      pr2.addColorStop(0,'rgba(255,255,255,0)');
      pr2.addColorStop(.20,`rgba(255,82,215,${.08*foil})`);
      pr2.addColorStop(.38,`rgba(142,92,255,${.09*foil})`);
      pr2.addColorStop(.56,`rgba(48,212,255,${.10*foil})`);
      pr2.addColorStop(.74,`rgba(106,255,194,${.08*foil})`);
      pr2.addColorStop(.90,`rgba(205,255,82,${.07*foil})`);
      pr2.addColorStop(1,'rgba(255,255,255,0)');
      c.save(); clipFrameMaterial(c,cardClip); c.fillStyle=pr2; c.fillRect(0,0,HOLO_WIDTH,HOLO_HEIGHT); c.restore();
      // ────────────────────────────────────────────────────────────────────
      // (all programmatic structural overlays removed — reference PNG has them)
      c.save(); clipFrameMaterial(c,cardClip);
      const ev=c.createRadialGradient(HOLO_WIDTH/2,HOLO_HEIGHT*.42,HOLO_HEIGHT*.28,HOLO_WIDTH/2,HOLO_HEIGHT*.42,HOLO_HEIGHT*.72);
      ev.addColorStop(0,'rgba(0,0,0,0)'); ev.addColorStop(.68,'rgba(0,0,0,0)'); ev.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=ev; c.fillRect(0,0,HOLO_WIDTH,HOLO_HEIGHT); c.restore();

      // (structural overlays removed — reference PNG frame handles all detail)

      // ── Top-center tier title ────────────────────────────────────────────
      c.save();
      const badgeCenterX=(334+752)/2, badgeCenterY=(22+124)/2-9;
      c.font='800 68px "Oxanium",Bahnschrift,"Arial Narrow",Arial';
      c.textAlign='center'; c.textBaseline='alphabetic';
      const badgeMetrics=c.measureText('HOLO');
      const badgeTextY=badgeCenterY+(badgeMetrics.actualBoundingBoxAscent-badgeMetrics.actualBoundingBoxDescent)/2;
      c.lineWidth=2.5; c.strokeStyle='rgba(64,54,112,.46)';
      c.shadowColor='transparent'; c.shadowBlur=0;
      c.strokeText('HOLO',badgeCenterX,badgeTextY);
      c.fillStyle=staticPrismGradient(c,badgeCenterX-180,badgeCenterX+180);
      c.shadowColor='transparent'; c.shadowBlur=0;
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

      // ── MOUSE SPECULAR HOTSPOT ──────────────────────────────────────────
      const hx=80+shineX*(HOLO_WIDTH-160), hy=80+shineY*(HOLO_HEIGHT-160);
      const hi=c.createRadialGradient(hx,hy,0,hx,hy,420);
      hi.addColorStop(0,`rgba(255,255,255,${.60*foil})`);
      hi.addColorStop(.32,`rgba(255,255,255,${.18*foil})`);
      hi.addColorStop(1,'rgba(255,255,255,0)');
      c.save(); clipFrameMaterial(c,cardClip); c.fillStyle=hi; c.fillRect(0,0,HOLO_WIDTH,HOLO_HEIGHT); c.restore();

      // ── BOTTOM CENTER NEON PANEL ────────────────────────────────────────
      drawBottomCenterNeonPanel(c,t,foil,glow);
    }

    // ─── Holo header (content now lives in badge inside drawFrameShell) ──

    function drawHoloHeader(c, foil, glow) { /* moved to badge */ }

    // ─── Info module — dark navy zone integrated into card ─────────────

    function drawInfoModule(c, t, config, shine) {
      const foil = config.foil;
      const glow = config.glow;
      const fam = '"Orbitron",Bahnschrift,"Arial Narrow","Segoe UI",Arial';
      const nameFamily = '"Oxanium",Bahnschrift,"Arial Narrow","Segoe UI",Arial';

      c.save();
      const dl = c.createLinearGradient(54, 0, HOLO_WIDTH - 54, 0);
      dl.addColorStop(0, 'rgba(140,156,182,0)');
      dl.addColorStop(0.16, 'rgba(140,156,182,.22)');
      dl.addColorStop(0.5, 'rgba(170,186,208,.34)');
      dl.addColorStop(0.84, 'rgba(140,156,182,.22)');
      dl.addColorStop(1, 'rgba(140,156,182,0)');
      line(c, 54, 1112, HOLO_WIDTH - 54, 1112, dl, 1.25);
      c.restore();

      const name = String(config.playerName).trim() || 'Player';
      const nameY = 1182;
      const nameSz = fitText(c, name, 884, 97, 42, nameFamily, 800);
      c.save();
      c.font = `800 ${nameSz}px ${nameFamily}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(40,28,78,.62)';
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
      c.strokeText(name, HOLO_WIDTH / 2, nameY);
      c.fillStyle = pulsingHoloTextGradient(c, 112, HOLO_WIDTH - 112, t, 0);
      c.fillText(name, HOLO_WIDTH / 2, nameY);
      c.restore();

      c.save();
      const rl = c.createLinearGradient(80, 0, HOLO_WIDTH - 80, 0);
      rl.addColorStop(0, 'rgba(140,156,182,0)');
      rl.addColorStop(0.18, 'rgba(140,156,182,.18)');
      rl.addColorStop(0.5, 'rgba(170,186,208,.28)');
      rl.addColorStop(0.82, 'rgba(140,156,182,.18)');
      rl.addColorStop(1, 'rgba(140,156,182,0)');
      line(c, 80, 1238, HOLO_WIDTH - 80, 1238, rl, 1);
      c.restore();

      const stats = [
        { label: 'KDA', value: config.stats.kda },
        { label: 'GPM', value: config.stats.gpm },
        { label: 'XPM', value: config.stats.xpm },
        { label: 'WIN%', value: `${String(config.stats.winrate || '').replace('%', '')}%` },
      ];
      const sL = 88;
      const sT = 1248;
      const sW2 = (HOLO_WIDTH - 176) / 4;
      stats.forEach(({ label, value }, i) => {
        const cx = sL + i * sW2 + sW2 / 2 + (i < 3 ? 18 : 0) + (i === 0 ? 8 : 0);
        if (i > 0) {
          const dg = c.createLinearGradient(sL + i * sW2, sT, sL + i * sW2, sT + 100);
          dg.addColorStop(0, 'rgba(155,162,198,0)');
          dg.addColorStop(0.5, 'rgba(155,162,198,.30)');
          dg.addColorStop(1, 'rgba(155,162,198,0)');
          line(c, sL + i * sW2, sT + 8, sL + i * sW2, sT + 92, dg, 1);
        }
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `800 26px ${nameFamily}`;
        c.fillStyle = staticHoloTextGradient(c, cx - 72, cx + 72);
        c.shadowColor = 'transparent';
        c.shadowBlur = 0;
        c.fillText(label, cx, sT + 16);
        c.restore();
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `900 46px ${fam}`;
        c.lineWidth = 2;
        c.strokeStyle = 'rgba(38,28,76,.58)';
        c.shadowColor = 'transparent';
        c.shadowBlur = 0;
        c.strokeText(value || '--', cx, sT + 66);
        c.fillStyle = pulsingHoloTextGradient(c, cx - 100, cx + 100, t, i * 48 + 24);
        c.fillText(value || '--', cx, sT + 66);
        c.restore();
      });
      line(c, 80, 1365, HOLO_WIDTH - 80, 1365, rl, 1);
    }

    // ─── Safe zones ─────────────────────────────────────────────────


    // ─── Art window edge (drawn after portrait punch-through) ───────

    function drawArtWindowBevel(c) {
      strokePoly(c, ART_OPENING, 'rgba(232,248,255,.76)', 2.5, 'rgba(98,78,158,.34)', 12);
      c.save();
      c.strokeStyle = 'rgba(148,212,246,.24)';
      c.lineWidth = 1.25;
      c.shadowColor = 'rgba(93,68,150,.26)';
      c.shadowBlur = 8;
      c.shadowOffsetY = 4;
      polyPath(c, ART_OPENING);
      c.stroke();
      c.restore();

      const artBottomEdge = [[67,1025],[132,1075],[203,1075],[236,1098],[850,1098],[883,1075],[954,1075],[1017,1025]];
      c.save();
      c.beginPath();
      artBottomEdge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.strokeStyle = 'rgba(68,48,112,.38)';
      c.lineWidth = 13;
      c.shadowColor = 'rgba(48,30,88,.60)';
      c.shadowBlur = 20;
      c.shadowOffsetY = 11;
      c.stroke();
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      c.save();
      c.translate(0, 3);
      c.strokeStyle = 'rgba(42,28,78,.46)';
      c.lineWidth = 6;
      c.stroke();
      c.restore();
      const bottomLip = c.createLinearGradient(132, 0, 954, 0);
      bottomLip.addColorStop(0, 'rgba(218,244,255,.88)');
      bottomLip.addColorStop(0.3, 'rgba(230,198,255,.88)');
      bottomLip.addColorStop(0.58, 'rgba(174,236,255,.92)');
      bottomLip.addColorStop(0.82, 'rgba(214,255,230,.88)');
      bottomLip.addColorStop(1, 'rgba(255,232,202,.86)');
      c.strokeStyle = bottomLip;
      c.lineWidth = 3.5;
      c.stroke();
      c.save();
      c.translate(0, -1.5);
      c.strokeStyle = 'rgba(255,255,255,.66)';
      c.lineWidth = 1.25;
      c.stroke();
      c.restore();
      c.restore();
    }

    function punchArtWindow(c) {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      polyPath(c, ART_OPENING);
      c.fillStyle = '#000';
      c.fill();
      c.restore();
    }

    // ─── Master draw ────────────────────────────────────────────────

    function drawFrame(c, t, config, shine) {
      shineX = shine?.x ?? 0.5;
      shineY = shine?.y ?? 0.5;
      const foil = config.foil;
      const glow = config.glow;
      const clip = [[54,0],[1032,0],[1086,54],[1086,1394],[1032,1448],[54,1448],[0,1394],[0,54]];
      c.save();
      polyPath(c, clip);
      c.clip();

      drawPremiumBody(c, t, foil, glow);
      if (frameImage) c.drawImage(frameImage, 0, 0, HOLO_WIDTH, HOLO_HEIGHT);

      if (frameOverlay)     c.drawImage(frameOverlay, 0, 0, HOLO_WIDTH, HOLO_HEIGHT);
      else if (frameImage)  c.drawImage(frameImage,   0, 0, HOLO_WIDTH, HOLO_HEIGHT);

      drawFrameShell(c, t, foil, glow);
      drawHoloHeader(c, foil, glow);
      drawInfoModule(c, t, config, shine);

      punchArtWindow(c);
      drawArtWindowBevel(c);

      c.restore(); // card clip
    }


// ─── Image loading ───────────────────────────────────────────────

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
        img.onload  = () => resolve(img);
        img.onerror = reject;
        img.src     = src;
      });
    }

    function releaseAvatar() {
      gifToken += 1;
      if (gifTimer) clearTimeout(gifTimer);
      gifTimer = 0;
      if (gifDecoder) gifDecoder.close();
      gifDecoder = null;
      if (avatar && avatar.dataset && avatar.dataset.gifDecoder === 'true') avatar.remove();
      if (avatar && typeof avatar.close === 'function') avatar.close();
      avatar = null;
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      avatarObjectUrl = null;
    }

    function isAnimatedGifSource(url) {
      return isAnimatedGifUrl(url);
    }

    async function startGifPlayback(source) {
      if (!('ImageDecoder' in window)) return false;
      const buffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
      if (source instanceof File && source.type !== 'image/gif') return false;

      const token = gifToken;
      try {
        gifDecoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
        await gifDecoder.tracks.ready;
      } catch {
        if (gifDecoder) gifDecoder.close();
        gifDecoder = null;
        return false;
      }

      const track = gifDecoder.tracks.selectedTrack;
      if (!track || track.frameCount < 2) {
        gifDecoder.close();
        gifDecoder = null;
        return false;
      }
      let frameIndex = 0;

      const decodeNext = async () => {
        if (token !== gifToken || !gifDecoder) return;
        const { image } = await gifDecoder.decode({ frameIndex });
        if (token !== gifToken) { image.close(); return; }
        const previousFrame = avatar;
        avatar = image;
        if (frameIndex === 0) sampleArtworkTone(avatar);
        if (previousFrame && typeof previousFrame.close === 'function') previousFrame.close();
        frameIndex = (frameIndex + 1) % track.frameCount;
        const durationMs = Math.max(24, Math.min(1000, (image.duration || 100000) / 1000));
        gifTimer = window.setTimeout(() => {
          decodeNext().catch(error => console.error('GIF frame decode failed', error));
        }, durationMs);
      };

      await decodeNext();
      return true;
    }

    function mountPortraitImage(img, { animatedGif = false } = {}) {
      img.dataset.gifDecoder = 'true';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      if (typeof document !== 'undefined' && !img.isConnected) {
        document.body.appendChild(img);
      }
      if (animatedGif) {
        const w = Math.max(1, img.naturalWidth || img.width || 64);
        const h = Math.max(1, img.naturalHeight || img.height || 64);
        Object.assign(img.style, {
          position: 'fixed',
          left: '-99999px',
          top: '0',
          width: `${w}px`,
          height: `${h}px`,
          opacity: '1',
          visibility: 'visible',
          pointerEvents: 'none',
          zIndex: '-1',
        });
      } else {
        Object.assign(img.style, {
          position: 'fixed',
          width: '1px',
          height: '1px',
          left: '-4px',
          top: '-4px',
          opacity: '0.001',
          pointerEvents: 'none',
          zIndex: '-1',
        });
      }
    }

    function loadGifPortraitImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => {
          mountPortraitImage(img, { animatedGif: true });
          resolve(img);
        };
        img.onerror = () => {
          img.remove();
          reject(new Error('GIF could not be loaded'));
        };
        img.src = src;
      });
    }

    function loadAvatarImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
        img.onload = () => {
          mountPortraitImage(img, { animatedGif: false });
          resolve(img);
        };
        img.onerror = () => {
          img.remove();
          reject(new Error('Image could not be loaded'));
        };
        img.src = src;
      });
    }

   

  async function loadAvatarFromFile(file) {
    if (!file) return;
    releaseAvatar();
    if (file.type === 'image/gif') {
      const gifStarted = await startGifPlayback(file);
      if (!gifStarted) {
        avatarObjectUrl = URL.createObjectURL(file);
        avatar = await loadGifPortraitImage(avatarObjectUrl);
        sampleArtworkTone(avatar);
      }
      return;
    }
    avatarObjectUrl = URL.createObjectURL(file);
    avatar = await loadAvatarImage(avatarObjectUrl);
  }

  async function loadAvatarFromUrl(url) {
    if (!url) return;
    releaseAvatar();
    if (isAnimatedGifSource(url)) {
      avatar = await loadGifPortraitImage(url);
      sampleArtworkTone(avatar);
      return;
    }
    avatar = await loadAvatarImage(url);
  }

  function setAvatarImage(img) {
    releaseAvatar();
    avatar = img;
  }

  function render(ctx, configInput, shine = { x: 0.5, y: 0.5 }, { scale = 1 } = {}) {
    const config = normalizeHoloConfig(configInput);
    const t = (performance.now() - startedAt) / 1000;
    ctx.save();
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.clearRect(0, 0, HOLO_WIDTH, HOLO_HEIGHT);
    drawFrame(ctx, t, config, shine);
    ctx.restore();
  }

  async function ensureFrame() {
    if (frameImage) return frameImage;
    if (!frameReady) {
      frameReady = loadImage(frameSrc).then((img) => {
        frameImage = normalizeBlackLabelFrame(img);
        frameOverlay = buildFrameOverlay(frameImage);
        return frameImage;
      }).catch(() => {
        frameImage = null;
        frameOverlay = null;
        return null;
      });
    }
    return frameReady;
  }

  return {
    ensureFrame,
    render,
    releaseAvatar,
    loadAvatarFromFile,
    loadAvatarFromUrl,
    setAvatarImage,
    getAvatar: () => avatar,
  };
}
