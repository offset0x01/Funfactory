/**
 * Space Invaders — difendi la Terra dagli alieni in marcia.
 * Porting di space_invaders.py.
 *
 * * formazione classica 11 x 5 con tre tipi di alieni animati in pixel-art
 *   (30 / 20 / 10 punti), disegnati da bitmap: nessun file immagine
 * * la marcia accelera quando gli alieni muoiono, con il celebre basso a 4 note
 * * quattro scudi che si sgretolano colpo dopo colpo
 * * l'UFO misterioso (50-300 punti), proiettili nemici abbattibili
 * * vite con invulnerabilità temporanea, ondate sempre più basse e veloci
 *
 * Fuoco: tieni premuto SPAZIO (o il dito sullo schermo) per sparare a
 * ripetizione; al massimo 2 colpi in volo, come nella versione Python.
 */
import ArcadeScene from '../shared/ArcadeScene.js';
import Audio from '../shared/Audio.js';
import { ptext } from '../shared/PixelText.js';
import { bitmapTexture } from '../shared/Draw.js';
import { SYS } from '../shared/SceneKit.js';
import { getBest, recordBest } from '../core/scores.js';
import {
  SPRITES, PLAYER_ART, UFO_ART, EXPLOSION_ART, ROW_TYPES, TYPE_POINTS, TYPE_COLORS, Bunker, BUNKER_CELL,
  rectsOverlap,
} from '../logic/arcade.js';
import {
  W, H, WHITE, NEON_CYAN, NEON_RED, NEON_GREEN, NEON_YELLOW, NEON_ORANGE, fromRgb,
} from '../core/palette.js';

const HUD_H = 40;
const GROUND_Y = H - 26;
const SCALE = 3;
const PLAYER_Y = GROUND_Y - 34;
const PLAYER_SPEED = 300;
const PLAYER_BULLET_SPEED = 640;
const MAX_PLAYER_BULLETS = 2;
const FIRE_COOLDOWN = 0.28;
const INVULNERABLE_TIME = 1.6;
const START_LIVES = 3;
const COLS = 11, ROWS = 5;
const SPACING_X = 46, SPACING_Y = 36;
const STEP_X = 10, STEP_DOWN = 18;
const ENEMY_BULLET_SPEED = 250;
const BUNKER_Y = PLAYER_Y - 90;
const SPACE = fromRgb(8, 6, 20);
const PLAYER_W = PLAYER_ART[0].length * SCALE, PLAYER_H = PLAYER_ART.length * SCALE;
const UFO_W = UFO_ART[0].length * SCALE, UFO_H = UFO_ART.length * SCALE;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function alienRect(a, fx, fy) {
  const w = SPRITES[a.kind][0][0].length * SCALE;
  const cx = Math.floor(fx + a.col * SPACING_X + SPACING_X / 2);
  return { x: cx - Math.floor(w / 2), y: Math.floor(fy + a.row * SPACING_Y), w, h: 8 * SCALE };
}
const bulletRect = (b) => ({ x: Math.floor(b.x) - 2, y: Math.floor(b.y) - 6, w: 4, h: 12 });

export default class SpaceInvadersScene extends ArcadeScene {
  constructor() { super('SpaceInvadersScene'); this.shakeMax = 9; }

  touchLayout() {
    return {
      system: [SYS.pause(), SYS.restart()],
      dpad: { left: 'ArrowLeft', right: 'ArrowRight', axis: 'x', mode: 'hold' },
      actions: [{ icon: 'fire', label: 'Fire', key: 'Space', mode: 'hold', big: true }],
    };
  }

