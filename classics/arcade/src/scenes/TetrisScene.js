/**
 * Tetris — versione "linee guida moderne". Porting di tetris.py.
 *
 * Le regole (7-bag, SRS con wall kick, lock delay, hold, punteggio
 * guideline) stanno in src/logic/tetris.js e sono testate. Qui ci sono
 * grafica, input con auto-shift (DAS/ARR: tieni premuto ←/→ e il pezzo
 * scorre da solo dopo un attimo), suoni ed effetti.
 *
 * Touch: trascina per muovere, tocca per ruotare, swipe veloce verso il
 * basso per l'hard drop, oppure croce + pulsanti Ruota / Drop / Hold.
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { drawPanel } from '../shared/Draw.js';
import { SYS, bindHint } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import {
  TetrisLogic, Piece, SHAPES, COLUMNS, ROWS, CLEAR_ANIM_TIME, LINE_NAMES,
} from '../logic/tetris.js';
import {
  W, WHITE, BLACK, TEXT_DIM, GRAY_DARK, NEON_PURPLE, NEON_CYAN, NEON_YELLOW, NEON_MAGENTA, NEON_GREEN,
  css, fromRgb, lerpColor,
} from '../core/palette.js';

const CELL = 26;
const BOARD_W = COLUMNS * CELL;
const BOARD_H = ROWS * CELL;
const OFF_X = (W - BOARD_W) / 2;
const OFF_Y = 46;
const DAS = 0.16;     // ritardo prima dell'auto-shift (tieni premuto sinistra/destra)
const ARR = 0.045;    // velocità di ripetizione dopo il DAS
const PREVIEW_COUNT = 3;
const BOARD_BG = fromRgb(8, 6, 20);
const FONT = 'ui-monospace, Consolas, "DejaVu Sans Mono", monospace';

export const COLORS = {
  I: fromRgb(0, 230, 255), J: fromRgb(60, 110, 255), L: fromRgb(255, 150, 30), O: fromRgb(255, 225, 40),
  S: fromRgb(60, 230, 90), T: fromRgb(180, 70, 255), Z: fromRgb(255, 60, 80),
};

/** Blocco "arcade" smussato (come block_surface in Python). */
function drawBlock(g, x, y, size, color) {
  const bevel = Math.max(2, Math.floor(size / 7));
  g.fillStyle(lerpColor(color, BLACK, 0.45), 1);
  g.fillRect(x, y, size, size);
  g.fillStyle(lerpColor(color, WHITE, 0.45), 1);
  g.fillTriangle(x, y, x + size - 1, y, x, y + size - 1);
  g.fillStyle(color, 1);
  g.fillRect(x + bevel, y + bevel, size - 2 * bevel, size - 2 * bevel);
  g.fillStyle(lerpColor(color, WHITE, 0.25), 1);
  g.fillRect(x + bevel, y + bevel, size - 2 * bevel, 1);
}

/** Pezzo (orientamento di partenza) centrato in un riquadro di anteprima. */
function drawMiniPiece(g, kind, cx, cy, size) {
  const cells = [];
  SHAPES[kind].forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([c, r]); }));
  const xs = cells.map(([c]) => c), ys = cells.map(([, r]) => r);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = (Math.max(...xs) - minX + 1) * size, h = (Math.max(...ys) - minY + 1) * size;
  const ox = Math.round(cx - w / 2), oy = Math.round(cy - h / 2);
  for (const [c, r] of cells) drawBlock(g, ox + (c - minX) * size, oy + (r - minY) * size, size, COLORS[kind]);
}

const bx = (x) => OFF_X + x * CELL;
const by = (y) => OFF_Y + y * CELL;

export default class TetrisScene extends ArcadeScene {
  constructor() { super('TetrisScene'); this.shakeMax = 6; }

  touchLayout() {
    return {
      system: [SYS.pause(), SYS.restart()],
      dpad: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', mode: 'hold' },
      actions: [
        { icon: 'rotate', label: 'Turn', key: 'ArrowUp', big: true },
        { icon: 'drop', label: 'Drop', key: 'Space' },
        { label: 'HOLD', sub: 'Hold', key: 'KeyC' },
      ],
      gestures: {
        swipe: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
        step: 26, lockAxis: true, tap: 'ArrowUp', flickDown: 'Space',
      },
    };
  }

