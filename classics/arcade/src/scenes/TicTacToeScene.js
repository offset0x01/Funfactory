/**
 * Tic Tac Toe (Tris) — contro un amico o contro il computer.
 * Porting di tris.py.
 *
 * * Modalità: VS CPU (facile / medio / impossibile) oppure 2 giocatori.
 * * La CPU "impossibile" usa minimax completo con tabella di trasposizione
 *   (src/logic/gameAI.js): non perde mai, lo dimostra un test esaustivo.
 * * Chi inizia si alterna a ogni partita, così anche la CPU apre.
 * * Segni al neon disegnati con un tratto animato, linea vincente animata,
 *   anteprima al passaggio del mouse, cursore da tastiera (frecce + INVIO).
 * * Vittorie e pareggi vengono salvati (tris_x, tris_o, tris_draw).
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import Settings from '../shared/Settings.js';
import { ptext } from '../shared/PixelText.js';
import { drawPanel } from '../shared/Draw.js';
import { SYS, pick } from '../shared/SceneKit.js';
import { GameAI, TicTacToeState, winningLine } from '../logic/gameAI.js';
import {
  W, H, WHITE, TEXT_DIM, NEON_RED, NEON_BLUE, NEON_PURPLE, NEON_GREEN, NEON_YELLOW, NEON_MAGENTA, fromRgb,
} from '../core/palette.js';

const CELL = 150;
const BOARD = CELL * 3;
const OFF_X = (W - BOARD) / 2;
const OFF_Y = 52;
const CPU_DELAY = 0.45;
const STROKE_TIME = 0.18;
const LEVELS = ['easy', 'medium', 'hard'];
const LEVEL_NAMES = { easy: 'EASY', medium: 'MEDIUM', hard: 'IMPOSSIBLE' };
const MODES = ['VS CPU · EASY', 'VS CPU · MEDIUM', 'VS CPU · IMPOSSIBLE', '2 PLAYERS'];
const GOLD = fromRgb(255, 230, 60);

const cellRect = (r, c) => ({ x: OFF_X + c * CELL, y: OFF_Y + r * CELL, w: CELL, h: CELL });

/** Disegna una X (1) o una O (-1) con il tratto neon animato (progress 0..1). */
function drawMark(g, mark, rect, progress, alpha = 1) {
  progress = Math.max(0, Math.min(1, progress));
  const inset = Math.floor(CELL * 0.42) / 2;
  const ix = rect.x + inset, iy = rect.y + inset, iw = rect.w - 2 * inset;
  if (mark === 1) {
    const segs = [[ix, iy, ix + iw, iy + iw], [ix + iw, iy, ix, iy + iw]];
    segs.forEach(([x1, y1, x2, y2], k) => {
      const p = Math.max(0, Math.min(1, progress * 2 - k));
      if (p <= 0) return;
      const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p;
      g.lineStyle(22, NEON_RED, alpha / 4); g.lineBetween(x1, y1, ex, ey);
      g.lineStyle(10, NEON_RED, alpha); g.lineBetween(x1, y1, ex, ey);
    });
  } else {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const radius = iw / 2 + 4;
    const start = -Math.PI / 2;
    const end = start - progress * Math.PI * 2;   // antiorario, come pygame.draw.arc
    g.lineStyle(20, NEON_BLUE, alpha / 4);
    g.beginPath(); g.arc(cx, cy, radius + 3, start, end, true); g.strokePath();
    g.lineStyle(10, NEON_BLUE, alpha);
    g.beginPath(); g.arc(cx, cy, radius, start, end, true); g.strokePath();
  }
}

export default class TicTacToeScene extends ArcadeScene {
  constructor() { super('TicTacToeScene'); }

  touchLayout() {
    return { system: [SYS.pause(), SYS.mode('Tab'), { label: 'CPU', key: 'KeyL' }, SYS.restart()] };
  }

  async setup() {
    const choice = await this.selectMenu('TIC TAC TOE', MODES, ['You are X. O is the CPU or a friend.'], 1);
    if (choice === null) return;
    this.vsCpu = choice < 3;
    this.level = LEVELS[Math.min(choice, 2)];
    this.ai = GameAI.forLevel(this.vsCpu ? this.level : 'medium', -1);
    const data = this.store.load();
    this.tally = { x: data.tris_x || 0, o: data.tris_o || 0, draw: data.tris_draw || 0 };

    this.gGrid = this.add.graphics().setDepth(1);
    this.gMarks = this.add.graphics().setDepth(2);
    this.gPanel = this.add.graphics().setDepth(5);
    this.txtLeft = ptext(this, 16, 22, '', 2, NEON_RED, 'midleft');
    this.txtDraw = ptext(this, W / 2, 22, '', 2, TEXT_DIM, 'center');
    this.txtRight = ptext(this, W - 16, 22, '', 2, NEON_BLUE, 'midright');
    this.txtStatus = ptext(this, W / 2, H - 22, '', 2, WHITE, 'center').setDepth(6);
    this.txtResult = ptext(this, W / 2, H - 50, '', 3, WHITE, 'center').setDepth(6);
    this.txtHint = ptext(this, W / 2, H - 24, '', 1, TEXT_DIM, 'center').setDepth(6);

    this.starter = 1;
    this.cursor = [1, 1];
    this.hover = null;
    this.newRound(false);
  }