  setup() {
    this.cameras.main.setBackgroundColor(SPACE);
    // sprite generati una volta dalle bitmap
    for (const [kind, frames] of Object.entries(SPRITES)) {
      frames.forEach((art, i) => bitmapTexture(this, `inv_${kind}_${i}`, art, TYPE_COLORS[kind], SCALE));
    }
    bitmapTexture(this, 'inv_player', PLAYER_ART, NEON_CYAN, SCALE);
    bitmapTexture(this, 'inv_ufo', UFO_ART, NEON_RED, SCALE);
    bitmapTexture(this, 'inv_boom', EXPLOSION_ART, WHITE, SCALE);

    const sky = this.add.graphics().setDepth(0);
    for (let i = 0; i < 70; i++) {
      const s = Math.random() < 0.67 ? 1 : 2;
      sky.fillStyle(fromRgb(90, 90, 140), 1);
      sky.fillRect(Math.floor(Math.random() * W), HUD_H + Math.floor(Math.random() * (GROUND_Y - HUD_H)), s, s);
    }
    sky.fillStyle(NEON_GREEN, 1);
    sky.fillRect(0, GROUND_Y - 1, W, 2);

    this.gBunkers = this.add.graphics().setDepth(1);
    this.gShots = this.add.graphics().setDepth(4);
    this.alienImgs = Array.from({ length: COLS * ROWS }, () => this.add.image(0, 0, 'inv_crab_0').setOrigin(0, 0).setDepth(2));
    this.boomImgs = [];
    this.ufoImg = this.add.image(0, HUD_H + 22, 'inv_ufo').setDepth(2).setVisible(false);
    this.playerImg = this.add.image(W / 2, PLAYER_Y, 'inv_player').setOrigin(0.5, 0).setDepth(3);
    this.txtScore = ptext(this, 14, HUD_H / 2, '', 2, NEON_CYAN, 'midleft').setDepth(10);
    this.txtBest = ptext(this, W / 2 - 40, HUD_H / 2, '', 2, NEON_YELLOW, 'center').setDepth(10);
    this.txtWave = ptext(this, W - 130, HUD_H / 2, '', 2, NEON_GREEN, 'midright').setDepth(10);
    this.txtLives = ptext(this, W - 14, HUD_H / 2 - 7, '', 2, NEON_RED, 'topright').setDepth(10);
    this.txtBanner = ptext(this, W / 2, H / 2 + 30, '', 5, NEON_GREEN, 'center', { glow: true }).setDepth(20);
    this.pointers = new Map();
    this.newGame();
  }

  newGame() {
    this.best = getBest(this.store, 'space_invaders', 0) || 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 0;
    this.playerX = W / 2;
    this.invulnerable = 0;
    this.bunkers = [0, 1, 2, 3].map((i) => new Bunker(Math.floor((W * (i + 1)) / 5 - 40), BUNKER_Y));
    this.dying = 0;
    this.nextWave();
  }

  nextWave() {
    this.level += 1;
    this.aliens = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.aliens.push({ col: c, row: r, kind: ROW_TYPES[r], alive: true });
    this.fx = (W - COLS * SPACING_X) / 2;
    this.fy = HUD_H + 56 + Math.min(6, this.level - 1) * 12;
    this.direction = 1;
    this.stepTimer = 0;
    this.frame = 0;
    this.march = 0;
    this.shootTimer = 1.5;
    this.bullets = [];
    this.enemyBullets = [];
    this.fireCooldown = 0;
    this.ufoX = null;
    this.ufoDir = 1;
    this.ufoTimer = rand(15, 25);
    this.ufoSound = 0;
    this.explosions = [];
    this.banner = 1.6;
  }

  get alive() { return this.aliens.filter((a) => a.alive); }

  stepInterval() {
    const ratio = this.alive.length / (COLS * ROWS);
    return Math.max(0.035, 0.05 + 0.65 * ratio) / (1 + 0.12 * (this.level - 1));
  }

  playerRect() { return { x: Math.floor(this.playerX - PLAYER_W / 2), y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H }; }

  saveOnExit() { recordBest(this.store, 'space_invaders', this.score || 0); }

  tryShoot() {
    if (this.fireCooldown > 0 || this.bullets.length >= MAX_PLAYER_BULLETS || this.lives <= 0) return;
    this.bullets.push({ x: this.playerX, y: PLAYER_Y - 4 });
    this.fireCooldown = FIRE_COOLDOWN;
    Audio.play('shoot');
  }

