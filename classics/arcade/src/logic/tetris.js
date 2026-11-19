/**
 * Regole di Tetris secondo le linee guida moderne: porting di TetrisLogic
 * in tetris.py (nessuna grafica, testato in tests/).
 *
 *   - randomizzatore "7-bag" (mai più 5 pezzi S di fila)
 *   - rotazione SRS con le tabelle ufficiali dei wall kick
 *   - lock delay (0,5 s) con reset al movimento, come nel Tetris moderno
 *   - hold, ghost piece, coda di anteprima
 *   - punteggio guideline (100/300/500/800 x livello, punti per soft/hard drop)
 *   - curva di gravità guideline, un livello ogni 10 linee
 *
 * Approfondimenti: https://tetris.wiki/Super_Rotation_System
 *                  https://tetris.wiki/Random_Generator
 */
import { shuffle } from '../core/util.js';

export const COLUMNS = 10;
export const ROWS = 20;
export const LOCK_DELAY = 0.5;       // secondi che un pezzo appoggiato aspetta prima di bloccarsi
export const MAX_LOCK_RESETS = 15;   // movimenti/rotazioni che possono rimandare il blocco
export const CLEAR_ANIM_TIME = 0.32; // durata dell'animazione delle linee
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR LINES!'];

// Orientamento di partenza di ogni tetramino (riquadri SRS)
export const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
export const KINDS = Object.keys(SHAPES);

// Wall kick SRS: (dx, dy) con y verso l'ALTO come nelle tabelle ufficiali
const KICKS_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

/** Ruota una matrice di 90° in senso orario. */
export function rotateMatrix(m) {
  return m[0].map((_, c) => m.map((row) => row[c]).reverse());
}

const rotationCache = new Map();
/** Matrice di `kind` dopo `rotation` quarti di giro orari. */
export function rotated(kind, rotation) {
  const r = ((rotation % 4) + 4) % 4;
  const key = `${kind}${r}`;
  if (!rotationCache.has(key)) {
    let m = SHAPES[kind];
    if (kind !== 'O') for (let i = 0; i < r; i++) m = rotateMatrix(m);
    rotationCache.set(key, m);
  }
  return rotationCache.get(key);
}

/** Secondi per riga al livello dato (curva guideline). */
export function gravityInterval(level) {
  const l = Math.max(1, level);
  return Math.max(0.02, (0.8 - (l - 1) * 0.007) ** (l - 1));
}

export class Piece {
  constructor(kind, x, y, rotation = 0) { Object.assign(this, { kind, x, y, rotation }); }
  get matrix() { return rotated(this.kind, this.rotation); }
  /** Coordinate [x, y] sul tabellone dei quattro blocchi. */
  cells() {
    const out = [];
    this.matrix.forEach((row, r) => row.forEach((v, c) => { if (v) out.push([this.x + c, this.y + r]); }));
    return out;
  }
}

export class TetrisLogic {
  constructor(rng = Math.random, cols = COLUMNS, rows = ROWS) {
    this.rng = rng;
    this.cols = cols;
    this.rows = rows;
    this.board = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.bag = [];
    this.queue = [];
    this.piece = null;
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = -99;
    this.clearingRows = [];
    this.clearTimer = 0;
    this.events = [];
    this._fillQueue();
    this.spawn();
  }

  // ----------------------------------------------------------- pezzi
  _nextFromBag() {
    if (!this.bag.length) this.bag = shuffle(this.rng, [...KINDS]);
    return this.bag.pop();
  }

  _fillQueue() { while (this.queue.length < 5) this.queue.push(this._nextFromBag()); }

  /** Nuovo pezzo in alto. Restituisce false (e chiude la partita) se non c'è posto. */
  spawn(kind = null) {
    if (kind === null) { kind = this.queue.shift(); this._fillQueue(); }
    const width = SHAPES[kind][0].length;
    const x = kind !== 'O' ? Math.floor((this.cols - width) / 2) : Math.floor(this.cols / 2) - 1;
    const y = kind === 'I' ? -1 : 0;
    this.piece = new Piece(kind, x, y);
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = y;
    if (this.collides(this.piece.matrix, x, y)) {
      this.gameOver = true;
      this.events.push('gameover');
      return false;
    }
    return true;
  }

