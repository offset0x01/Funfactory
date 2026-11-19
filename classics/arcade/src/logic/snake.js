/**
 * Regole di Snake su una griglia di celle (niente grafica): porting di
 * SnakeLogic in snake.py.
 *
 *   * Mela rossa: +2 punti, sempre presente.
 *   * Frutto blu: +5 punti, compare per qualche secondo (lampeggia prima di
 *     sparire), poi torna dopo un'attesa.
 *   * Velocità: 8 passi/s + 1 ogni 5 punti (massimo 20).
 *   * Muri e il proprio corpo sono mortali.
 *   * Input bufferizzato: due svolte rapide ("su poi sinistra") non si perdono.
 */
import { uniform, choice } from '../core/util.js';

export const GRID = 20;
export const HUD_H = 40;
export const COLS = 800 / GRID;              // 40
export const ROWS = (600 - HUD_H) / GRID;    // 28
export const BASE_SPEED = 8;
export const MAX_SPEED = 20;
export const BONUS_LIFETIME = 7;
export const BONUS_COOLDOWN = [4, 8];
export const RED_POINTS = 2;
export const BLUE_POINTS = 5;

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

export class SnakeLogic {
  constructor(rng = Math.random, cols = COLS, rows = ROWS) {
    this.rng = rng;
    this.cols = cols;
    this.rows = rows;
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    this.body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
    this.direction = [1, 0];
    this.queue = [];           // al massimo 3 svolte in attesa
    this.alive = true;
    this.started = false;
    this.score = 0;
    this.red = null;
    this.blue = null;
    this.red = this.freeCell();
    this.blueTimer = 0;        // tempo rimasto mentre il frutto blu è visibile
    this.blueCooldown = uniform(rng, ...BONUS_COOLDOWN);
    this.stepTimer = 0;
    this.events = [];
  }

  /** Una cella a caso non occupata dal serpente né da altro cibo. */
  freeCell() {
    const occupied = new Set(this.body.map(([x, y]) => `${x},${y}`));
    if (this.red) occupied.add(`${this.red[0]},${this.red[1]}`);
    if (this.blue) occupied.add(`${this.blue[0]},${this.blue[1]}`);
    const free = [];
    for (let x = 0; x < this.cols; x++) for (let y = 0; y < this.rows; y++) if (!occupied.has(`${x},${y}`)) free.push([x, y]);
    return free.length ? choice(this.rng, free) : [...this.body[this.body.length - 1]];
  }

  /** Passi al secondo. */
  get speed() { return Math.min(BASE_SPEED + Math.floor(this.score / 5), MAX_SPEED); }

  /** Mette in coda un cambio di direzione (le inversioni a 180° sono ignorate). */
  turn(d) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;
    if (!same(d, last) && !(d[0] === -last[0] && d[1] === -last[1])) {
      this.queue.push(d);
      if (this.queue.length > 3) this.queue.shift();
    }
    this.started = true;
  }

  /** Avanza di una cella. */
  step() {
    while (this.queue.length) {
      const d = this.queue.shift();
      if (!(d[0] === -this.direction[0] && d[1] === -this.direction[1])) { this.direction = d; break; }
    }
    const [hx, hy] = this.body[0];
    const head = [hx + this.direction[0], hy + this.direction[1]];
    const willGrow = same(head, this.red) || same(head, this.blue);
    const toCheck = willGrow ? this.body : this.body.slice(0, -1);   // la coda si sposta: la si può seguire
    const outside = head[0] < 0 || head[0] >= this.cols || head[1] < 0 || head[1] >= this.rows;
    if (outside || toCheck.some((c) => same(c, head))) {
      this.alive = false;
      this.events.push(['die', this.body[0]]);
      return;
    }
    this.body.unshift(head);
    if (same(head, this.red)) {
      this.score += RED_POINTS;
      this.events.push(['eat', head]);
      this.red = this.freeCell();
    } else if (same(head, this.blue)) {
      this.score += BLUE_POINTS;
      this.events.push(['bonus', head]);
      this.blue = null;
      this.blueCooldown = uniform(this.rng, ...BONUS_COOLDOWN);
    } else {
      this.body.pop();
    }
  }

  update(dt) {
    if (!this.alive || !this.started) return;
    if (this.blue) {
      this.blueTimer -= dt;
      if (this.blueTimer <= 0) { this.blue = null; this.blueCooldown = uniform(this.rng, ...BONUS_COOLDOWN); }
    } else {
      this.blueCooldown -= dt;
      if (this.blueCooldown <= 0) { this.blue = this.freeCell(); this.blueTimer = BONUS_LIFETIME; }
    }
    this.stepTimer += dt;
    const interval = 1 / this.speed;
    while (this.stepTimer >= interval && this.alive) {
      this.stepTimer -= interval;
      this.step();
    }
  }

  popEvents() { const e = this.events; this.events = []; return e; }
}