  newGame() { this.newRound(false); }

  newRound(alternate = true) {
    if (alternate) this.starter = -this.starter;
    this.board = [[null, null, null], [null, null, null], [null, null, null]];
    this.turn = this.starter;
    this.winner = null;
    this.line = null;
    this.over = false;
    this.cpuTimer = CPU_DELAY;
    this.placed = {};
    this.lineT = 0;
  }

  humanTurn() { return !this.over && (!this.vsCpu || this.turn === 1); }

  place(r, c) {
    if (this.over || this.board[r][c] !== null) return false;
    const mark = this.turn;
    this.board[r][c] = mark;
    this.placed[`${r},${c}`] = this.t;
    Audio.play(mark === 1 ? 'place_x' : 'place_o');
    const line = winningLine(this.board);
    if (line) Object.assign(this, { winner: mark, line, over: true, lineT: this.t });
    else if (this.board.flat().every((v) => v !== null)) Object.assign(this, { winner: 0, over: true, lineT: this.t });
    else { this.turn = -mark; this.cpuTimer = CPU_DELAY; return true; }

    // partita finita: aggiorna e salva il conteggio
    this.tally[{ 1: 'x', '-1': 'o', 0: 'draw' }[this.winner]] += 1;
    this.store.save({ tris_x: this.tally.x, tris_o: this.tally.o, tris_draw: this.tally.draw });
    if (this.winner === 0) Audio.play('blip');
    else if (this.vsCpu && this.winner === -1) Audio.play('lose');
    else {
      Audio.play('win');
      for (const [rr, cc] of line || []) {
        const rect = cellRect(rr, cc);
        this.particles.burst(rect.x + CELL / 2, rect.y + CELL / 2, [mark === 1 ? NEON_RED : NEON_BLUE, WHITE], 20,
          { speed: [60, 260], life: [0.4, 1] });
      }
    }
    return true;
  }

  setLevel(level) {
    this.level = level;
    this.ai = GameAI.forLevel(level, -1);
    Settings.notify(`CPU: ${LEVEL_NAMES[level]}`);
  }

