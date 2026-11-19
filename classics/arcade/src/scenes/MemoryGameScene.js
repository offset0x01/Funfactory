/**
 * Memory Game — trova tutte le coppie con meno mosse possibili.
 * Porting di memory_game.py.
 *
 * * Tre griglie: 4x3 (6 coppie), 6x3 (9 coppie), 6x4 (12 coppie)
 * * 12 icone disegnate a mano in pixel-art, ognuna con il suo colore
 * * vero "flip" della carta (ruota sull'asse verticale)
 * * si gioca con mouse, touch *oppure* tastiera (frecce + INVIO)
 * * una mossa = un tentativo (due carte); record salvato per ogni griglia
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { SYS } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import { Stopwatch } from '../core/util.js';
import { SIZES, ICONS, HUD_H, FLIP_SPEED, MISMATCH_DELAY, deal } from '../logic/memory.js';
import {
  W, WHITE, BLACK, NEON_GREEN, NEON_RED, NEON_MAGENTA, NEON_YELLOW, NEON_CYAN, fromRgb, lerpColor, css,
} from '../core/palette.js';

const BACK = fromRgb(60, 30, 110);
const STRIPE = fromRgb(85, 45, 150);

/** Texture di un'icona 7x7 con ombra (come icon_surface in Python). */
function iconTexture(scene, name, scale) {
  const key = `__mem_${name}_${scale}`;
  if (scene.textures.exists(key)) return key;
  const [art, color] = ICONS[name];
  const c = document.createElement('canvas');
  const depth = Math.max(1, Math.floor(scale / 4));
  c.width = 7 * scale + depth; c.height = 7 * scale + depth;
  const ctx = c.getContext('2d');
  for (const [col, off] of [[lerpColor(color, BLACK, 0.55), depth], [color, 0]]) {
    ctx.fillStyle = css(col);
    art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x * scale + off, y * scale + off, scale, scale); }));
  }
  scene.textures.addCanvas(key, c);
  return key;
}

export default class MemoryGameScene extends ArcadeScene {
  constructor() { super('MemoryGameScene'); }

  touchLayout() { return { system: [SYS.pause(), SYS.restart()] }; }

  async setup() {
    const choice = await this.selectMenu('MEMORY', SIZES.map((s) => s.label), ['Pick a grid size'], 1);
    if (choice === null) return;
    this.size = SIZES[choice];
    this.recordKey = `memory_moves_${this.size.key}`;
    this.gCards = this.add.graphics().setDepth(1);
    this.gOver = this.add.graphics().setDepth(3);
    this.txtMoves = ptext(this, 14, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtTime = ptext(this, 200, HUD_H / 2, '', 2, NEON_GREEN, 'midleft').setDepth(10);
    this.txtPairs = ptext(this, 390, HUD_H / 2, '', 2, NEON_MAGENTA, 'midleft').setDepth(10);
    this.txtBest = ptext(this, W - 14, HUD_H / 2, '', 2, NEON_YELLOW, 'midright').setDepth(10);
    this.cardObjs = null;   // quelli della partita precedente sono già stati distrutti con la scena
    this.newGame();
  }

  newGame() {
    this.cardObjs?.forEach(({ icon, mark }) => { icon.destroy(); mark.destroy(); });
    this.cards = deal(this.size);
    this.selected = [];
    this.moves = 0;
    this.streak = 0;
    this.mismatchTimer = 0;
    this.cursor = 0;
    this.timer = new Stopwatch();
    this.timer.running = false;
    this.best = getBest(this.store, this.recordKey);
    this.won = 0;
    this.cardObjs = this.cards.map((card) => {
      const scale = Math.max(2, Math.floor(card.rect.w / 11));
      const cx = card.rect.x + card.rect.w / 2, cy = card.rect.y + card.rect.h / 2;
      return {
        icon: this.add.image(cx, cy, iconTexture(this, card.icon, scale)).setDepth(2),
        mark: ptext(this, cx, cy, '?', Math.max(2, Math.floor(card.rect.w / 28)), NEON_MAGENTA, 'center').setDepth(2),
      };
    });
  }

  flipCard(index) {
    if (this.mismatchTimer > 0 || this.selected.length >= 2) return;
    const card = this.cards[index];
    if (card.faceUp || card.matched) return;
    card.faceUp = true;
    this.selected.push(card);
    this.timer.running = true;
    Audio.play('flip');
    if (this.selected.length < 2) return;
    this.moves += 1;
    const [a, b] = this.selected;
    if (a.icon === b.icon) {
      a.matched = b.matched = true;
      a.glow = b.glow = 0.6;
      this.selected = [];
      this.streak += 1;
      Audio.play('match');
      for (const c of [a, b]) {
        this.particles.burst(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2, [ICONS[c.icon][1], WHITE], 16,
          { speed: [60, 220], life: [0.3, 0.7] });
      }
      if (this.streak >= 2) this.popups.add(`COMBO X${this.streak}!`, b.rect.x + b.rect.w / 2, b.rect.y, NEON_YELLOW, 0.9);
    } else {
      this.mismatchTimer = MISMATCH_DELAY;
      a.wrong = b.wrong = true;
      this.streak = 0;
    }
  }

  onKey(e) {
    const n = this.cards.length, cols = this.size.cols;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': this.cursor = (this.cursor - 1 + n) % n; break;
      case 'ArrowRight': case 'KeyD': this.cursor = (this.cursor + 1) % n; break;
      case 'ArrowUp': case 'KeyW': this.cursor = (this.cursor - cols + n) % n; break;
      case 'ArrowDown': case 'KeyS': this.cursor = (this.cursor + cols) % n; break;
      case 'Enter': case 'NumpadEnter': case 'Space': if (!e.repeat) this.flipCard(this.cursor); break;
      default: break;
    }
  }