  setup() {
    const frame = this.add.graphics().setDepth(0);
    frame.lineStyle(3, NEON_PURPLE, 1);
    frame.strokeRoundedRect(OFF_X - 6, OFF_Y - 6, BOARD_W + 12, BOARD_H + 12, 6);
    frame.fillStyle(BOARD_BG, 1);
    frame.fillRect(OFF_X, OFF_Y, BOARD_W, BOARD_H);
    frame.lineStyle(1, fromRgb(22, 18, 44), 1);
    for (let c = 1; c < COLUMNS; c++) frame.lineBetween(bx(c) + 0.5, OFF_Y, bx(c) + 0.5, OFF_Y + BOARD_H);
    for (let r = 1; r < ROWS; r++) frame.lineBetween(OFF_X, by(r) + 0.5, OFF_X + BOARD_W, by(r) + 0.5);

    this.gBoard = this.add.graphics().setDepth(1);
    this.gPanels = this.add.graphics().setDepth(1);
    this.gPieces = this.add.graphics().setDepth(2);

    // pannello sinistro: statistiche + hold
    const lx = OFF_X - 230;
    this.stats = ['SCORE', 'RECORD', 'LEVEL', 'LINES'].map((label, i) => {
      ptext(this, lx, OFF_Y + i * 62, label, 2, TEXT_DIM).setDepth(3);
      return ptext(this, lx, OFF_Y + i * 62 + 22, '', 3, i === 1 ? NEON_YELLOW : NEON_CYAN).setDepth(3);
    });
    this.holdBox = { x: lx, y: OFF_Y + 270, w: 180, h: 110 };
    this.holdLabel = ptext(this, lx + 90, this.holdBox.y + 10, 'HOLD (C)', 2, TEXT_DIM, 'midtop').setDepth(3);
    // pannello destro: prossimi pezzi + aiuto
    const rx = OFF_X + BOARD_W + 30;
    this.nextBox = { x: rx, y: OFF_Y, w: 180, h: 300 };
    ptext(this, rx + 90, OFF_Y + 10, 'NEXT', 2, TEXT_DIM, 'midtop').setDepth(3);
    const help = this.add.text(rx, OFF_Y + 330, '', {
      fontFamily: FONT, fontSize: '15px', color: css(TEXT_DIM), lineSpacing: 5,
    }).setDepth(3);
    bindHint(this, help,
      '← → move\n↑ X / Z turn\n↓ slow drop\nSPACE fast drop\nC / SHIFT hold\nESC pause',
      'Drag: move\nTap: turn\nSwipe down: drop\nHOLD: save a block');
    bindHint(this, this.holdLabel, 'HOLD (C)', 'HOLD');
    this.newGame();
  }

  newGame() {
    this.logic = new TetrisLogic();
    this.best = getBest(this.store, 'tetris', 0) || 0;
    this.heldDas = { left: 0, right: 0 };
    this.overDelay = 0;
    this._ended = false;
  }

  saveOnExit() { recordBest(this.store, 'tetris', this.logic?.score || 0); }