  // ------------------------------------------------------------- input
  onKey(e) {
    const code = e.code;
    if (e.repeat && !code.startsWith('Arrow')) return;
    if (code === 'Tab') {
      this.vsCpu = !this.vsCpu;
      Settings.notify(this.vsCpu ? 'MODE: VS CPU' : 'MODE: 2 PLAYERS');
      this.newRound(false);
    } else if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(code)) {
      this.setLevel(LEVELS[Number(code.slice(-1)) - 1]);
    } else if (code === 'KeyL') {
      this.setLevel(LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length]);
    } else if (['Enter', 'NumpadEnter', 'Space'].includes(code)) {
      if (this.over) this.newRound();
      else if (this.humanTurn()) this.place(...this.cursor);
    } else {
      const dr = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[code] || 0;
      const dc = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[code] || 0;
      if (dr || dc) {
        this.cursor = [(this.cursor[0] + dr + 3) % 3, (this.cursor[1] + dc + 3) % 3];
        this.hover = null;
      }
    }
  }

  cellAt(p) {
    const c = Math.floor((p.x - OFF_X) / CELL), r = Math.floor((p.y - OFF_Y) / CELL);
    return r >= 0 && r < 3 && c >= 0 && c < 3 ? [r, c] : null;
  }

  onPointerMove(p) {
    this.hover = this.cellAt(p);
    if (this.hover) this.cursor = this.hover;
  }

  onPointerDown(p) {
    if (this.over) { this.newRound(); return; }
    if (!this.humanTurn()) return;
    const cell = this.cellAt(p);
    if (cell) { this.cursor = cell; this.place(...cell); }
  }

  // ------------------------------------------------------------- loop
  tick(dt) {
    // mossa della CPU dopo una breve "riflessione" che non blocca nulla
    if (this.vsCpu && !this.over && this.turn === -1) {
      this.cpuTimer -= dt;
      if (this.cpuTimer <= 0) {
        const move = this.ai.getBestMove(new TicTacToeState(this.board, -1));
        if (move) this.place(...move);
      }
    }
  }

  draw() {
    const t = this.t;
    // tabellone dei punteggi
    const left = this.vsCpu ? 'X (YOU)' : 'X (P1)';
    const right = this.vsCpu ? `O (CPU ${LEVEL_NAMES[this.level]})` : 'O (P2)';
    this.txtLeft.setText(`${left}  ${this.tally.x}`);
    this.txtDraw.setText(`DRAW ${this.tally.draw}`);
    this.txtRight.setText(`${this.tally.o}  ${right}`);

    // griglia
    const g = this.gGrid;
    g.clear();
    for (const i of [1, 2]) {
      const x = OFF_X + i * CELL, y = OFF_Y + i * CELL;
      for (const [color, width] of [[fromRgb(40, 60, 120), 14], [NEON_PURPLE, 5]]) {
        g.lineStyle(width, color, 1);
        g.lineBetween(x, OFF_Y + 8, x, OFF_Y + BOARD - 8);
        g.lineBetween(OFF_X + 8, y, OFF_X + BOARD - 8, y);
      }
    }

    // segni
    const m = this.gMarks;
    m.clear();
    const winning = new Set((this.line || []).map(([r, c]) => `${r},${c}`));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const mark = this.board[r][c];
        if (mark === null) continue;
        const rect = cellRect(r, c);
        if (winning.has(`${r},${c}`)) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 8);
          m.fillStyle(GOLD, (40 + 50 * pulse) / 255);
          m.fillRoundedRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 16);
        }
        drawMark(m, mark, rect, (t - (this.placed[`${r},${c}`] ?? -1)) / STROKE_TIME);
      }
    }
    // anteprima al passaggio / cursore da tastiera
    if (this.humanTurn()) {
      const [r, c] = this.hover || this.cursor;
      if (this.board[r][c] === null) drawMark(m, this.turn, cellRect(r, c), 1, 70 / 255);
      const cr = cellRect(...this.cursor);
      m.lineStyle(2, NEON_YELLOW, 1);
      m.strokeRoundedRect(cr.x + 7, cr.y + 7, cr.w - 14, cr.h - 14, 12);
    }
    // linea vincente
    if (this.line) {
      const a = cellRect(...this.line[0]), b = cellRect(...this.line[2]);
      const ax = a.x + CELL / 2, ay = a.y + CELL / 2, bx = b.x + CELL / 2, by = b.y + CELL / 2;
      const p = Math.min(1, (t - this.lineT) / 0.35);
      const ex = ax + (bx - ax) * p, ey = ay + (by - ay) * p;
      m.lineStyle(18, GOLD, 1); m.lineBetween(ax, ay, ex, ey);
      m.lineStyle(6, WHITE, 1); m.lineBetween(ax, ay, ex, ey);
    }

    // riga di stato
    const pg = this.gPanel;
    pg.clear();
    if (this.over) {
      let text, color;
      if (this.winner === 0) [text, color] = ['IT IS A DRAW!', NEON_YELLOW];
      else if (this.vsCpu && this.winner === 1) [text, color] = ['YOU WIN!', NEON_GREEN];
      else if (this.vsCpu) [text, color] = ['CPU WINS!', NEON_MAGENTA];
      else [text, color] = this.winner === 1 ? ['X WINS!', NEON_RED] : ['O WINS!', NEON_BLUE];
      const bx = W / 2 - 260, by = H - 6 - 64;
      drawPanel(pg, bx, by, 520, 64, color, 230 / 255);
      this.txtResult.setText(text).setColor(color).setPosition(W / 2, by + 20).setVisible(true);
      this.txtHint.setText(pick('ENTER / CLICK: NEW GAME   ESC: PAUSE', 'TAP FOR A NEW GAME'))
        .setPosition(W / 2, by + 46).setVisible(true);
      this.txtStatus.setVisible(false);
    } else {
      let msg, color;
      if (this.vsCpu && this.turn === -1) {
        msg = `CPU IS THINKING${'.'.repeat(1 + (Math.floor(t * 4) % 3))}`;
        color = NEON_BLUE;
      } else {
        msg = this.vsCpu ? 'YOUR TURN (X)' : `TURN: ${this.turn === 1 ? 'X' : 'O'}`;
        color = this.turn === 1 ? NEON_RED : NEON_BLUE;
      }
      this.txtStatus.setText(msg).setColor(color).setVisible(true);
      this.txtResult.setVisible(false);
      this.txtHint.setVisible(false);
    }
  }
}
