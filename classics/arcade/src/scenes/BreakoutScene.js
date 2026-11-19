/**
 * Breakout — distruggi tutti i mattoni senza far cadere la palla.
 * Porting di breakout.py.
 *
 * * 5 livelli disegnati a mano (poi ricominciano, più veloci), mattoni da 1-3 colpi
 * * collisioni a sotto-passi, separate per asse: la palla non attraversa i
 *   mattoni e rimbalza sul lato giusto
 * * angolo di rimbalzo controllato dal punto in cui la palla tocca la racchetta
 * * power-up: L = racchetta larga, M = multi-palla, S = palla lenta, ♥ = +1 vita
 * * la palla aspetta sulla racchetta finché non la lanci (SPAZIO / clic / tocco)
 * * mouse O tastiera (il mouse prende il controllo solo quando lo muovi)
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { SYS, pick } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import { BREAKOUT, buildBricks, circleHitsRect, LEVELS } from '../logic/arcade.js';
import {
  W, H, WHITE, BLACK, TEXT_DIM, NEON_ORANGE, NEON_CYAN, NEON_YELLOW, NEON_GREEN, NEON_RED, lerpColor,
} from '../core/palette.js';

const {
  HUD_H, FIELD, PADDLE_W, PADDLE_W_WIDE, PADDLE_H, PADDLE_Y, PADDLE_SPEED, BALL_R, BALL_SPEED, BALL_SPEED_MAX,
  MAX_ANGLE, START_LIVES, MAX_LIVES, POWERUP_CHANCE, POWERUP_SPEED, MAX_BALLS,
} = BREAKOUT;
const POWERUPS = { L: NEON_GREEN, M: NEON_CYAN, S: NEON_YELLOW, '♥': NEON_RED };
const FIELD_R = FIELD.x + FIELD.w, FIELD_B = FIELD.y + FIELD.h;

const ballSpeed = (b) => Math.hypot(b.vx, b.vy);

export default class BreakoutScene extends ArcadeScene {
  constructor() { super('BreakoutScene'); }

  touchLayout() {
    return {
      system: [SYS.pause(), SYS.restart()],
      dpad: { left: 'ArrowLeft', right: 'ArrowRight', axis: 'x', mode: 'hold' },
      actions: [{ icon: 'play', label: 'Launch', key: 'Space', big: true }],
    };
  }

  setup() {
    const frame = this.add.graphics().setDepth(0);
    frame.lineStyle(3, NEON_ORANGE, 1);
    frame.strokeRoundedRect(FIELD.x - 3, FIELD.y - 3, FIELD.w + 6, FIELD.h + 6, 4);
    this.gBricks = this.add.graphics().setDepth(1);
    this.gGame = this.add.graphics().setDepth(2);
    this.txtScore = ptext(this, 16, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtBest = ptext(this, 290, HUD_H / 2, '', 2, NEON_YELLOW, 'midleft').setDepth(10);
    this.txtLevel = ptext(this, 540, HUD_H / 2, '', 2, NEON_GREEN, 'midleft').setDepth(10);
    this.txtLives = ptext(this, W - 16, HUD_H / 2 - 7, '', 2, NEON_RED, 'topright').setDepth(10);
    this.txtTimers = [0, 1].map((k) => ptext(this, FIELD_R - 8, FIELD_B - 20 - k * 18, '', 2, WHITE, 'bottomright').setDepth(10));
    this.txtBanner = ptext(this, W / 2, H / 2 + 20, '', 5, NEON_ORANGE, 'center', { glow: true }).setDepth(20);
    this.txtLaunch = ptext(this, W / 2, PADDLE_Y - 60, '', 2, TEXT_DIM, 'center').setDepth(20);
    this.capLabels = [];   // etichette dei power-up che cadono
    this.mouseMode = false;
    this.pointerX = null;
    this.newGame();
  }

  newGame() {
    this.best = getBest(this.store, 'breakout', 0) || 0;
    this.s = this.newState(1);
    this.levelDone = 0;
  }

  newState(level, keep = null) {
    const s = {
      level, score: keep ? keep.score : 0, lives: keep ? keep.lives : START_LIVES, paddleX: W / 2,
      balls: [], bricks: buildBricks(level), powerups: [], wideTimer: 0, slowTimer: 0, bannerTimer: 1.4,
    };
    s.balls = [{ x: s.paddleX, y: PADDLE_Y - PADDLE_H / 2 - BALL_R, vx: 0, vy: 0, stuck: true }];
    this.bricksDirty = true;
    return s;
  }

  get paddleW() { return this.s.wideTimer > 0 ? PADDLE_W_WIDE : PADDLE_W; }

  get paddleRect() {
    const w = this.paddleW;
    return { x: Math.round(this.s.paddleX - w / 2), y: Math.round(PADDLE_Y - PADDLE_H / 2), w, h: PADDLE_H };
  }

  get baseSpeed() {
    const loop = Math.floor((this.s.level - 1) / LEVELS.length);
    return Math.min(BALL_SPEED_MAX, BALL_SPEED * (1 + 0.06 * (this.s.level - 1) + 0.15 * loop));
  }

  saveOnExit() { recordBest(this.store, 'breakout', this.s?.score || 0); }

  launchStuck() {
    for (const ball of this.s.balls) {
      if (!ball.stuck) continue;
      const angle = (Math.random() - 0.5) * 0.7;
      ball.vx = this.baseSpeed * Math.sin(angle);
      ball.vy = -this.baseSpeed * Math.cos(angle);
      ball.stuck = false;
      Audio.play('blip');
    }
  }

  onKey(e) {
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) this.launchStuck();
    else if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) this.mouseMode = false;
  }

  onPointerMove(p) { this.mouseMode = true; this.pointerX = p.x; }
  onPointerDown(p) { this.mouseMode = true; this.pointerX = p.x; this.launchStuck(); }

  damage(brick) {
    const s = this.s;
    brick.hp -= 1;
    s.score += 5;
    const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2;
    this.bricksDirty = true;
    if (brick.hp <= 0) {
      s.bricks.splice(s.bricks.indexOf(brick), 1);
      s.score += 10 * brick.maxHp;
      Audio.play('brick');
      this.particles.burst(cx, cy, [brick.color, WHITE], 16, { speed: [60, 240], life: [0.3, 0.7], gravity: 420 });
      this.popups.add(`+${5 + 10 * brick.maxHp}`, cx, cy, brick.color, 0.6);
      if (Math.random() < POWERUP_CHANCE) {
        const kinds = Object.keys(POWERUPS);
        s.powerups.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], x: cx, y: cy });
      }
    } else {
      Audio.play('hit', 0.7);
      this.particles.burst(cx, cy, WHITE, 5, { speed: [40, 120], life: [0.15, 0.3] });
    }
  }

  collideBricks(ball) {
    for (const brick of this.s.bricks) {
      if (circleHitsRect(ball.x, ball.y, BALL_R, brick)) { this.damage(brick); return true; }
    }
    return false;
  }

  stepBall(ball, dt) {
    const s = this.s;
    if (ball.stuck) {
      ball.x = s.paddleX + 18;
      ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R;
      return;
    }
    const slow = s.slowTimer > 0 ? 0.7 : 1;
    const steps = Math.max(1, Math.ceil((ballSpeed(ball) * slow * dt) / (BALL_R * 0.7)));
    const f = (slow * dt) / steps;
    for (let i = 0; i < steps; i++) {
      // asse X
      ball.x += ball.vx * f;
      if (ball.x - BALL_R < FIELD.x) { ball.x = FIELD.x + BALL_R; ball.vx = Math.abs(ball.vx); Audio.play('wall', 0.6); }
      else if (ball.x + BALL_R > FIELD_R) { ball.x = FIELD_R - BALL_R; ball.vx = -Math.abs(ball.vx); Audio.play('wall', 0.6); }
      else if (this.collideBricks(ball)) { ball.x -= ball.vx * f; ball.vx = -ball.vx; }
      // asse Y
      ball.y += ball.vy * f;
      if (ball.y - BALL_R < FIELD.y) { ball.y = FIELD.y + BALL_R; ball.vy = Math.abs(ball.vy); Audio.play('wall', 0.6); }
      else if (this.collideBricks(ball)) { ball.y -= ball.vy * f; ball.vy = -ball.vy; }
      // racchetta
      const pr = this.paddleRect;
      if (ball.vy > 0 && circleHitsRect(ball.x, ball.y, BALL_R, pr) && ball.y < pr.y + pr.h / 2) {
        const offset = Math.max(-1, Math.min(1, (ball.x - (pr.x + pr.w / 2)) / (pr.w / 2)));
        const angle = offset * MAX_ANGLE;
        const speed = Math.min(BALL_SPEED_MAX, ballSpeed(ball) * 1.015);
        ball.vx = speed * Math.sin(angle);
        ball.vy = -speed * Math.cos(angle);
        ball.y = pr.y - BALL_R;
        Audio.play('hit');
        this.particles.burst(ball.x, pr.y, NEON_CYAN, 6, { speed: [40, 140], life: [0.15, 0.3], angle: -Math.PI / 2, spread: 2 });
      }
    }
  }

  applyPowerup(kind) {
    const s = this.s;
    Audio.play('powerup');
    const px = s.paddleX;
    if (kind === 'L') { s.wideTimer = 12; this.popups.add('LONG PADDLE!', px, PADDLE_Y - 30, NEON_GREEN, 1); }
    else if (kind === 'S') { s.slowTimer = 9; this.popups.add('SLOW BALL!', px, PADDLE_Y - 30, NEON_YELLOW, 1); }
    else if (kind === '♥') { s.lives = Math.min(MAX_LIVES, s.lives + 1); this.popups.add('+1 LIFE!', px, PADDLE_Y - 30, NEON_RED, 1); }
    else if (kind === 'M') {
      const extra = [];
      for (const b of s.balls) {
        if (b.stuck) continue;
        for (const da of [-0.45, 0.45]) {
          const ang = Math.atan2(b.vx, -b.vy) + da;
          const sp = ballSpeed(b);
          extra.push({ x: b.x, y: b.y, vx: sp * Math.sin(ang), vy: -Math.abs(sp * Math.cos(ang)), stuck: false });
        }
      }
      s.balls.push(...extra.slice(0, Math.max(0, MAX_BALLS - s.balls.length)));
      this.popups.add('MULTI-BALL!', px, PADDLE_Y - 30, NEON_CYAN, 1);
    }
  }

  tick(dt) {
    const s = this.s;
    if (this.levelDone > 0) {   // festa di fine livello, poi il prossimo
      this.levelDone -= dt;
      if (this.levelDone <= 0) this.s = this.newState(s.level + 1, s);
      return;
    }
    // --- racchetta
    if (this.isDown('ArrowLeft', 'KeyA')) s.paddleX -= PADDLE_SPEED * dt;
    if (this.isDown('ArrowRight', 'KeyD')) s.paddleX += PADDLE_SPEED * dt;
    if (this.mouseMode && this.pointerX !== null) s.paddleX = this.pointerX;
    const half = this.paddleW / 2;
    s.paddleX = Math.max(FIELD.x + half, Math.min(FIELD_R - half, s.paddleX));
    // --- timer
    s.bannerTimer = Math.max(0, s.bannerTimer - dt);
    s.wideTimer = Math.max(0, s.wideTimer - dt);
    s.slowTimer = Math.max(0, s.slowTimer - dt);
    // --- palle
    for (const ball of [...s.balls]) {
      this.stepBall(ball, dt);
      if (ball.y - BALL_R > H) s.balls.splice(s.balls.indexOf(ball), 1);
    }
    if (!s.balls.length) {
      s.lives -= 1;
      Audio.play('hurt');
      this.shake.add(0.6);
      s.wideTimer = 0; s.slowTimer = 0;
      s.powerups = [];
      if (s.lives > 0) s.balls = [{ x: s.paddleX, y: PADDLE_Y, vx: 0, vy: 0, stuck: true }];
    }
    // --- power-up che cadono
    const pr = this.paddleRect;
    for (const p of [...s.powerups]) {
      p.y += POWERUP_SPEED * dt;
      const caught = p.x >= pr.x - 5 && p.x < pr.x + pr.w + 5 && p.y >= pr.y - 3 && p.y < pr.y + pr.h + 3;
      if (caught) { s.powerups.splice(s.powerups.indexOf(p), 1); this.applyPowerup(p.kind); }
      else if (p.y > H) s.powerups.splice(s.powerups.indexOf(p), 1);
    }
    // --- livello completato / game over
    if (!s.bricks.length) {
      const bonus = 250 * s.level;
      s.score += bonus;
      Audio.play('win');
      this.popups.add(`LEVEL CLEARED! +${bonus}`, W / 2, H / 2, NEON_GREEN, 1.6, 3);
      this.levelDone = 1.2;
    } else if (s.lives <= 0) {
      const newRecord = recordBest(this.store, 'breakout', s.score);
      this.best = Math.max(this.best, s.score);
      this.endScreen('GAME OVER', [`Score: ${s.score}   Level reached: ${s.level}`, `Record: ${this.best}`], { newRecord });
    }
  }

  drawBricks() {
    const g = this.gBricks;
    g.clear();
    for (const b of this.s.bricks) {
      const base = lerpColor(BLACK, b.color, 0.45 + 0.55 * (b.hp / b.maxHp));
      g.fillStyle(base, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 3);
      g.fillStyle(lerpColor(base, WHITE, 0.5), 1);
      g.fillRect(b.x + 3, b.y + 1, b.w - 7, 2);
      if (b.maxHp > 1) {
        g.fillStyle(WHITE, 1);
        for (let k = 0; k < b.hp; k++) g.fillRect(b.x + 6 + k * 7, b.y + b.h - 7, 4, 3);
      }
      if (b.maxHp >= 3 && b.hp === b.maxHp) { g.lineStyle(1, WHITE, 1); g.strokeRoundedRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3); }
    }
    this.bricksDirty = false;
  }

  draw() {
    const s = this.s;
    if (this.bricksDirty) this.drawBricks();
    const g = this.gGame;
    g.clear();
    // power-up (capsule con lettera)
    while (this.capLabels.length < s.powerups.length) this.capLabels.push(ptext(this, 0, 0, '', 2, BLACK, 'center').setDepth(3));
    this.capLabels.forEach((lbl, i) => {
      const p = s.powerups[i];
      lbl.setVisible(!!p);
      if (!p) return;
      g.fillStyle(POWERUPS[p.kind], 1); g.fillRoundedRect(p.x - 17, p.y - 8, 34, 16, 8);
      g.lineStyle(1, WHITE, 1); g.strokeRoundedRect(p.x - 17, p.y - 8, 34, 16, 8);
      lbl.setText(p.kind).setPosition(Math.round(p.x), Math.round(p.y));
    });
    // racchetta con alone
    const pr = this.paddleRect;
    g.fillStyle(NEON_CYAN, 45 / 255); g.fillRoundedRect(pr.x - 10, pr.y - 10, pr.w + 20, pr.h + 20, 12);
    g.fillStyle(NEON_CYAN, 1); g.fillRoundedRect(pr.x, pr.y, pr.w, pr.h, 7);
    g.fillStyle(WHITE, 1); g.fillRoundedRect(pr.x + pr.w / 4, pr.y + 4, pr.w / 2, pr.h - 8, 3);
    // palle
    g.fillStyle(s.slowTimer > 0 ? NEON_YELLOW : WHITE, 1);
    for (const ball of s.balls) g.fillCircle(ball.x, ball.y, BALL_R);
    // HUD
    this.txtScore.setText(`SCORE ${s.score}`);
    this.txtBest.setText(`RECORD ${Math.max(this.best, s.score)}`);
    this.txtLevel.setText(`LEVEL ${s.level}`);
    this.txtLives.setText('♥'.repeat(Math.max(0, s.lives)));
    const timers = [];
    if (s.wideTimer > 0) timers.push(['L', s.wideTimer, NEON_GREEN]);
    if (s.slowTimer > 0) timers.push(['S', s.slowTimer, NEON_YELLOW]);
    this.txtTimers.forEach((t, k) => {
      const tm = timers[k];
      t.setVisible(!!tm);
      if (tm) t.setText(`${tm[0]} ${Math.round(tm[1])}`).setColor(tm[2]);
    });
    this.txtBanner.setText(`LEVEL ${s.level}`).setVisible(s.bannerTimer > 0);
    const stuck = s.balls.some((b) => b.stuck) && s.bannerTimer <= 0;
    this.txtLaunch.setText(pick('SPACE OR CLICK TO LAUNCH', 'TAP TO LAUNCH')).setVisible(stuck);
  }
}
