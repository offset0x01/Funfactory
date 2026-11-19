/**
 * Snake — mangia, cresci, non morderti la coda. Porting di snake.py.
 *
 * Le regole stanno in src/logic/snake.js (testate); qui c'è solo grafica,
 * input ed effetti: corpo continuo con sfumatura e occhi che guardano dove
 * va il serpente, frutto bonus che lampeggia prima di sparire con la sua
 * barra del tempo, particelle, testi a comparsa, screen shake alla morte.
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { drawPanel } from '../shared/Draw.js';
import { SYS, pick } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import {
  SnakeLogic, GRID, HUD_H, COLS, ROWS, BONUS_LIFETIME, RED_POINTS, BLUE_POINTS,
} from '../logic/snake.js';
import {
  W, H, WHITE, BLACK, TEXT_DIM, NEON_GREEN, NEON_RED, NEON_BLUE, NEON_CYAN, NEON_YELLOW, NEON_ORANGE,
  fromRgb, lerpColor,
} from '../core/palette.js';

const DIRECTIONS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

const cellX = (c) => c[0] * GRID;
const cellY = (c) => HUD_H + c[1] * GRID;

export default class SnakeScene extends ArcadeScene {
  constructor() { super('SnakeScene'); }

  touchLayout() {
    return {
      system: [SYS.pause(), SYS.restart()],
      dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', mode: 'tap' },
      gestures: { swipe: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, step: 26 },
    };
  }

  setup() {
    // campo a scacchiera, disegnato una volta sola in una texture
    const key = '__snake_field';
    if (!this.textures.exists(key)) {
      const c = document.createElement('canvas');
      c.width = COLS * GRID; c.height = ROWS * GRID;
      const ctx = c.getContext('2d');
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#101224' : '#14162a';
          ctx.fillRect(x * GRID, y * GRID, GRID, GRID);
        }
      }
      this.textures.addCanvas(key, c);
    }
    this.add.image(0, HUD_H, key).setOrigin(0, 0).setDepth(0);
    const frame = this.add.graphics().setDepth(1);
    frame.lineStyle(2, NEON_GREEN, 1);
    frame.strokeRect(1, HUD_H - 1, W - 2, H - HUD_H);

    this.gFood = this.add.graphics().setDepth(2);
    this.gSnake = this.add.graphics().setDepth(3);
    this.gHud = this.add.graphics().setDepth(10);
    this.txtScore = ptext(this, 12, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtBest = ptext(this, W / 2, HUD_H / 2, '', 2, NEON_YELLOW, 'center').setDepth(10);
    this.txtLen = ptext(this, W - 12, HUD_H / 2, '', 2, NEON_GREEN, 'midright').setDepth(10);
    this.gStart = this.add.graphics().setDepth(20);
    this.txtStart1 = ptext(this, W / 2, H / 2 + 50, 'PRESS AN ARROW', 3, WHITE, 'center').setDepth(21);
    this.txtStart2 = ptext(this, W / 2, H / 2 + 78, 'TO START', 2, TEXT_DIM, 'center').setDepth(21);
    this.newGame();
  }

  newGame() {
    this.logic = new SnakeLogic();
    this.best = getBest(this.store, 'snake', 0) || 0;
    this.dying = 0;
    this.flash = false;
  }

  saveOnExit() { recordBest(this.store, 'snake', this.logic?.score || 0); }

  onKey(e) {
    const d = DIRECTIONS[e.code];
    if (d && this.logic.alive) this.logic.turn(d);
  }

  tick(dt) {
    const game = this.logic;
    if (this.dying > 0) {   // breve animazione di morte prima dei risultati
      this.dying -= dt;
      this.flash = Math.floor(this.dying * 10) % 2 === 0;
      if (this.dying <= 0) this.finish();
      return;
    }
    game.update(dt);
    for (const [kind, cell] of game.popEvents()) {
      const cx = cellX(cell) + GRID / 2, cy = cellY(cell) + GRID / 2;
      if (kind === 'eat') {
        Audio.play('eat');
        this.particles.burst(cx, cy, [NEON_RED, NEON_ORANGE, NEON_YELLOW], 14, { speed: [60, 200], life: [0.25, 0.6] });
        this.popups.add(`+${RED_POINTS}`, cx, cy - 10, NEON_YELLOW);
      } else if (kind === 'bonus') {
        Audio.play('bonus');
        this.particles.burst(cx, cy, [NEON_BLUE, NEON_CYAN, WHITE], 24, { speed: [80, 260], life: [0.3, 0.8] });
        this.popups.add(`+${BLUE_POINTS}`, cx, cy - 10, NEON_CYAN, 1, 3);
      } else if (kind === 'die') {
        Audio.play('hurt');
        this.shake.add(0.7);
        game.body.filter((_, i) => i % 2 === 0).forEach((seg) => {
          this.particles.burst(cellX(seg) + GRID / 2, cellY(seg) + GRID / 2, [NEON_GREEN, WHITE], 5,
            { speed: [40, 180], life: [0.4, 0.9] });
        });
        this.dying = 0.75;
      }
    }
  }

  finish() {
    const game = this.logic;
    const newRecord = recordBest(this.store, 'snake', game.score);
    this.best = Math.max(this.best, game.score);
    this.endScreen('GAME OVER', [
      `Score: ${game.score}   Length: ${game.body.length}`,
      `Record: ${this.best}`,
    ], { newRecord });
  }

  drawFood(g, cell, color, visible = true) {
    if (!visible) return;
    const cx = cellX(cell) + GRID / 2, cy = cellY(cell) + GRID / 2;
    const r = GRID / 2 - 2 + Math.round(1.5 * Math.sin(this.t * 6));
    g.fillStyle(color, 60 / 255); g.fillCircle(cx, cy, GRID - 2);
    g.fillStyle(color, 1); g.fillCircle(cx, cy, r);
    g.fillStyle(lerpColor(color, WHITE, 0.6), 1); g.fillCircle(cx - 3, cy - 3, 2);
    g.lineStyle(2, fromRgb(90, 200, 90), 1); g.lineBetween(cx, cy - GRID / 2 + 2, cx + 3, cy - GRID / 2 - 2);
  }

  draw() {
    const game = this.logic;
    const t = this.t;
    // cibo
    const f = this.gFood;
    f.clear();
    this.drawFood(f, game.red, NEON_RED);
    if (game.blue) {
      const blinking = game.blueTimer < 2 && Math.floor(t * 8) % 2 === 0;
      this.drawFood(f, game.blue, NEON_BLUE, !blinking);
    }
    // serpente: corpo continuo con sfumatura, occhi sulla testa
    const g = this.gSnake;
    g.clear();
    const n = game.body.length;
    for (let i = n - 1; i >= 0; i--) {
      const seg = game.body[i];
      const color = this.flash
        ? (Math.floor(i / 2) % 2 === 0 ? WHITE : NEON_RED)
        : lerpColor(fromRgb(120, 255, 140), fromRgb(20, 120, 60), i / Math.max(1, n - 1));
      const x = cellX(seg), y = cellY(seg);
      g.fillStyle(color, 1);
      if (i < n - 1) {   // ponte verso il segmento precedente -> corpo continuo
        const nx = cellX(game.body[i + 1]), ny = cellY(game.body[i + 1]);
        const minX = Math.min(x, nx) + 3, minY = Math.min(y, ny) + 3;
        g.fillRect(minX, minY, Math.abs(x - nx) + GRID - 6, Math.abs(y - ny) + GRID - 6);
      }
      const inset = i < n - 1 ? 1 : 3;
      g.fillRoundedRect(x + inset, y + inset, GRID - 2 * inset, GRID - 2 * inset, 7);
      if (i % 3 === 1 && !this.flash) {
        g.fillStyle(lerpColor(color, WHITE, 0.25), 1);
        g.fillCircle(x + GRID / 2, y + GRID / 2, 2);
      }
    }
    const [hx, hy] = [cellX(game.body[0]) + GRID / 2, cellY(game.body[0]) + GRID / 2];
    const [dx, dy] = game.direction;
    for (const side of [-1, 1]) {
      const ex = hx + dx * 4 + -dy * side * 5, ey = hy + dy * 4 + dx * side * 5;
      g.fillStyle(WHITE, 1); g.fillCircle(ex, ey, 3);
      g.fillStyle(BLACK, 1); g.fillCircle(ex + dx, ey + dy, 1);
    }
    // HUD
    this.txtScore.setText(`SCORE ${game.score}`);
    this.txtBest.setText(`RECORD ${Math.max(this.best, game.score)}`);
    this.txtLen.setText(`LENGTH ${n}`);
    const hud = this.gHud;
    hud.clear();
    if (game.blue) {
      hud.fillStyle(NEON_BLUE, 1);
      hud.fillRect(W / 2 - 60, HUD_H - 7, Math.round(120 * Math.max(0, game.blueTimer) / BONUS_LIFETIME), 3);
    }
    // "premi una freccia"
    const waiting = !game.started;
    this.gStart.clear();
    if (waiting) drawPanel(this.gStart, W / 2 - 230, H / 2 + 25, 460, 70, NEON_GREEN, 200 / 255);
    this.txtStart1.setText(pick('PRESS AN ARROW', 'TAP THE D-PAD')).setVisible(waiting);
    this.txtStart2.setText(pick('TO START', 'OR SWIPE TO START')).setVisible(waiting);
  }
}