  onKey(e) { if (!e.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(e.code)) this.tryShoot(); }
  onPointerDown(p) { this.pointers.set(p.id, p.x); }
  onPointerMove(p) { if (this.pointers.has(p.id)) this.pointers.set(p.id, p.x); }
  onPointerUp(p) { this.pointers.delete(p.id); }

  killPlayer() {
    this.lives -= 1;
    this.invulnerable = INVULNERABLE_TIME;
    this.enemyBullets = [];
    const pr = this.playerRect();
    Audio.play('explosion');
    this.shake.add(0.8);
    this.particles.burst(pr.x + pr.w / 2, pr.y + pr.h / 2, [NEON_CYAN, WHITE, NEON_YELLOW], 40,
      { speed: [60, 300], life: [0.4, 1], gravity: 200 });
  }

  /** Avanza la simulazione. Restituisce 'lost' quando la partita è finita. */
  simulate(dt) {
    if (this.isDown('ArrowLeft', 'KeyA')) this.playerX -= PLAYER_SPEED * dt;
    if (this.isDown('ArrowRight', 'KeyD')) this.playerX += PLAYER_SPEED * dt;
    if (this.pointers.size) {   // segue il primo dito / pulsante del mouse e spara
      const target = this.pointers.values().next().value;
      const step = PLAYER_SPEED * 1.6 * dt;
      this.playerX += Math.max(-step, Math.min(step, target - this.playerX));
    }
    this.playerX = Math.max(30, Math.min(W - 30, this.playerX));
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.isDown('Space', 'ArrowUp', 'KeyW') || this.pointers.size) this.tryShoot();

    // --- marcia della formazione
    this.stepTimer += dt;
    if (this.stepTimer >= this.stepInterval()) {
      this.stepTimer = 0;
      this.frame ^= 1;
      Audio.play(['step', 'step2', 'step3', 'step4'][this.march % 4], 0.6);
      this.march += 1;
      const rects = this.alive.map((a) => alienRect(a, this.fx, this.fy));
      if (rects.length) {
        const left = Math.min(...rects.map((r) => r.x));
        const right = Math.max(...rects.map((r) => r.x + r.w));
        if ((this.direction > 0 && right + STEP_X > W - 16) || (this.direction < 0 && left - STEP_X < 16)) {
          this.fy += STEP_DOWN;
          this.direction *= -1;
        } else {
          this.fx += STEP_X * this.direction;
        }
      }
    }

    const alive = this.alive;
    // gli alieni cancellano gli scudi che attraversano; se arrivano al giocatore è finita
    for (const a of alive) {
      const r = alienRect(a, this.fx, this.fy);
      for (const b of this.bunkers) b.hit(r, 0);
      if (r.y + r.h >= PLAYER_Y) return 'lost';
    }

    // --- fuoco nemico: spara l'alieno più basso di una colonna a caso
    this.shootTimer -= dt;
    const maxEnemyBullets = 2 + Math.floor(this.level / 2);
    if (this.shootTimer <= 0 && alive.length) {
      this.shootTimer = rand(0.5, 1.3) / (1 + 0.15 * (this.level - 1));
      if (this.enemyBullets.length < maxEnemyBullets) {
        const bottoms = new Map();
        for (const a of alive) if (!bottoms.has(a.col) || a.row > bottoms.get(a.col).row) bottoms.set(a.col, a);
        const r = alienRect(pickOne([...bottoms.values()]), this.fx, this.fy);
        this.enemyBullets.push({ x: r.x + r.w / 2, y: r.y + r.h, vy: ENEMY_BULLET_SPEED, zigzag: Math.random() < 0.5 });
        Audio.play('enemy_shoot', 0.5);
      }
    }

