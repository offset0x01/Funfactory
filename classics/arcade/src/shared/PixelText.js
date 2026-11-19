/**
 * Testo in pixel-art con il font bitmap 5x7 (src/core/pixelFont.js).
 *
 * Due modi di disegnarlo:
 *   * `PixelText` (consigliato): un'immagine Phaser con una texture generata
 *     su Canvas 2D. Supporta alone neon (glow) e ombra, funziona uguale con
 *     WebGL e con Canvas. Le texture sono in cache con contatore d'uso e
 *     politica LRU (come la cache da 256 voci della versione Python).
 *   * `gfxText()`: disegna i pixel direttamente su un Phaser.Graphics.
 *     Niente texture, niente glow: perfetto per le miniature animate.
 */
import Phaser from '../lib/phaser.esm.min.js';
import { measure, drawGlyphs } from '../core/pixelFont.js';
import { css, rgba, WHITE } from '../core/palette.js';

export const ANCHORS = {
  topleft: [0, 0], midtop: [0.5, 0], topright: [1, 0],
  midleft: [0, 0.5], center: [0.5, 0.5], midright: [1, 0.5],
  bottomleft: [0, 1], midbottom: [0.5, 1], bottomright: [1, 1],
};

const CACHE_MAX = 320;
const cache = new Map();   // chiave texture -> { refs, used }
let tick = 0;

function textureKey(text, s) {
  return `px|${s.scale}|${s.color}|${s.shadow ?? '-'}|${s.glow ? 1 : 0}|${text}`;
}

function buildCanvas(text, { scale, color, shadow, glow }) {
  const [w, h] = measure(text, scale);
  const pad = glow ? scale * 3 : (shadow != null ? scale : 0);
  const base = document.createElement('canvas');
  base.width = Math.max(1, w);
  base.height = Math.max(1, h);
  const bctx = base.getContext('2d');
  bctx.fillStyle = css(color);
  drawGlyphs(text, scale, (x, y, rw, rh) => bctx.fillRect(x, y, rw, rh));

  const out = document.createElement('canvas');
  out.width = base.width + pad * 2;
  out.height = base.height + pad * 2;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (glow) {
    // Alone neon: l'ombra sfocata del testo, disegnata due volte per intensità
    ctx.save();
    ctx.shadowColor = rgba(color, 0.9);
    ctx.shadowBlur = scale * 2.5;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(base, pad, pad);
    ctx.drawImage(base, pad, pad);
    ctx.restore();
  }
  if (shadow != null) {
    const sh = document.createElement('canvas');
    sh.width = base.width;
    sh.height = base.height;
    const sctx = sh.getContext('2d');
    sctx.fillStyle = css(shadow);
    drawGlyphs(text, scale, (x, y, rw, rh) => sctx.fillRect(x, y, rw, rh));
    ctx.drawImage(sh, pad + scale, pad + scale);
  }
  ctx.drawImage(base, pad, pad);
  return out;
}

function acquire(textures, key, text, style) {
  let entry = cache.get(key);
  if (entry && textures.exists(key)) {
    entry.refs += 1;
    entry.used = ++tick;
    return key;
  }
  textures.addCanvas(key, buildCanvas(text, style));
  // già "in uso" e "appena usata" PRIMA di fare pulizia: la texture appena
  // creata non deve mai essere scelta come la meno recente da eliminare
  entry = { refs: 1, used: ++tick };
  cache.set(key, entry);
  evict(textures);
  return key;
}

function release(key) {
  const entry = key && cache.get(key);
  if (entry) entry.refs = Math.max(0, entry.refs - 1);
}

function evict(textures) {
  if (cache.size <= CACHE_MAX) return;
  const idle = [...cache.entries()].filter(([, e]) => e.refs === 0).sort((a, b) => a[1].used - b[1].used);
  for (const [key] of idle) {
    if (cache.size <= CACHE_MAX * 0.8) break;
    cache.delete(key);
    try { textures.remove(key); } catch { /* già rimossa */ }
  }
}

/** Immagine con testo pixel-art. `setText()` costa zero se il testo non cambia. */
export class PixelText extends Phaser.GameObjects.Image {
  constructor(scene, x, y, text = '', style = {}) {
    super(scene, x, y, '__DEFAULT');
    this._style = { scale: 2, color: WHITE, shadow: null, glow: false, ...style };
    this._text = null;
    this._key = null;
    const [ox, oy] = ANCHORS[style.anchor || 'topleft'];
    this.setOrigin(ox, oy);
    this.setText(text);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => { release(this._key); this._key = null; });
  }

  get text() { return this._text; }

  setText(text) {
    text = String(text ?? '');
    if (text === this._text && this._key) return this;
    this._text = text;
    return this._refresh();
  }

  /** Cambia colore/scala/glow/ombra (solo le proprietà passate). */
  setStyle(style) {
    const next = { ...this._style, ...style };
    if (next.scale === this._style.scale && next.color === this._style.color
        && next.shadow === this._style.shadow && next.glow === this._style.glow) return this;
    this._style = next;
    return this._refresh();
  }

  setColor(color) { return this.setStyle({ color }); }

  setAnchor(anchor) { const [ox, oy] = ANCHORS[anchor]; return this.setOrigin(ox, oy); }

  _refresh() {
    const key = textureKey(this._text, this._style);
    if (key === this._key) return this;
    const old = this._key;
    this._key = acquire(this.scene.sys.textures, key, this._text, this._style);
    this.setTexture(key);
    this.setSizeToFrame();
    release(old);
    return this;
  }
}

/** Scorciatoia: crea un PixelText. */
export function ptext(scene, x, y, text, scale = 2, color = WHITE, anchor = 'topleft', extra = {}) {
  return new PixelText(scene, x, y, text, { scale, color, anchor, ...extra });
}

/** Disegna testo pixel-art su un Graphics (niente texture). */
export function gfxText(g, text, x, y, scale = 1, color = WHITE, anchor = 'topleft', alpha = 1) {
  const [w, h] = measure(text, scale);
  const [ox, oy] = ANCHORS[anchor];
  g.fillStyle(color, alpha);
  drawGlyphs(text, scale, (rx, ry, rw, rh) => g.fillRect(rx, ry, rw, rh),
    Math.round(x - w * ox), Math.round(y - h * oy));
}