  /**
   * true se `matrix` in (x, y) tocca un muro, il fondo o un blocco.
   * Le righe sopra il campo (y < 0) contano come vuote: si può ruotare anche lassù.
   */
  collides(matrix, x, y) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c, by = y + r;
        if (bx < 0 || bx >= this.cols || by >= this.rows) return true;
        if (by >= 0 && this.board[by][bx] !== null) return true;
      }
    }
    return false;
  }

  get onGround() {
    const p = this.piece;
    return !!p && this.collides(p.matrix, p.x, p.y + 1);
  }

  _afterSuccessfulMove() {
    if (!this.piece) return;
    if (this.piece.y > this.lowestY) { this.lowestY = this.piece.y; this.lockResets = 0; }
    if (this.lockResets < MAX_LOCK_RESETS) { this.lockTimer = 0; this.lockResets++; }
  }

  // ----------------------------------------------------------- azioni
  move(dx) {
    const p = this.piece;
    if (!p || this.gameOver || this.collides(p.matrix, p.x + dx, p.y)) return false;
    p.x += dx;
    this._afterSuccessfulMove();
    this.events.push('move');
    return true;
  }

  /** Ruota in senso orario (1) o antiorario (-1) con i wall kick SRS. */
  rotate(direction = 1) {
    const p = this.piece;
    if (!p || this.gameOver || p.kind === 'O') return false;
    const newRot = (((p.rotation + direction) % 4) + 4) % 4;
    const matrix = rotated(p.kind, newRot);
    const table = p.kind === 'I' ? KICKS_I : KICKS_JLSTZ;
    for (const [dx, dyUp] of table[`${p.rotation}>${newRot}`]) {
      const nx = p.x + dx, ny = p.y - dyUp;
      if (!this.collides(matrix, nx, ny)) {
        p.x = nx; p.y = ny; p.rotation = newRot;
        this._afterSuccessfulMove();
        this.events.push('rotate');
        return true;
      }
    }
    return false;
  }

  /** Scende di una riga (+1 punto). */
  softDrop() {
    const p = this.piece;
    if (!p || this.gameOver || this.collides(p.matrix, p.x, p.y + 1)) return false;
    p.y += 1;
    this.score += 1;
    this.gravityTimer = 0;
    this._afterSuccessfulMove();
    return true;
  }

  ghostY() {
    const p = this.piece;
    if (!p) return 0;
    let y = p.y;
    while (!this.collides(p.matrix, p.x, y + 1)) y++;
    return y;
  }

  /** Cade fino in fondo e si blocca subito (+2 punti per riga). */
  hardDrop() {
    const p = this.piece;
    if (!p || this.gameOver) return 0;
    const distance = this.ghostY() - p.y;
    p.y += distance;
    this.score += 2 * distance;
    this.events.push('harddrop');
    this._lock();
    return distance;
  }

  /** Scambia il pezzo con quello tenuto da parte (una volta per pezzo). */
  holdPiece() {
    if (!this.piece || !this.canHold || this.gameOver) return false;
    const current = this.piece.kind;
    if (this.hold === null) { this.hold = current; this.spawn(); }
    else { const swap = this.hold; this.hold = current; this.spawn(swap); }
    this.canHold = false;
    this.events.push('hold');
    return true;
  }

  // ----------------------------------------------------------- regole
  _lock() {
    const p = this.piece;
    if (!p) return;
    let aboveTop = false;
    for (const [x, y] of p.cells()) {
      if (y < 0) aboveTop = true;
      else this.board[y][x] = p.kind;
    }
    this.piece = null;
    this.canHold = true;
    this.events.push('lock');
    if (aboveTop) {   // lock-out: il pezzo si è fermato fuori dal campo
      this.gameOver = true;
      this.events.push('gameover');
      return;
    }
    const full = [];
    for (let y = 0; y < this.rows; y++) if (this.board[y].every((v) => v !== null)) full.push(y);
    if (full.length) {
      this.clearingRows = full;
      this.clearTimer = CLEAR_ANIM_TIME;
      const n = full.length;
      this.score += LINE_SCORES[Math.min(n, 4)] * this.level;
      this.lines += n;
      this.events.push(`lines${n}`);
      const newLevel = 1 + Math.floor(this.lines / 10);
      if (newLevel > this.level) { this.level = newLevel; this.events.push('levelup'); }
    } else {
      this.spawn();
    }
  }

  _finishClear() {
    const keep = this.board.filter((_, y) => !this.clearingRows.includes(y));
    const empty = this.clearingRows.map(() => Array(this.cols).fill(null));
    this.board = [...empty, ...keep];
    this.clearingRows = [];
    this.spawn();
  }

  /** Avanza il tempo: gravità, lock delay e animazione delle linee. */
  update(dt, softDrop = false) {
    if (this.gameOver) return;
    if (this.clearingRows.length) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this._finishClear();
      return;
    }
    if (!this.piece) return;
    let interval = gravityInterval(this.level);
    if (softDrop) interval = Math.min(interval, 0.035);
    this.gravityTimer += dt;
    while (this.gravityTimer >= interval && this.piece) {
      this.gravityTimer -= interval;
      if (this.onGround) { this.gravityTimer = 0; break; }
      this.piece.y += 1;
      if (softDrop) this.score += 1;
      if (this.piece.y > this.lowestY) { this.lowestY = this.piece.y; this.lockResets = 0; this.lockTimer = 0; }
    }
    if (this.piece && this.onGround) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this._lock();
    } else {
      this.lockTimer = 0;
    }
  }

  popEvents() { const e = this.events; this.events = []; return e; }
}