    // --- UFO
    if (this.ufoX === null) {
      this.ufoTimer -= dt;
      if (this.ufoTimer <= 0) { this.ufoDir = Math.random() < 0.5 ? -1 : 1; this.ufoX = this.ufoDir > 0 ? -40 : W + 40; }
    } else {
      this.ufoX += 140 * this.ufoDir * dt;
      this.ufoSound -= dt;
      if (this.ufoSound <= 0) { this.ufoSound = 0.42; Audio.play('ufo', 0.5); }
      if (this.ufoX < -60 || this.ufoX > W + 60) { this.ufoX = null; this.ufoTimer = rand(18, 30); }
    }
    const ufoRect = this.ufoX !== null ? { x: Math.floor(this.ufoX - UFO_W / 2), y: HUD_H + 22 - Math.floor(UFO_H / 2), w: UFO_W, h: UFO_H } : null;

    // --- colpi del giocatore
    for (const b of [...this.bullets]) {
      b.y -= PLAYER_BULLET_SPEED * dt;
      const br = bulletRect(b);
      let removed = false;
      if (b.y < HUD_H || this.bunkers.some((bk) => bk.hit(br))) removed = true;
      else if (ufoRect && rectsOverlap(br, ufoRect)) {
        const pts = pickOne([50, 100, 150, 300]);
        this.score += pts;
        const cx = ufoRect.x + ufoRect.w / 2, cy = ufoRect.y + ufoRect.h / 2;
        this.popups.add(String(pts), cx, cy, NEON_RED, 1.2, 3);
        this.particles.burst(cx, cy, [NEON_RED, WHITE], 30, { speed: [60, 260], life: [0.3, 0.9] });
        Audio.play('explosion');
        this.ufoX = null;
        this.ufoTimer = rand(18, 30);
        removed = true;
      } else {
        const eb = this.enemyBullets.find((e) => rectsOverlap(br, { ...bulletRect(e), x: bulletRect(e).x - 2, w: 8 }));
        if (eb) {
          this.enemyBullets.splice(this.enemyBullets.indexOf(eb), 1);
          this.particles.burst(b.x, b.y, WHITE, 6, { speed: [40, 120], life: [0.1, 0.3] });
          removed = true;
        } else {
          for (const a of alive) {
            if (!a.alive) continue;
            const r = alienRect(a, this.fx, this.fy);
            if (!rectsOverlap(br, r)) continue;
            a.alive = false;
            const pts = TYPE_POINTS[a.kind];
            this.score += pts;
            this.explosions.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, t: 0.18 });
            this.particles.burst(r.x + r.w / 2, r.y + r.h / 2, [TYPE_COLORS[a.kind], WHITE], 12, { speed: [50, 200], life: [0.2, 0.5] });
            this.popups.add(`+${pts}`, r.x + r.w / 2, r.y, TYPE_COLORS[a.kind], 0.5);
            Audio.play('small_explosion');
            removed = true;
            break;
          }
        }
      }
      if (removed) this.bullets.splice(this.bullets.indexOf(b), 1);
    }

    // --- colpi nemici
    const pr0 = this.playerRect();
    const pr = { x: pr0.x + 3, y: pr0.y + 2, w: pr0.w - 6, h: pr0.h - 4 };
    for (const eb of [...this.enemyBullets]) {
      eb.y += eb.vy * dt;
      const er = bulletRect(eb);
      if (eb.y > GROUND_Y) {
        this.enemyBullets.splice(this.enemyBullets.indexOf(eb), 1);
        this.particles.burst(eb.x, GROUND_Y, NEON_GREEN, 4, { speed: [20, 80], life: [0.1, 0.3] });
      } else if (this.bunkers.some((bk) => bk.hit(er))) {
        this.enemyBullets.splice(this.enemyBullets.indexOf(eb), 1);
      } else if (rectsOverlap(er, pr) && this.invulnerable <= 0) {
        this.killPlayer();   // svuota anche tutti i colpi nemici
        if (this.lives <= 0) return 'lost';
        break;
      }
    }

    for (const ex of this.explosions) ex.t -= dt;
    this.explosions = this.explosions.filter((e) => e.t > 0);

    if (!this.alive.length) {
      this.score += 100 * this.level;
      Audio.play('levelup');
      this.popups.add(`WAVE CLEARED! +${100 * this.level}`, W / 2, H / 2, NEON_GREEN, 1.4, 3);
      this.nextWave();
    }
    return null;
  }

  tick(dt) {
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) {
        const newRecord = recordBest(this.store, 'space_invaders', this.score);
        this.best = Math.max(this.best, this.score);
        this.endScreen('GAME OVER', [`Score: ${this.score}   Wave: ${this.level}`, `Record: ${this.best}`], { newRecord });
      }
      return;
    }
    this.banner = Math.max(0, this.banner - dt);
    const outcome = this.banner <= 0.8 ? this.simulate(dt) : null;
    if (outcome === 'lost') {
      if (this.lives > 0) this.killPlayer();   // invasione: il pianeta cade anche con vite residue
      this.lives = Math.max(0, this.lives);
      this.dying = 0.85;
    }
  }

  draw() {
    // scudi (ridisegnati solo quando cambiano)
    if (this.bunkers.some((b) => b.dirty)) {
      const g = this.gBunkers;
      g.clear();
      g.fillStyle(NEON_GREEN, 1);
      for (const b of this.bunkers) {
        for (const key of b.cells) {
          const [cx, cy] = key.split(',').map(Number);
          g.fillRect(b.x + cx * BUNKER_CELL, b.y + cy * BUNKER_CELL, BUNKER_CELL, BUNKER_CELL);
        }
        b.dirty = false;
      }
    }
    // alieni
    this.aliens.forEach((a, i) => {
      const img = this.alienImgs[i];
      img.setVisible(a.alive);
      if (!a.alive) return;
      const r = alienRect(a, this.fx, this.fy);
      img.setTexture(`inv_${a.kind}_${this.frame}`).setPosition(r.x, r.y);
    });
    while (this.boomImgs.length < this.explosions.length) this.boomImgs.push(this.add.image(0, 0, 'inv_boom').setDepth(2));
    this.boomImgs.forEach((img, i) => {
      const ex = this.explosions[i];
      img.setVisible(!!ex);
      if (ex) img.setPosition(Math.round(ex.x), Math.round(ex.y));
    });
    this.ufoImg.setVisible(this.ufoX !== null);
    if (this.ufoX !== null) this.ufoImg.setX(Math.round(this.ufoX));
    // colpi
    const g = this.gShots;
    g.clear();
    g.fillStyle(NEON_YELLOW, 1);
    for (const b of this.bullets) { const r = bulletRect(b); g.fillRect(r.x, r.y, r.w, r.h); }
    for (const eb of this.enemyBullets) {
      if (eb.zigzag) {
        const off = Math.floor(eb.y / 8) % 2 ? 3 : -3;
        g.lineStyle(2, NEON_RED, 1);
        g.beginPath();
        g.moveTo(eb.x, eb.y - 6); g.lineTo(eb.x + off, eb.y - 2); g.lineTo(eb.x - off, eb.y + 2); g.lineTo(eb.x, eb.y + 6);
        g.strokePath();
      } else {
        const r = bulletRect(eb);
        g.fillStyle(NEON_ORANGE, 1);
        g.fillRect(r.x, r.y, r.w, r.h);
      }
    }
    const blink = this.invulnerable <= 0 || Math.floor(this.invulnerable * 10) % 2 === 0;
    this.playerImg.setVisible(this.lives > 0 && blink).setX(Math.round(this.playerX));
    // HUD
    this.txtScore.setText(`SCORE ${this.score}`);
    this.txtBest.setText(`RECORD ${Math.max(this.best, this.score)}`);
    this.txtWave.setText(`WAVE ${this.level}`);
    this.txtLives.setText('♥'.repeat(Math.max(0, this.lives)));
    this.txtBanner.setText(`WAVE ${this.level}`).setVisible(this.banner > 0);
  }
}