  onKey(e) {
    if (e.repeat) return;   // l'auto-ripetizione la gestiamo noi (DAS/ARR)
    const g = this.logic;
    if (g.gameOver) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': g.move(-1); this.heldDas.left = DAS; this.heldDas.right = 0; break;
      case 'ArrowRight': case 'KeyD': g.move(1); this.heldDas.right = DAS; this.heldDas.left = 0; break;
      case 'ArrowUp': case 'KeyX': case 'KeyW': g.rotate(1); break;
      case 'KeyZ': case 'ControlLeft': case 'ControlRight': g.rotate(-1); break;
      case 'ArrowDown': case 'KeyS': g.softDrop(); break;
      case 'Space': g.hardDrop(); break;
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight': g.holdPiece(); break;
      default: break;
    }
  }

  autoShift(dt) {
    for (const [name, dx, codes] of [['left', -1, ['ArrowLeft', 'KeyA']], ['right', 1, ['ArrowRight', 'KeyD']]]) {
      if (this.isDown(...codes)) {
        this.heldDas[name] -= dt;
        while (this.heldDas[name] <= 0) {
          if (!this.logic.move(dx)) { this.heldDas[name] = ARR; break; }
          this.heldDas[name] += ARR;
        }
      } else {
        this.heldDas[name] = 0;
      }
    }
  }

  react(events) {
    const g = this.logic;
    for (const ev of events) {
      if (ev === 'move') Audio.play('move', 0.35);
      else if (ev === 'rotate') Audio.play('rotate');
      else if (ev === 'hold') Audio.play('blip');
      else if (ev === 'harddrop') { Audio.play('drop'); this.shake.add(0.25); }
      else if (ev === 'lock') Audio.play('drop', 0.5);
      else if (ev.startsWith('lines')) {
        const n = Number(ev.slice(5));
        const rows = [...g.clearingRows];
        Audio.play(n >= 4 ? 'tetris' : 'line');
        this.shake.add(0.15 * n);
        const midY = OFF_Y + Math.round((rows.reduce((a, b) => a + b, 0) / rows.length) * CELL) + CELL / 2;
        this.popups.add(LINE_NAMES[Math.min(n, 4)], W / 2, midY, n >= 4 ? NEON_MAGENTA : NEON_YELLOW, 1, 3);
        for (const row of rows) {
          for (let c = 0; c < COLUMNS; c++) {
            this.particles.burst(bx(c) + CELL / 2, by(row) + CELL / 2, [WHITE, NEON_CYAN, NEON_YELLOW], 3,
              { speed: [40, 200], life: [0.3, 0.7], gravity: 300 });
          }
        }
      } else if (ev === 'levelup') {
        Audio.play('levelup');
        this.popups.add(`LEVEL ${g.level}`, W / 2, OFF_Y + BOARD_H / 3, NEON_GREEN, 1.4, 3);
      }
    }
  }

  tick(dt) {
    const g = this.logic;
    if (!g.gameOver) {
      this.autoShift(dt);
      g.update(dt, this.isDown('ArrowDown', 'KeyS'));
    }
    this.react(g.popEvents());
    if (g.gameOver) {
      this.overDelay += dt;
      if (this.overDelay >= 0.35 && !this._ended) {
        this._ended = true;
        const newRecord = recordBest(this.store, 'tetris', g.score);
        this.best = Math.max(this.best, g.score);
        this.endScreen('GAME OVER', [
          `Score: ${g.score}   Lines: ${g.lines}   Level: ${g.level}`,
          `Record: ${this.best}`,
        ], { newRecord }).then(() => { this._ended = false; });
      }
    }
  }

  draw() {
    const g = this.logic;
    // --- tabellone
    const b = this.gBoard;
    b.clear();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLUMNS; x++) {
        const kind = g.board[y][x];
        if (kind) drawBlock(b, bx(x), by(y), CELL, COLORS[kind]);
      }
    }
    // --- animazione delle linee: lampeggiano e si stringono verso il centro
    if (g.clearingRows.length) {
      const progress = 1 - Math.max(0, g.clearTimer) / CLEAR_ANIM_TIME;
      const flash = Math.floor(progress * 8) % 2 === 0 ? WHITE : NEON_CYAN;
      for (const row of g.clearingRows) {
        const width = Math.round(BOARD_W * (1 - progress));
        b.fillStyle(BOARD_BG, 1); b.fillRect(OFF_X, by(row), BOARD_W, CELL);
        b.fillStyle(flash, 1); b.fillRect(OFF_X + (BOARD_W - width) / 2, by(row) + 2, width, CELL - 4);
      }
    }
    // --- ghost e pezzo attivo
    const p = g.piece;
    const pg = this.gPieces;
    pg.clear();
    if (p && !g.gameOver) {
      const color = COLORS[p.kind];
      for (const [cx, cy] of new Piece(p.kind, p.x, g.ghostY(), p.rotation).cells()) {
        if (cy < 0) continue;
        pg.fillStyle(color, 45 / 255); pg.fillRect(bx(cx), by(cy), CELL, CELL);
        pg.lineStyle(2, color, 200 / 255); pg.strokeRect(bx(cx) + 1, by(cy) + 1, CELL - 2, CELL - 2);
      }
      const flashLock = g.onGround && Math.floor(g.lockTimer * 20) % 2 === 1;
      for (const [cx, cy] of p.cells()) {
        if (cy < 0) continue;
        drawBlock(pg, bx(cx), by(cy), CELL, color);
        if (flashLock) { pg.lineStyle(1, WHITE, 1); pg.strokeRect(bx(cx) + 0.5, by(cy) + 0.5, CELL - 1, CELL - 1); }
      }
    }
    // --- pannelli
    [g.score, Math.max(this.best, g.score), g.level, g.lines].forEach((v, i) => this.stats[i].setText(String(v)));
    const pn = this.gPanels;
    pn.clear();
    const hb = this.holdBox;
    drawPanel(pn, hb.x, hb.y, hb.w, hb.h, g.canHold ? NEON_MAGENTA : GRAY_DARK, 200 / 255, 8);
    if (g.hold) drawMiniPiece(pn, g.hold, hb.x + hb.w / 2, hb.y + hb.h / 2 + 12, 20);
    const nb = this.nextBox;
    drawPanel(pn, nb.x, nb.y, nb.w, nb.h, NEON_CYAN, 200 / 255, 8);
    g.queue.slice(0, PREVIEW_COUNT).forEach((kind, i) => {
      drawMiniPiece(pn, kind, nb.x + nb.w / 2, nb.y + 75 + i * 80, i === 0 ? 22 : 16);
    });
  }
}
