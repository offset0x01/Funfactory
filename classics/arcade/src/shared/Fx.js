/**
 * Effetti condivisi tra i giochi (come in game_shared.py):
 *   * Particles      scintille, detriti, coriandoli (quadratini che si rimpiccioliscono)
 *   * FloatingTexts  "+10" che salgono e svaniscono
 *   * ScreenShake    tremolio dello schermo basato sul "trauma"
 */
import { PixelText } from './PixelText.js';
import { NEON_YELLOW, BLACK } from '../core/palette.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

export class Particles {
  constructor(scene, depth = 40, maxParticles = 600) {
    this.g = scene.add.graphics().setDepth(depth);
    this.items = [];
    this.max = maxParticles;
  }

  /**
   * Emette `count` particelle da (x, y).
   * @param {number|number[]} color un colore o una lista tra cui scegliere a caso
   */
  burst(x, y, color, count = 14, {
    speed = [60, 240], life = [0.3, 0.8], size = [2, 4], gravity = 0, angle = 0, spread = Math.PI * 2,
  } = {}) {
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = angle + rand(-spread / 2, spread / 2);
      const v = rand(speed[0], speed[1]);
      const lt = rand(life[0], life[1]);
      this.items.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: lt, max: lt,
        color: colors[Math.floor(Math.random() * colors.length)], size: randInt(size[0], size[1]), gravity,
      });
    }
  }

  update(dt) {
    const alive = [];
    for (const p of this.items) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      alive.push(p);
    }
    this.items = alive;
  }

  draw() {
    const g = this.g;
    g.clear();
    for (const p of this.items) {
      const s = Math.max(1, Math.round(p.size * (p.life / p.max)));
      g.fillStyle(p.color, 1);
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  }

  clear() { this.items = []; this.g.clear(); }
  get length() { return this.items.length; }
}

export class FloatingTexts {
  constructor(scene, depth = 45) {
    this.scene = scene;
    this.depth = depth;
    this.items = [];
  }

  add(text, x, y, color = NEON_YELLOW, life = 0.8, scale = 2) {
    const t = new PixelText(this.scene, Math.round(x), Math.round(y), text,
      { scale, color, shadow: BLACK, anchor: 'center' }).setDepth(this.depth);
    this.items.push({ t, y, life, max: life });
  }

  update(dt) {
    for (const item of this.items) {
      item.y -= 40 * dt;
      item.life -= dt;
      item.t.setY(Math.round(item.y));
      item.t.setAlpha(Math.min(1, (item.life / item.max) * 1.5));
    }
    this.items = this.items.filter((i) => {
      if (i.life > 0) return true;
      i.t.destroy();
      return false;
    });
  }

  draw() { /* le immagini si disegnano da sole */ }

  clear() { this.items.forEach((i) => i.t.destroy()); this.items = []; }
}

/** Tremolio dello schermo: `add(0.4)` a ogni impatto, il trauma cala da solo. */
export class ScreenShake {
  constructor(camera, maxOffset = 9) {
    this.camera = camera;
    this.trauma = 0;
    this.maxOffset = maxOffset;
  }

  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    if (this.trauma <= 0.01) { this.camera.setScroll(0, 0); return; }
    const mag = this.maxOffset * this.trauma * this.trauma;
    this.camera.setScroll(Math.round(rand(-mag, mag)), Math.round(rand(-mag, mag)));
  }

  reset() { this.trauma = 0; this.camera.setScroll(0, 0); }
}
