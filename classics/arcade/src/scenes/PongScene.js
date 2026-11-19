/**
 * Pong — il classico del 1972. Porting di pong.py.
 *
 * * Modalità scelta all'avvio: 1 giocatore contro la CPU (facile / medio /
 *   difficile) oppure 2 giocatori.
 * * La CPU *prevede* dove arriverà la palla (rimbalzi compresi), con un
 *   ritardo di reazione e un errore di mira che dipendono dalla difficoltà.
 * * Fisica indipendente dal frame rate (pixel al secondo), la palla accelera
 *   a ogni colpo e l'angolo dipende da dove tocca la racchetta.
 * * Countdown al servizio dopo ogni punto, vince chi arriva a 11.
 * * Touch: trascina sulla metà sinistra (G1) o destra (G2): in due sullo
 *   stesso tablet grazie al multi-touch.
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { SYS } from '../shared/SceneKit.js';
import { getBest } from '../core/scores.js';
import { PONG, AI_LEVELS, predictY } from '../logic/arcade.js';
import { W, H, WHITE, TEXT_DIM, NEON_CYAN, NEON_MAGENTA, NEON_YELLOW, fromRgb } from '../core/palette.js';

const {
  TOP, BOTTOM, PADDLE_W, PADDLE_H, PADDLE_X_MARGIN, PADDLE_SPEED, BALL_R, BALL_START_SPEED, BALL_MAX_SPEED,
  SPEEDUP, MAX_BOUNCE_ANGLE, WIN_SCORE, SERVE_DELAY,
} = PONG;
const MODES = ['1 PLAYER · EASY', '1 PLAYER · MEDIUM', '1 PLAYER · HARD', '2 PLAYERS'];
const TRAIL = 12;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const sign = () => (Math.random() < 0.5 ? -1 : 1);

class Paddle {
  constructor(x) { this.x = x; this.y = H / 2; this.flash = 0; this.target = null; }
  get rect() { return { x: Math.round(this.x - PADDLE_W / 2), y: Math.round(this.y - PADDLE_H / 2), w: PADDLE_W, h: PADDLE_H }; }
  move(dy) { this.y = Math.max(TOP + PADDLE_H / 2, Math.min(BOTTOM - PADDLE_H / 2, this.y + dy)); }
}

/** Racchetta della CPU con imperfezioni "umane". */
class CPU {
  constructor(profile) { this.profile = profile; this.target = H / 2; this.lookTimer = 0; this.error = 0; }
  newRally() { this.error = rand(-this.profile.error, this.profile.error); }
  update(dt, paddle, ball) {
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = this.profile.reaction;
      this.target = ball.vx > 0 ? predictY(ball.x, ball.y, ball.vx, ball.vy, paddle.rect.x) + this.error : H / 2;
    }
    const diff = this.target - paddle.y;
    const step = this.profile.speed * dt;
    if (Math.abs(diff) > 4) paddle.move(Math.max(-step, Math.min(step, diff)));
  }
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export default class PongScene extends ArcadeScene {
  constructor() { super('PongScene'); this.shakeMax = 7; }

  touchLayout() { return { system: [SYS.pause(), SYS.restart()] }; }

  async setup() {
    const choice = await this.selectMenu('PONG', MODES, ['Pick a game mode'], 1);
    if (choice === null) return;
    this.mode = choice;
    this.vsCpu = choice < 3;
    this.cpu = this.vsCpu ? new CPU(AI_LEVELS[choice]) : null;

    const field = this.add.graphics().setDepth(0);
    field.fillStyle(fromRgb(70, 70, 120), 1);
    field.fillRect(0, TOP - 4, W, 4);
    field.fillRect(0, BOTTOM, W, 4);
    field.fillStyle(fromRgb(60, 60, 105), 1);
    for (let y = TOP + 6; y < BOTTOM; y += 26) field.fillRect(W / 2 - 3, y, 6, 14);

    this.scoreL = ptext(this, W / 2 - 60, 30, '0', 6, NEON_CYAN, 'midtop').setDepth(1);
    this.scoreR = ptext(this, W / 2 + 60, 30, '0', 6, NEON_MAGENTA, 'midtop').setDepth(1);
    ptext(this, W / 2 - 110, 40, this.vsCpu ? 'YOU' : 'P1', 2, TEXT_DIM, 'topright').setDepth(1);
    ptext(this, W / 2 + 110, 40, this.vsCpu ? `CPU ${['EASY', 'MEDIUM', 'HARD'][choice]}` : 'P2', 2, TEXT_DIM).setDepth(1);
    this.txtReady = ptext(this, W / 2, H / 2 + 60, 'READY!', 3, NEON_YELLOW, 'center').setDepth(5);
    this.g = this.add.graphics().setDepth(2);
    this.pointers = new Map();   // dito/mouse -> metà campo (multi-touch)
    this.newGame();
  }

  newGame() {
    this.left = new Paddle(PADDLE_X_MARGIN);
    this.right = new Paddle(W - PADDLE_X_MARGIN);
    this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: BALL_START_SPEED, trail: [] };
    this.score = [0, 0];
    this.serveTimer = SERVE_DELAY;
    this.serveDir = sign();
    this.finished = false;
    this.cpu?.newRally();
  }

  serve(direction) {
    const b = this.ball;
    b.x = W / 2;
    b.y = rand(H * 0.3, H * 0.7);
    b.speed = BALL_START_SPEED;
    const angle = rand(-0.45, 0.45);
    b.vx = direction * b.speed * Math.cos(angle);
    b.vy = b.speed * Math.sin(angle);
    b.trail = [];
  }

  onKey(e) { if (e.code === 'Space' && !e.repeat) this.pause(); }

  // --- touch / mouse: metà sinistra -> G1, metà destra -> G2 (solo in due)
  pointerSide(p) { return !this.vsCpu && p.x > W / 2 ? 'right' : 'left'; }
  onPointerDown(p) { this.pointers.set(p.id, this.pointerSide(p)); this[this.pointerSide(p)].target = p.y; }
  onPointerMove(p) {
    if (!p.isDown) return;
    const side = this.pointers.get(p.id) ?? this.pointerSide(p);
    this[side].target = p.y;
  }
  onPointerUp(p) {
    const side = this.pointers.get(p.id);
    this.pointers.delete(p.id);
    if (side && ![...this.pointers.values()].includes(side)) this[side].target = null;
  }

  tick(dt) {
    if (this.finished) return;
    const { left, right, ball } = this;
    // --- input
    const step = PADDLE_SPEED * dt;
    if (this.isDown('KeyW') || (this.vsCpu && this.isDown('ArrowUp'))) left.move(-step);
    if (this.isDown('KeyS') || (this.vsCpu && this.isDown('ArrowDown'))) left.move(step);
    if (this.cpu) this.cpu.update(dt, right, ball);
    else {
      if (this.isDown('ArrowUp')) right.move(-step);
      if (this.isDown('ArrowDown')) right.move(step);
    }
    for (const pad of [left, right]) {   // il dito trascina la racchetta (un po' più veloce della tastiera)
      if (pad.target === null || (pad === right && this.cpu)) continue;
      const diff = pad.target - pad.y;
      pad.move(Math.max(-step * 1.8, Math.min(step * 1.8, diff)));
    }

    // --- servizio
    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) { this.serve(this.serveDir); this.cpu?.newRally(); Audio.play('blip'); }
    }

    // --- fisica della palla
    if (this.serveTimer <= 0) {
      ball.trail.push([ball.x, ball.y]);
      if (ball.trail.length > TRAIL) ball.trail.shift();
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y - BALL_R < TOP) { ball.y = TOP + BALL_R; ball.vy = Math.abs(ball.vy); Audio.play('wall'); }
      else if (ball.y + BALL_R > BOTTOM) { ball.y = BOTTOM - BALL_R; ball.vy = -Math.abs(ball.vy); Audio.play('wall'); }

      const brect = { x: Math.round(ball.x - BALL_R), y: Math.round(ball.y - BALL_R), w: BALL_R * 2, h: BALL_R * 2 };
      for (const [pad, dir] of [[left, 1], [right, -1]]) {
        const towards = dir === 1 ? ball.vx < 0 : ball.vx > 0;
        if (!towards || !overlaps(brect, pad.rect)) continue;
        const offset = Math.max(-1, Math.min(1, (ball.y - pad.y) / (PADDLE_H / 2)));
        const angle = offset * MAX_BOUNCE_ANGLE;
        ball.speed = Math.min(BALL_MAX_SPEED, ball.speed * SPEEDUP);
        ball.vx = dir * ball.speed * Math.cos(angle);
        ball.vy = ball.speed * Math.sin(angle);
        ball.x = dir === 1 ? pad.rect.x + PADDLE_W + BALL_R : pad.rect.x - BALL_R;
        pad.flash = 0.08;
        this.particles.burst(ball.x, ball.y, [dir === 1 ? NEON_CYAN : NEON_MAGENTA, WHITE], 10,
          { speed: [80, 260], life: [0.15, 0.4], angle: dir === 1 ? 0 : Math.PI, spread: 2.2 });
        Audio.play('hit');
        if (this.cpu && dir === 1) this.cpu.newRally();
      }

      let scorer = null;
      if (ball.x < -BALL_R * 2) scorer = 1;
      else if (ball.x > W + BALL_R * 2) scorer = 0;
      if (scorer !== null) {
        this.score[scorer] += 1;
        Audio.play('score');
        this.shake.add(0.45);
        this.particles.burst(W / 2 + (scorer ? 60 : -60), 60, scorer ? NEON_MAGENTA : NEON_CYAN, 30,
          { speed: [60, 220], life: [0.4, 0.9] });
        this.serveDir = scorer === 1 ? -1 : 1;   // serve verso chi ha subito il punto
        Object.assign(ball, { vx: 0, vy: 0, x: W / 2, y: H / 2, trail: [] });
        this.serveTimer = SERVE_DELAY;
      }
    }
    for (const pad of [left, right]) pad.flash = Math.max(0, pad.flash - dt);

    // --- vittoria
    if (Math.max(...this.score) >= WIN_SCORE) {
      this.finished = true;
      const leftWon = this.score[0] > this.score[1];
      let title, lines;
      if (this.vsCpu) {
        title = leftWon ? 'YOU WIN!' : 'YOU LOSE!';
        if (leftWon) this.store.save({ pong_wins: (getBest(this.store, 'pong_wins', 0) || 0) + 1 });
        lines = [`Final score: ${this.score[0]} - ${this.score[1]}`,
          `Wins against the CPU: ${getBest(this.store, 'pong_wins', 0) || 0}`];
      } else {
        title = leftWon ? 'P1 WINS!' : 'P2 WINS!';
        lines = [`Final score: ${this.score[0]} - ${this.score[1]}`];
      }
      this.endScreen(title, lines, { win: leftWon || !this.vsCpu });
    }
  }

  draw() {
    const { left, right, ball, g } = this;
    g.clear();
    this.scoreL.setText(String(this.score[0]));
    this.scoreR.setText(String(this.score[1]));
    for (const [pad, color] of [[left, NEON_CYAN], [right, NEON_MAGENTA]]) {
      const r = pad.rect;
      g.fillStyle(color, 50 / 255);
      g.fillRoundedRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 8);
      g.fillStyle(pad.flash > 0 ? WHITE : color, 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 4);
    }
    ball.trail.forEach(([tx, ty], i) => {
      g.fillStyle(fromRgb(120, 220, 255), (150 * (i + 1)) / TRAIL / 255);
      g.fillCircle(tx, ty, Math.max(2, Math.floor((BALL_R * (i + 4)) / 16)));
    });
    if (this.serveTimer <= 0 || Math.floor(this.serveTimer * 8) % 2 === 0) {
      g.fillStyle(WHITE, 1);
      g.fillCircle(ball.x, ball.y, BALL_R);
    }
    this.txtReady.setVisible(this.serveTimer > 0);
  }
}
