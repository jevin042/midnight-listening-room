// Procedural canvas textures — no external assets needed.
import * as THREE from 'three';
import { cleanTitle, thumbUrl } from './data.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16; // keeps cover text sharp at oblique shelf angles
  return t;
}

/* Dark walnut wood grain */
export function woodTexture(w = 512, h = 512, base = '#2b1d12') {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * h;
    const alpha = 0.03 + Math.random() * 0.09;
    const light = Math.random() > 0.5;
    ctx.strokeStyle = light ? `rgba(120,84,50,${alpha})` : `rgba(8,5,3,${alpha + 0.02})`;
    ctx.lineWidth = 0.5 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    for (let x = 0; x <= w + 20; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (Math.random() - 0.5) * 2.5);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 14 + Math.random() * 12);
    g.addColorStop(0, 'rgba(10,6,3,0.5)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Soft round particle sprite */
export function dustSprite(size = 64) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,244,220,1)');
  g.addColorStop(0.4, 'rgba(255,244,220,0.35)');
  g.addColorStop(1, 'rgba(255,244,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: false });
}

const PALETTE = ['#d8a84e', '#b9563f', '#5f7a8f', '#7a6a8f', '#5f8f6e', '#8f5f5f'];
export const accentFor = (i) => PALETTE[i % PALETTE.length];

/* ------------------------------------------------------------------ */
/* Vinyl record face — grooves + center label (thumbnail if given)     */
/* ------------------------------------------------------------------ */

function drawVinylFace(ctx, size, video, img, accent) {
  const cx = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0a0a0c';
  ctx.beginPath(); ctx.arc(cx, cx, cx, 0, Math.PI * 2); ctx.fill();
  // grooves
  for (let r = cx * 0.36; r < cx * 0.97; r += 2.2) {
    ctx.strokeStyle = `rgba(255,255,255,${(0.04 + 0.09 * Math.random()) * 0.18})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke();
  }
  // dead wax rings
  for (const rr of [0.355, 0.975]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cx, cx * rr, 0, Math.PI * 2); ctx.stroke();
  }
  // anisotropic sheen
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0.32, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.68, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath(); ctx.arc(cx, cx, cx, 0, Math.PI * 2); ctx.fill();

  // center label
  const lr = cx * 0.33;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cx, lr, 0, Math.PI * 2); ctx.clip();
  if (img) {
    // circle-cropped thumbnail, moody grade
    const s = Math.min(img.width, img.height);
    ctx.filter = 'saturate(0.85) brightness(0.9)';
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - lr, cx - lr, lr * 2, lr * 2);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(10,8,4,0.25)';
    ctx.fillRect(cx - lr, cx - lr, lr * 2, lr * 2);
  } else {
    ctx.fillStyle = '#171310';
    ctx.fillRect(cx - lr, cx - lr, lr * 2, lr * 2);
    ctx.fillStyle = accent || '#d8a84e';
    ctx.font = `500 ${size * 0.026}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('MIDNIGHT STUDIO', cx, cx - size * 0.012);
    ctx.fillStyle = 'rgba(216,168,78,0.55)';
    ctx.font = `300 ${size * 0.017}px Arial`;
    ctx.fillText('33 1/3 RPM · LISTENING ROOM', cx, cx + size * 0.026);
  }
  ctx.restore();
  ctx.strokeStyle = accent || '#d8a84e';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cx, lr, 0, Math.PI * 2); ctx.stroke();
  // spindle hole
  ctx.fillStyle = '#040404';
  ctx.beginPath(); ctx.arc(cx, cx, size * 0.011, 0, Math.PI * 2); ctx.fill();
}

const discCache = new Map();

/** Vinyl face texture for a song; repaints once its thumbnail loads. */
export function discFaceTexture(video, index = 0) {
  if (video && discCache.has(video.id)) return discCache.get(video.id);
  const size = 1024;
  const [c, ctx] = canvas(size, size);
  const accent = accentFor(index);
  drawVinylFace(ctx, size, video, null, accent);
  const tex = toTexture(c);
  if (video) {
    discCache.set(video.id, tex);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { drawVinylFace(ctx, size, video, img, accent); tex.needsUpdate = true; };
    img.src = thumbUrl(video.id);
  }
  return tex;
}

/* ------------------------------------------------------------------ */
/* Album sleeve cover                                                  */
/* ------------------------------------------------------------------ */