  cardAt(p) {
    return this.cards.findIndex(({ rect: r }) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  }

  onPointerMove(p) { const i = this.cardAt(p); if (i >= 0) this.cursor = i; }
  onPointerDown(p) { const i = this.cardAt(p); if (i >= 0) { this.cursor = i; this.flipCard(i); } }

  tick(dt) {
    for (const card of this.cards) {   // animazioni e pausa dopo un errore
      const target = card.faceUp || card.matched ? 1 : 0;
      if (card.flip < target) card.flip = Math.min(target, card.flip + FLIP_SPEED * dt);
      else if (card.flip > target) card.flip = Math.max(target, card.flip - FLIP_SPEED * dt);
      card.glow = Math.max(0, card.glow - dt);
    }
    if (this.mismatchTimer > 0) {
      this.mismatchTimer -= dt;
      if (this.mismatchTimer <= 0) {
        for (const card of this.selected) { card.faceUp = false; card.wrong = false; }
        this.selected = [];
        Audio.play('error', 0.5);
      }
    }
    this.timer.update(dt);
    if (this.won > 0) {
      this.won -= dt;
      if (this.won <= 0) this.finish();
    } else if (this.cards.every((c) => c.matched && c.flip >= 1)) {
      this.timer.stop();
      this.won = 0.5;
    }
  }

  finish() {
    const newRecord = recordBest(this.store, this.recordKey, this.moves, true);
    const best = getBest(this.store, this.recordKey, this.moves);
    this.endScreen('YOU WIN!', [
      `Moves: ${this.moves} (best possible: ${this.cards.length / 2})   Time: ${this.timer}`,
      `Record (${this.size.label.split(' ')[0].toLowerCase()}): ${best} moves`,
    ], { newRecord, win: true });
  }

  drawBackStripes(g, x, y, w, h, step) {
    g.lineStyle(3, STRIPE, 1);
    for (let k = -h; k < w; k += step) {
      const x0 = x + k;
      const s0 = Math.max(0, x - x0), s1 = Math.min(h, x + w - x0);   // ritaglio dentro la carta
      if (s1 > s0) g.lineBetween(x0 + s0, y + s0, x0 + s1, y + s1);
    }
  }

  draw() {
    const g = this.gCards, o = this.gOver;
    g.clear(); o.clear();
    this.cards.forEach((card, i) => {
      const r = card.rect;
      const { icon, mark } = this.cardObjs[i];
      const width = Math.max(2, Math.round(r.w * Math.abs(Math.cos(card.flip * Math.PI))));
      const face = card.flip > 0.5;
      const bx = r.x + (r.w - width) / 2;
      const rad = Math.min(10, width / 2);
      g.fillStyle(fromRgb(4, 2, 12), 1); g.fillRoundedRect(bx + 4, r.y + 5, width, r.h, rad);
      if (face) {
        const border = card.matched ? NEON_GREEN : (card.wrong ? NEON_RED : fromRgb(90, 90, 130));
        g.fillStyle(fromRgb(232, 232, 244), 1); g.fillRoundedRect(bx, r.y, width, r.h, rad);
        g.lineStyle(3, border, 1); g.strokeRoundedRect(bx + 1.5, r.y + 1.5, width - 3, r.h - 3, rad);
        icon.setVisible(true);
        icon.setScale(Math.min(1, Math.max(0.01, (width - 4) / icon.frame.width)), 1);
        mark.setVisible(false);
        if (card.matched) { o.fillStyle(fromRgb(10, 40, 20), 70 / 255); o.fillRoundedRect(bx, r.y, width, r.h, rad); }
      } else {
        g.fillStyle(BACK, 1); g.fillRoundedRect(bx, r.y, width, r.h, rad);
        const iw = width - 12, ih = r.h - 12;
        if (iw > 4) {
          this.drawBackStripes(g, bx + 6, r.y + 6, iw, ih, 12);
          const cw = iw - r.w / 2.2, ch = ih - r.h / 2.2;
          if (cw > 0) { g.fillStyle(BACK, 1); g.fillRoundedRect(bx + (width - cw) / 2, r.y + (r.h - ch) / 2, cw, ch, Math.min(6, cw / 2)); }
        }
        g.lineStyle(2, NEON_MAGENTA, 1); g.strokeRoundedRect(bx + 1, r.y + 1, width - 2, r.h - 2, rad);
        icon.setVisible(false);
        mark.setVisible(iw > r.w / 2);
      }
      if (card.glow > 0) {
        o.lineStyle(4, NEON_GREEN, (160 * card.glow) / 255);
        o.strokeRoundedRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20, 14);
      }
      if (i === this.cursor) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
        o.lineStyle(3, lerpColor(NEON_YELLOW, WHITE, pulse), 1);
        o.strokeRoundedRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 13);
      }
    });
    const total = this.cards.length / 2;
    const done = this.cards.filter((c) => c.matched).length / 2;
    this.txtMoves.setText(`MOVES ${this.moves}`);
    this.txtTime.setText(`TIME ${this.timer}`);
    this.txtPairs.setText(`PAIRS ${done}/${total}`);
    this.txtBest.setText(`RECORD ${this.best || '--'}`);
  }
}
