/**
 * Puzzle 15 — il classico gioco del quindici. Porting di puzzle15.py.
 *
 * * Sempre risolvibile (test di parità corretto, vedi src/logic/puzzle15.js)
 * * un clic su una tessera nella riga/colonna del buco fa scorrere tutta la fila
 * * le frecce spingono una tessera nel buco (si muove nella direzione della freccia)
 * * animazione fluida di ogni tessera
 * * le tessere al posto giusto si illuminano; colore in base alla riga di arrivo
 * * mosse e tempo migliori vengono salvati
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { SYS } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import { formatTime, Stopwatch } from '../core/util.js';
import { SIZE, shuffled, isSolved, slide, push } from '../logic/puzzle15.js';
import {
  W, H, BG, WHITE, BLACK, NEON_CYAN, NEON_MAGENTA, NEON_YELLOW, NEON_GREEN, fromRgb, lerpColor,
} from '../core/palette.js';

const HUD_H = 44;
const TILE = 110;
const GAP = 8;
const BOARD_PX = SIZE * TILE + (SIZE - 1) * GAP;
const OFF_X = (W - BOARD_PX) / 2;
const OFF_Y = HUD_H + (H - HUD_H - BOARD_PX) / 2;
const ROW_COLORS = [NEON_CYAN, NEON_MAGENTA, NEON_YELLOW, NEON_GREEN];
const ARROWS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

const tilePos = (i) => [OFF_X + (i % SIZE) * (TILE + GAP), OFF_Y + Math.floor(i / SIZE) * (TILE + GAP)];

export default class Puzzle15Scene extends ArcadeScene {
  constructor() { super('Puzzle15Scene'); }

  touchLayout() { return { system: [SYS.pause(), SYS.restart()] }; }

  setup() {
    const frame = this.add.graphics().setDepth(0);
    frame.fillStyle(fromRgb(10, 8, 26), 1);
    frame.fillRoundedRect(OFF_X - 14, OFF_Y - 14, BOARD_PX + 28, BOARD_PX + 28, 14);
    frame.lineStyle(3, NEON_YELLOW, 1);
    frame.strokeRoundedRect(OFF_X - 12.5, OFF_Y - 12.5, BOARD_PX + 25, BOARD_PX + 25, 14);
    frame.fillStyle(fromRgb(18, 16, 40), 1);
    for (let i = 0; i < SIZE * SIZE; i++) { const [x, y] = tilePos(i); frame.fillRoundedRect(x, y, TILE, TILE, 10); }
    this.gTiles = this.add.graphics().setDepth(1);
    this.numbers = Array.from({ length: SIZE * SIZE - 1 }, (_, k) =>
      ptext(this, 0, 0, String(k + 1), 6, WHITE, 'center', { shadow: BLACK }).setDepth(2));
    this.txtMoves = ptext(this, 14, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtTime = ptext(this, 190, HUD_H / 2, '', 2, NEON_GREEN, 'midleft').setDepth(10);
    this.txtPlace = ptext(this, 370, HUD_H / 2, '', 2, NEON_MAGENTA, 'midleft').setDepth(10);
    this.txtBest = ptext(this, W - 14, HUD_H / 2, '', 2, NEON_YELLOW, 'midright').setDepth(10);
    this.newGame();
  }

  newGame() {
    this.tiles = shuffled();
    this.moves = 0;
    this.timer = new Stopwatch();
    this.timer.running = false;
    this.visual = {};
    this.tiles.forEach((v, i) => { if (v) this.visual[v] = tilePos(i); });
    this.bestMoves = getBest(this.store, 'puzzle15_moves');
    this.bestTime = getBest(this.store, 'puzzle15_time');
    this.won = 0;
  }

  apply(moved) {
    if (!moved) return;
    this.moves += moved;
    this.timer.running = true;
    Audio.play('slide');
  }

  onKey(e) {
    if (this.won) return;
    const d = ARROWS[e.code];
    if (d) this.apply(push(this.tiles, ...d));
  }

  onPointerDown(p) {
    if (this.won) return;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const [x, y] = tilePos(i);
      if (p.x >= x && p.x < x + TILE && p.y >= y && p.y < y + TILE) {
        const moved = slide(this.tiles, i);
        if (moved) this.apply(moved);
        else Audio.play('error', 0.4);
        return;
      }
    }
  }

  tick(dt) {
    const follow = Math.min(1, dt * 18);   // ogni tessera scivola verso il suo posto
    this.tiles.forEach((v, i) => {
      if (!v) return;
      const [tx, ty] = tilePos(i);
      const vis = this.visual[v];
      vis[0] += (tx - vis[0]) * follow;
      vis[1] += (ty - vis[1]) * follow;
    });
    this.timer.update(dt);
    if (this.won > 0) {
      this.won -= dt;
      if (this.won <= 0) this.finish();
    } else if (this.moves > 0 && isSolved(this.tiles)) {
      this.timer.stop();
      for (let i = 0; i < 15; i++) {
        const [x, y] = tilePos(i);
        this.particles.burst(x + TILE / 2, y + TILE / 2, ROW_COLORS[Math.floor(i / SIZE)], 8, { speed: [60, 240], life: [0.4, 1] });
      }
      this.won = 0.75;
    }
  }

  finish() {
    const seconds = Math.round(this.timer.elapsed * 10) / 10;
    const recMoves = recordBest(this.store, 'puzzle15_moves', this.moves, true);
    const recTime = recordBest(this.store, 'puzzle15_time', seconds, true);
    const bestMoves = getBest(this.store, 'puzzle15_moves', this.moves);
    const bestTime = getBest(this.store, 'puzzle15_time', seconds);
    this.endScreen('SOLVED!', [
      `Moves: ${this.moves}   Time: ${formatTime(seconds)}`,
      `Record: ${bestMoves} moves · ${formatTime(bestTime)}`,
    ], { newRecord: recMoves || recTime, win: true });
  }

  draw() {
    const g = this.gTiles;
    g.clear();
    let inPlace = 0;
    this.tiles.forEach((v, i) => {
      if (!v) return;
      const [x0, y0] = this.visual[v];
      const x = Math.round(x0), y = Math.round(y0);
      const color = ROW_COLORS[Math.floor((v - 1) / SIZE)];
      const correct = i === v - 1;
      if (correct) inPlace += 1;
      const base = lerpColor(fromRgb(26, 22, 56), color, correct ? 0.28 : 0.12);
      g.fillStyle(fromRgb(4, 2, 12), 1); g.fillRoundedRect(x + 4, y + 5, TILE, TILE, 10);
      g.fillStyle(base, 1); g.fillRoundedRect(x, y, TILE, TILE, 10);
      g.lineStyle(3, correct ? color : lerpColor(color, BG, 0.55), 1);
      g.strokeRoundedRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3, 10);
      g.fillStyle(lerpColor(base, WHITE, 0.25), 1); g.fillRect(x + 10, y + 5, TILE - 20, 2);
      this.numbers[v - 1].setPosition(x + TILE / 2, y + TILE / 2).setColor(correct ? WHITE : color);
    });
    this.txtMoves.setText(`MOVES ${this.moves}`);
    this.txtTime.setText(`TIME ${this.timer}`);
    this.txtPlace.setText(`IN PLACE ${inPlace}/15`);
    this.txtBest.setText(`RECORD ${this.bestMoves ? `${this.bestMoves} · ${formatTime(this.bestTime || 0)}` : '--'}`);
  }
}
