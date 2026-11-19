/**
 * Maze Runner — trova l'uscita di un labirinto generato al momento.
 * Porting di maze_runner.py.
 *
 * * Labirinti "perfetti" scavati con una ricerca in profondità (DFS).
 * * Quattro difficoltà, compresa quella **al buio** in cui vedi solo ciò che
 *   illumina la tua torcia.
 * * H = suggerimento: una ricerca in ampiezza (BFS) mostra la via più breve
 *   per qualche secondo, al prezzo di +10 secondi.
 * * Movimento fluido, tieni premuto per correre, briciole di pane dove sei
 *   passato, miglior tempo salvato per ogni difficoltà.
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import Settings from '../shared/Settings.js';
import { ptext } from '../shared/PixelText.js';
import { SYS, pick } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import { formatTime, Stopwatch } from '../core/util.js';
import { DIFFICULTIES, generateMaze, shortestPath } from '../logic/maze.js';
import {
  W, H, WHITE, TEXT_DIM, NEON_CYAN, NEON_GREEN, NEON_YELLOW, css, fromRgb, lerpColor,
} from '../core/palette.js';

const HUD_H = 44;
const REPEAT_DELAY = 0.17;
const REPEAT_RATE = 0.075;
const HINT_PENALTY = 10;
const HINT_TIME = 3;
const LIGHT_R = 120;
const DARK_ALPHA = 252 / 255;
const DIRS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

let wallsCounter = 0;

/** Foro della torcia: alpha che cresce dal centro verso il bordo (come _light_mask). */
function torchCanvas(radius) {
  const size = radius * 2;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius);
      const a = Math.min(DARK_ALPHA, d >= radius ? 1 : (d / radius) ** 2.2);
      img.data[(y * size + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export default class MazeRunnerScene extends ArcadeScene {
  constructor() { super('MazeRunnerScene'); }

  touchLayout() {
    return {
      system: [SYS.pause(), SYS.restart()],
      dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', mode: 'hold' },
      actions: [{ icon: 'bulb', label: 'Hint', key: 'KeyH', big: true }],
      gestures: { swipe: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, step: 34 },
    };
  }

  async setup() {
    const choice = await this.selectMenu('MAZE RUNNER', DIFFICULTIES.map((d) => d.label),
      ['Pick a maze size'], 1);
    if (choice === null) return;
    this.diff = DIFFICULTIES[choice];
    this.recordKey = `maze_time_${this.diff.key}`;
    if (!this.textures.exists('__maze_torch')) this.textures.addCanvas('__maze_torch', torchCanvas(LIGHT_R));

    this.wallsImg = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(0);
    this.gFloor = this.add.graphics().setDepth(1);
    this.gDark = this.add.graphics().setDepth(5);
    this.torch = this.add.image(0, 0, '__maze_torch').setDepth(5).setVisible(this.diff.dark);
    this.gTop = this.add.graphics().setDepth(6);
    this.gHudBg = this.add.graphics().setDepth(9);
    this.txtTime = ptext(this, 14, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtMoves = ptext(this, 230, HUD_H / 2, '', 2, NEON_GREEN, 'midleft').setDepth(10);
    this.txtBest = ptext(this, 400, HUD_H / 2, '', 2, NEON_YELLOW, 'midleft').setDepth(10);
    this.txtHelp = ptext(this, W - 14, HUD_H / 2, '', 2, TEXT_DIM, 'midright').setDepth(10);
    this.txtGoal = ptext(this, W / 2, H - 14, 'REACH THE GREEN EXIT!', 2, WHITE, 'center').setDepth(10);
    this.newGame();
  }

  newGame() {
    const grid = generateMaze(this.diff.cols, this.diff.rows);
    const rows = grid.length, cols = grid[0].length;
    const cell = Math.min(Math.floor((W - 24) / cols), Math.floor((H - HUD_H - 16) / rows));
    Object.assign(this, {
      grid, rows, cols, cell,
      ox: Math.floor((W - cols * cell) / 2),
      oy: HUD_H + Math.floor((H - HUD_H - rows * cell) / 2),
      goal: [cols - 1, rows - 1], pos: [0, 0], visX: 0, visY: 0, moves: 0, hints: 0,
      hintPath: [], hintTimer: 0, visited: new Set(['0,0']), timer: new Stopwatch(), repeat: 0, won: 0,
    });
    this.timer.running = false;
    this.bestTime = getBest(this.store, this.recordKey);
    this.renderWalls();
  }

  /** Muri disegnati una volta in una texture (come la Surface in Python). */
  renderWalls() {
    const c = this.cell;
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * c; canvas.height = this.rows * c;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = css(fromRgb(10, 10, 26));
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.grid.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      ctx.fillStyle = css(fromRgb(40, 90, 210)); ctx.fillRect(x * c, y * c, c, c);
      ctx.fillStyle = css(fromRgb(90, 150, 255)); ctx.fillRect(x * c, y * c, c, Math.max(2, Math.floor(c / 6)));
    }));
    ctx.strokeStyle = css(NEON_CYAN);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    const old = this.wallsKey;
    this.wallsKey = `__maze_walls_${++wallsCounter}`;
    this.textures.addCanvas(this.wallsKey, canvas);
    this.wallsImg.setTexture(this.wallsKey).setPosition(this.ox, this.oy);
    if (old && this.textures.exists(old)) this.textures.remove(old);
  }

  center([x, y]) { return [this.ox + x * this.cell + this.cell / 2, this.oy + y * this.cell + this.cell / 2]; }

  tryMove(dx, dy) {
    const x = this.pos[0] + dx, y = this.pos[1] + dy;
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows || this.grid[y][x] !== 0) return false;
    this.pos = [x, y];
    this.moves += 1;
    this.visited.add(`${x},${y}`);
    this.timer.running = true;
    Audio.play('move', 0.25);
    return true;
  }

  onKey(e) {
    if (this.won) return;
    const d = DIRS[e.code];
    if (d && !e.repeat) { this.tryMove(...d); this.repeat = REPEAT_DELAY; }
    else if (e.code === 'KeyH' && !e.repeat) {
      this.hintPath = shortestPath(this.grid, this.pos, this.goal);
      this.hintTimer = HINT_TIME;
      this.hints += 1;
      this.timer.elapsed += HINT_PENALTY;
      Audio.play('powerup');
      Settings.notify(`+${HINT_PENALTY} SECONDS`);
    }
  }

  tick(dt) {
    if (this.won > 0) {
      this.won -= dt;
      if (this.won <= 0) this.finish();
      return;
    }
    // tieni premuta una freccia per correre
    const held = Object.entries(DIRS).filter(([code]) => this.held.has(code)).map(([, d]) => d);
    if (held.length) {
      this.repeat -= dt;
      if (this.repeat <= 0) { this.repeat += REPEAT_RATE; this.tryMove(...held[0]); }
    }
    // movimento visivo fluido verso la cella logica
    const follow = Math.min(1, dt * 22);
    this.visX += (this.pos[0] - this.visX) * follow;
    this.visY += (this.pos[1] - this.visY) * follow;
    this.timer.update(dt);
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    if (this.pos[0] === this.goal[0] && this.pos[1] === this.goal[1]) {
      this.timer.stop();
      const [gx, gy] = this.center(this.goal);
      this.particles.burst(gx, gy, [NEON_GREEN, NEON_YELLOW, WHITE], 60, { speed: [80, 320], life: [0.5, 1.2] });
      this.won = 0.7;
    }
  }

  finish() {
    const elapsed = Math.round(this.timer.elapsed * 10) / 10;
    const newRecord = recordBest(this.store, this.recordKey, elapsed, true);
    const best = getBest(this.store, this.recordKey, elapsed);
    this.endScreen('EXIT FOUND!', [
      `Time: ${formatTime(elapsed)}   Moves: ${this.moves}   Hints: ${this.hints}`,
      `Record (${this.diff.label.split(' ')[0].toLowerCase()}): ${formatTime(best)}`,
    ], { newRecord, win: true });
  }

  draw() {
    const t = this.t, c = this.cell;
    const g = this.gFloor;
    g.clear();
    g.fillStyle(fromRgb(90, 80, 150), 1);
    for (const key of this.visited) {
      const [vx, vy] = key.split(',').map(Number);
      const [px, py] = this.center([vx, vy]);
      g.fillRect(Math.floor(px) - 1, Math.floor(py) - 1, 3, 3);
    }
    const [gx, gy] = this.center(this.goal);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    g.fillStyle(lerpColor(fromRgb(20, 120, 60), NEON_GREEN, pulse), 1);
    g.fillRoundedRect(gx - c / 2 + 1, gy - c / 2 + 1, c - 2, c - 2, Math.min(3, c / 4));

    const px = Math.round(this.ox + this.visX * c + c / 2);
    const py = Math.round(this.oy + this.visY * c + c / 2);
    // buio: tutto nero tranne il cerchio della torcia
    const d = this.gDark;
    d.clear();
    if (this.diff.dark) {
      const x0 = px - LIGHT_R, y0 = py - LIGHT_R, s = LIGHT_R * 2;
      d.fillStyle(0x000000, DARK_ALPHA);
      d.fillRect(0, 0, W, Math.max(0, y0));
      d.fillRect(0, y0 + s, W, Math.max(0, H - (y0 + s)));
      d.fillRect(0, y0, Math.max(0, x0), s);
      d.fillRect(x0 + s, y0, Math.max(0, W - (x0 + s)), s);
      this.torch.setPosition(px, py);
    }
    const top = this.gTop;
    top.clear();
    if (this.diff.dark) {   // faro sull'uscita, visibile anche al buio
      top.fillStyle(NEON_GREEN, (80 + 80 * pulse) / 255);
      top.fillCircle(gx, gy, c);
    }
    if (this.hintTimer > 0) {   // disegnato sopra il buio: l'aiuto funziona anche lì
      top.fillStyle(NEON_YELLOW, 1);
      this.hintPath.forEach((cell, i) => {
        if ((i + Math.floor(t * 12)) % 3 !== 0) return;
        const [hx, hy] = this.center(cell);
        top.fillCircle(hx, hy, Math.max(2, Math.floor(c / 5)));
      });
    }
    top.fillStyle(NEON_YELLOW, 1); top.fillCircle(px, py, Math.max(3, Math.floor(c / 2) - 2));
    top.fillStyle(WHITE, 1); top.fillCircle(px - 2, py - 2, Math.max(1, Math.floor(c / 7)));
    // HUD (fondo pieno: resta leggibile anche al buio)
    const hb = this.gHudBg;
    hb.clear();
    if (this.diff.dark) { hb.fillStyle(0x000000, 1); hb.fillRect(0, 0, W, HUD_H); }
    this.txtTime.setText(`TIME ${formatTime(this.timer.elapsed)}`);
    this.txtMoves.setText(`MOVES ${this.moves}`);
    this.txtBest.setText(`RECORD ${this.bestTime ? formatTime(this.bestTime) : '--:--'}`);
    this.txtHelp.setText(pick('H HINT', 'HINT: +10 S'));
    this.txtGoal.setVisible(!this.timer.running && this.moves === 0);
  }
}
