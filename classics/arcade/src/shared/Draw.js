/**
 * Piccoli helper di disegno su Phaser.Graphics, condivisi da launcher e giochi.
 */
import { PANEL_BG } from '../core/palette.js';

/**
 * Pannello scuro traslucido con bordo neon (come draw_panel in Python):
 * alone esterno semitrasparente + bordo pieno interno.
 */
export function drawPanel(g, x, y, w, h, border, fillAlpha = 225 / 255, radius = 12) {
  const r = Math.min(radius, w / 2, h / 2);
  g.fillStyle(PANEL_BG, fillAlpha);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(6, border, 90 / 255);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 3));
  g.lineStyle(2, border, 1);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 3));
}

/** Rettangolo arrotondato "luminoso": anelli concentrici sempre più tenui. */
export function drawGlowRect(g, x, y, w, h, color, alpha = 0.25, rings = 6, step = 3, radius = 12) {
  for (let k = rings; k >= 1; k--) {
    const a = alpha * (1 - (k - 1) / rings);
    g.fillStyle(color, a / rings * 2);
    g.fillRoundedRect(x - k * step, y - k * step, w + 2 * k * step, h + 2 * k * step, radius + k * step);
  }
}

/** Linea spessa con alone (due passate: larga e tenue, poi stretta e piena). */
export function glowLine(g, x1, y1, x2, y2, color, width = 6, glowWidth = 16, glowAlpha = 0.25, core = null) {
  g.lineStyle(glowWidth, color, glowAlpha);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(width, core ?? color, 1);
  g.lineBetween(x1, y1, x2, y2);
}

/** Disegna una bitmap ('#' = pixel acceso) su un Graphics. */
export function drawBitmap(g, art, x, y, scale, color, alpha = 1) {
  g.fillStyle(color, alpha);
  for (let ry = 0; ry < art.length; ry++) {
    const row = art[ry];
    let start = -1;
    for (let rx = 0; rx <= row.length; rx++) {
      const on = rx < row.length && row[rx] === '#';
      if (on && start < 0) start = rx;
      if (!on && start >= 0) {
        g.fillRect(x + start * scale, y + ry * scale, (rx - start) * scale, scale);
        start = -1;
      }
    }
  }
}

/** Crea (una volta) una texture da una bitmap: ottima per sprite usati molte volte. */
export function bitmapTexture(scene, key, art, color, scale) {
  if (scene.textures.exists(key)) return key;
  const w = art[0].length * scale;
  const h = art.length * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  scene.textures.addCanvas(key, canvas);
  return key;
}