function drawSleeve(ctx, S, video, img, accent) {
  // card base
  ctx.fillStyle = '#131315';
  ctx.fillRect(0, 0, S, S);

  const pad = S * 0.06;
  const artY = pad, artH = S * 0.66;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, artY, S - pad * 2, artH);
  ctx.clip();
  if (img) {
    const ar = img.width / img.height;
    const target = (S - pad * 2) / artH;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (ar > target) { sw = img.height * target; sx = (img.width - sw) / 2; }
    else { sh = img.width / target; sy = (img.height - sh) / 2; }
    ctx.filter = 'saturate(1.05) brightness(1.16) contrast(1.06)';
    ctx.drawImage(img, sx, sy, sw, sh, pad, artY, S - pad * 2, artH);
    ctx.filter = 'none';
    // bottom fade into card
    const fade = ctx.createLinearGradient(0, artY + artH * 0.55, 0, artY + artH);
    fade.addColorStop(0, 'rgba(19,19,21,0)');
    fade.addColorStop(1, 'rgba(19,19,21,0.9)');
    ctx.fillStyle = fade;
    ctx.fillRect(pad, artY, S - pad * 2, artH);
  } else {
    const g = ctx.createLinearGradient(pad, artY, S - pad, artY + artH);
    g.addColorStop(0, '#1d1a16');
    g.addColorStop(1, accent + '44');
    ctx.fillStyle = g;
    ctx.fillRect(pad, artY, S - pad * 2, artH);
    ctx.fillStyle = accent + 'bb';
    ctx.font = `200 ${artH * 0.5}px Georgia`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((cleanTitle(video.title)[0] || 'M').toUpperCase(), S / 2, artY + artH / 2);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // vinyl peeking out the top-right of the art (subtle depth cue)
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, artY, S - pad * 2, artH);
  ctx.clip();
  ctx.fillStyle = 'rgba(8,8,10,0.85)';
  ctx.beginPath(); ctx.arc(S * 0.82, artY + artH * 0.16, S * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (const rr of [0.1, 0.12, 0.14]) {
    ctx.beginPath(); ctx.arc(S * 0.82, artY + artH * 0.16, S * rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(pad, artY + artH + S * 0.045, S * 0.12, S * 0.008);

  // title
  const title = cleanTitle(video.title).toUpperCase();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  let fs = S * 0.072;
  ctx.font = `700 ${fs}px Arial`;
  let line1 = title, line2 = '';
  if (ctx.measureText(title).width > S - pad * 2) {
    const words = title.split(' ');
    line1 = ''; line2 = '';
    for (const w of words) {
      if (!line2 && ctx.measureText(line1 + ' ' + w).width < S - pad * 2) {
        line1 = (line1 + ' ' + w).trim();
      } else {
        line2 = (line2 + ' ' + w).trim();
      }
    }
    while (ctx.measureText(line2).width > S - pad * 2 && line2.length > 6) line2 = line2.slice(0, -2);
    if (line2.length && line2 !== title.slice(line1.length + 1)) {
      // ellipsize if truncated
      const rest = title.slice(line1.length + 1);
      if (line2 !== rest) line2 = line2.trimEnd() + '…';
    }
  }
  const ty = artY + artH + S * 0.115;
  ctx.fillText(line1, pad, ty);
  if (line2) ctx.fillText(line2, pad, ty + fs * 1.25);

  // footer
  ctx.fillStyle = accent;
  ctx.font = `400 ${S * 0.028}px Arial`;
  ctx.fillText('MIDNIGHT STUDIO', pad, S - pad * 0.7);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(232,228,218,0.4)';
  ctx.fillText('33 1/3', S - pad, S - pad * 0.7);

  // edge shading
  const edge = ctx.createLinearGradient(0, 0, S, 0);
  edge.addColorStop(0, 'rgba(255,255,255,0.06)');
  edge.addColorStop(0.06, 'rgba(255,255,255,0)');
  edge.addColorStop(0.94, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, S, S);
}

/** Sleeve cover texture; repaints once the thumbnail loads. */
export function sleeveTexture(video, index) {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const accent = accentFor(index);
  drawSleeve(ctx, S, video, null, accent);
  const tex = toTexture(c);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { drawSleeve(ctx, S, video, img, accent); tex.needsUpdate = true; };
  img.src = thumbUrl(video.id);
  return tex;
}

/** Sleeve spine (thin colored edge) */
export function spineTexture(index) {
  const [c, ctx] = canvas(64, 512);
  ctx.fillStyle = '#0f0f11';
  ctx.fillRect(0, 0, 64, 512);
  ctx.fillStyle = accentFor(index) + '99';
  ctx.fillRect(24, 40, 16, 432);
  return toTexture(c);
}
