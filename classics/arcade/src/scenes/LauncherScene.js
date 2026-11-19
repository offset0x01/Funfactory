/**
 * LauncherScene — il menu principale in stile synthwave.
 *
 * Porting 1:1 del launcher Python (retro_arcade_interface.py):
 *   * cielo sfumato, stelle che brillano, griglia prospettica che scorre;
 *   * titoli in pixel-art con alone neon;
 *   * 9 tessere con miniature (anima solo quella selezionata);
 *   * pannello informativo con descrizione, comandi e record;
 *   * crediti scorrevoli, ultimo gioco ricordato, avvio diretto con 1-9,
 *     M audio on/off, V filtro CRT, F11 schermo intero.
 * Su smartphone e tablet: si tocca la tessera; crediti, audio e CRT hanno
 * i loro pulsanti nel gamepad virtuale.
 */
import Phaser from '../lib/phaser.esm.min.js';
import Audio from '../shared/Audio.js';
import Settings from '../shared/Settings.js';
import { openMenu } from '../shared/Menu.js';
import { GAMES } from '../shared/catalog.js';
import { ptext, gfxText } from '../shared/PixelText.js';
import { drawPanel, drawBitmap } from '../shared/Draw.js';
import { useTouchLayout, SYS, onInputChange, isTouchUI } from '../shared/SceneKit.js';
import { getStore } from '../core/scores.js';
import {
  W, H, WHITE, TEXT, TEXT_DIM, BG_DARK, NEON_CYAN, NEON_MAGENTA, NEON_YELLOW, NEON_GREEN,
  NEON_RED, NEON_BLUE, NEON_ORANGE, NEON_PURPLE, css, lerpColor, fromRgb,
} from '../core/palette.js';

export const VERSION = '3.0.0';

// ─── Layout ─────────────────────────────────────────────────────────────────
const COLS = 3;
const TILE_W = 210, TILE_H = 112;
const GAP_X = 22, GAP_Y = 14;
const GRID_X = Math.floor((W - (COLS * TILE_W + (COLS - 1) * GAP_X)) / 2);
const GRID_Y = 98;
const INFO = { x: GRID_X, y: GRID_Y + 3 * TILE_H + 2 * GAP_Y + 10, w: COLS * TILE_W + (COLS - 1) * GAP_X, h: 98 };
const HORIZON_Y = 300;
const CREDITS_AREA = { x: 60, y: 90, w: W - 120, h: H - 150 };
const FONT = 'ui-monospace, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

export const tileRects = () => GAMES.map((_, i) => ({
  x: GRID_X + (i % COLS) * (TILE_W + GAP_X),
  y: GRID_Y + Math.floor(i / COLS) * (TILE_H + GAP_Y),
  w: TILE_W, h: TILE_H,
}));

const CREDITS = [
  ['h', 'RETRO ARCADE COLLECTION'],
  ['t', `Version ${VERSION} · web edition`],
  ['s', ''],
  ['h', 'CREATED BY'],
  ['t', 'Sir Alfry  (Alfredo De Donno)'],
  ['s', ''],
  ['h', 'TECHNOLOGY'],
  ['t', 'JavaScript (ES Modules)  ·  Phaser 4'],
  ['t', 'Sound effects made live in the browser (Web Audio)'],
  ['t', 'Hand-drawn 5x7 pixel font'],
  ['t', 'Smart CPU player (Minimax / Alpha-Beta)'],
  ['t', 'On-screen touch pad  ·  works offline (PWA)'],
  ['s', ''],
  ['h', 'THE GAMES'],
  ...GAMES.map((g) => ['t', g.name]),
  ['s', ''],
  ['h', 'SOURCE CODE'],
  ['t', 'github.com/sirAlfry'],
  ['s', ''],
  ['h', 'THANKS FOR PLAYING!'],
  ['s', ''], ['s', ''],
];

// ─── Miniature (t = tempo di animazione; 0 = immagine ferma) ─────────────────
const ALIEN = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.',
  '###########', '#.#######.#', '#.#.....#.#', '...##.##...'];

function thumbTris(g, r, t) {
  const cw = Math.floor(r.w / 3), ch = Math.floor(r.h / 3);
  g.lineStyle(2, fromRgb(60, 110, 200), 1);
  for (const i of [1, 2]) {
    g.lineBetween(r.x + i * cw, r.y + 4, r.x + i * cw, r.y + r.h - 4);
    g.lineBetween(r.x + 6, r.y + i * ch, r.x + r.w - 6, r.y + i * ch);
  }
  const marks = [[0, 0, 'X'], [1, 1, 'O'], [2, 0, 'X'], [0, 2, 'O'], [2, 2, 'X']];
  const shown = t === 0 ? marks.length : Math.floor(t * 2) % (marks.length + 3);
  for (const [col, row, m] of marks.slice(0, shown)) {
    const cx = r.x + col * cw + cw / 4, cy = r.y + row * ch + 4;
    const w = cw / 2, h = ch - 8;
    if (m === 'X') {
      g.lineStyle(3, NEON_RED, 1);
      g.lineBetween(cx, cy, cx + w, cy + h);
      g.lineBetween(cx + w, cy, cx, cy + h);
    } else {
      g.lineStyle(3, NEON_BLUE, 1);
      g.strokeCircle(cx + w / 2, cy + h / 2, Math.min(w, h) / 2);
    }
  }
}

function thumbSnake(g, r, t) {
  const seg = 10, cols = Math.floor(r.w / seg);
  const head = t ? Math.floor(t * 8) % cols : Math.floor(cols / 2);
  const y = r.y + r.h / 2;
  for (let i = 0; i < 7; i++) {
    const x = r.x + (((head - i) % cols) + cols) % cols * seg;
    g.fillStyle(lerpColor(fromRgb(120, 255, 120), fromRgb(20, 110, 40), i / 7), 1);
    g.fillRoundedRect(x, y - seg / 2, seg - 1, seg - 1, 3);
  }
  g.fillStyle(NEON_RED, 1); g.fillCircle(r.x + r.w - 26, r.y + 14, 5);
  g.fillStyle(NEON_BLUE, 1); g.fillCircle(r.x + 24, r.y + r.h - 12, 4);
}

function thumbTetris(g, r, t) {
  const c = 10;
  const stack = [[0, 5, NEON_RED], [1, 5, NEON_RED], [2, 5, NEON_YELLOW], [3, 5, NEON_YELLOW],
    [5, 5, NEON_GREEN], [6, 5, NEON_GREEN], [7, 5, NEON_BLUE], [8, 5, NEON_BLUE],
    [0, 4, NEON_PURPLE], [1, 4, NEON_PURPLE], [6, 4, NEON_ORANGE], [7, 4, NEON_ORANGE]];
  const ox = r.x + r.w / 2 - 5 * c, oy = r.y + r.h - 6 * c - 2;
  for (const [x, y, col] of stack) { g.fillStyle(col, 1); g.fillRect(ox + x * c, oy + y * c, c - 1, c - 1); }
  const fall = t ? Math.floor(t * 4) % 6 : 2;
  g.fillStyle(NEON_CYAN, 1);
  for (let y = 0; y < 4; y++) {
    const py = oy + (y + fall - 4) * c;
    if (py >= r.y) g.fillRect(ox + 4 * c, py, c - 1, c - 1);
  }
}

function thumbPong(g, r, t) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  g.fillStyle(fromRgb(90, 90, 130), 1);
  for (let y = r.y + 4; y < r.y + r.h - 4; y += 10) g.fillRect(cx - 1, y, 2, 5);
  const bx = t ? cx + Math.sin(t * 2.5) * (r.w / 2 - 22) : cx + 30;
  const by = t ? cy + Math.sin(t * 3.7) * (r.h / 2 - 8) : cy - 10;
  const clampY = (v) => Math.max(r.y + 12, Math.min(r.y + r.h - 12, v));
  const leftY = clampY(bx < cx ? by : cy), rightY = clampY(bx >= cx ? by : cy);
  g.fillStyle(WHITE, 1);
  g.fillRect(r.x + 8, leftY - 12, 4, 24);
  g.fillRect(r.x + r.w - 12, rightY - 12, 4, 24);
  g.fillCircle(bx, by, 4);
}

function thumbBreakout(g, r, t) {
  const colors = [NEON_RED, NEON_ORANGE, NEON_YELLOW, NEON_GREEN];
  const bw = Math.floor((r.w - 8) / 8);
  colors.forEach((col, row) => {
    for (let i = 0; i < 8; i++) {
      if (t && (i + row * 3 + Math.floor(t * 3)) % 11 === 0) continue;
      g.fillStyle(col, 1);
      g.fillRect(r.x + 4 + i * bw, r.y + 4 + row * 8, bw - 2, 6);
    }
  });
  const px = r.x + r.w / 2 + (t ? Math.sin(t * 2) * 50 : 0);
  g.fillStyle(TEXT, 1); g.fillRoundedRect(px - 18, r.y + r.h - 8, 36, 5, 2);
  const bounce = t ? Math.abs(Math.sin(t * 4)) * 14 : 0;
  g.fillStyle(WHITE, 1); g.fillCircle(px + 10, r.y + r.h - 22 - bounce, 3);
}

function thumbInvaders(g, r, t) {
  const sway = t ? Math.round(Math.sin(t * 2) * 12) : 0;
  for (let k = 0; k < 3; k++) drawBitmap(g, ALIEN, r.x + 26 + k * 52 + sway, r.y + 8, 3, k === 1 ? NEON_MAGENTA : NEON_GREEN);
  const sx = r.x + r.w / 2 + (t ? Math.sin(t * 1.3) * 60 : 0);
  const b = r.y + r.h;
  g.fillStyle(NEON_CYAN, 1);
  g.fillTriangle(sx, b - 16, sx - 9, b - 4, sx + 9, b - 4);
  if (t) { g.fillStyle(NEON_YELLOW, 1); g.fillRect(sx - 1, b - 20 - Math.floor((t * 120) % 40), 2, 6); }
}

const MAZE_ART = ['#############', '#...#.......#', '#.#.#.#####.#', '#.#...#...#.#',
  '#.#####.#.#.#', '#.......#..E#', '#############'];
const MAZE_PATH = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
  [7, 4], [7, 3], [8, 3], [9, 3], [9, 4], [9, 5], [10, 5]];

function thumbMaze(g, r, t) {
  const c = 9;
  const ox = Math.round(r.x + r.w / 2 - (MAZE_ART[0].length * c) / 2);
  const oy = Math.round(r.y + r.h / 2 - (MAZE_ART.length * c) / 2);
  MAZE_ART.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') { g.fillStyle(fromRgb(40, 110, 230), 1); g.fillRect(ox + x * c, oy + y * c, c - 1, c - 1); }
    else if (ch === 'E') { g.fillStyle(NEON_GREEN, 1); g.fillRect(ox + x * c + 1, oy + y * c + 1, c - 3, c - 3); }
  }));
  const step = t ? Math.floor(t * 6) % MAZE_PATH.length : 0;
  g.fillStyle(fromRgb(70, 70, 120), 1);
  for (const [px, py] of MAZE_PATH.slice(0, step)) g.fillRect(ox + px * c + 3, oy + py * c + 3, c - 7, c - 7);
  const [px, py] = MAZE_PATH[step];
  g.fillStyle(NEON_YELLOW, 1); g.fillRect(ox + px * c + 1, oy + py * c + 1, c - 3, c - 3);
}

function thumbMemory(g, r, t) {
  const colors = [NEON_RED, NEON_BLUE, NEON_GREEN, NEON_YELLOW];
  const size = 26, gap = 8;
  const ox = r.x + r.w / 2 - (4 * size + 3 * gap) / 2;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x = ox + i * (size + gap);
      const y = r.y + r.h / 2 - size - gap / 2 + row * (size + gap);
      const phase = Math.cos(t * 2 + i + row * 2);
      const w = Math.max(2, Math.round(size * (t ? Math.abs(phase) : 1)));
      const rx = x + (size - w) / 2;
      const faceUp = t ? phase > 0 : (i + row) % 2 === 0;
      if (faceUp) {
        g.fillStyle(fromRgb(230, 230, 240), 1); g.fillRoundedRect(rx, y, w, size, Math.min(3, w / 2));
        g.fillStyle(colors[(i + row) % 4], 1); g.fillCircle(rx + w / 2, y + size / 2, Math.max(1, Math.floor(w / 4)));
      } else {
        g.fillStyle(fromRgb(90, 50, 150), 1); g.fillRoundedRect(rx, y, w, size, Math.min(3, w / 2));
        g.lineStyle(1, NEON_MAGENTA, 1); g.strokeRoundedRect(rx, y, w, size, Math.min(3, w / 2));
      }
    }
  }
}

function thumbPuzzle(g, r, t) {
  const tile = 15, gap = 2;
  const ox = Math.round(r.x + r.w / 2 - (4 * tile + 3 * gap) / 2);
  const oy = Math.round(r.y + r.h / 2 - (4 * tile + 3 * gap) / 2);
  const slide = t ? Math.sin(t * 2) * 0.5 + 0.5 : 0;
  for (let n = 0; n < 15; n++) {
    const row = Math.floor(n / 4), col = n % 4;
    let x = ox + col * (tile + gap);
    const y = oy + row * (tile + gap);
    if (n === 14) x += Math.round(slide * (tile + gap));
    g.fillStyle(fromRgb(70, 70, 110), 1);
    g.fillRoundedRect(x, y, tile, tile, 2);
    gfxText(g, String(n + 1), x + tile / 2 + 0.5, y + tile / 2 + 0.5, 1, NEON_YELLOW, 'center');
  }
}

const THUMBS = [thumbTris, thumbSnake, thumbTetris, thumbPong, thumbBreakout, thumbInvaders, thumbMaze, thumbMemory, thumbPuzzle];

// ─── Scena ──────────────────────────────────────────────────────────────────

export default class LauncherScene extends Phaser.Scene {
  constructor() { super({ key: 'LauncherScene' }); }

  create() {
    // Phaser riusa la stessa istanza a ogni avvio: tutto lo stato si reimposta qui
    this.store = getStore();
    this.rects = tileRects();
    this.state = 'main';
    this.time0 = 0;
    this.scroll = 0;
    this.creditsScroll = 0;
    this.launching = false;
    this.modal = false;
    const last = Number(this.store.getSetting('last_game', 0));
    this.selected = Number.isInteger(last) && last >= 0 ? last % GAMES.length : 0;
    this.records = this.store.load();

    this.buildBackground();
    this.buildTitle();
    this.buildTiles();
    this.buildInfoPanel();
    this.buildFooter();
    this.buildCredits();
    this.setupInput();
    this.refresh();

    this.cameras.main.setBackgroundColor(BG_DARK);
    this.cameras.main.fadeIn(250, 10, 8, 24);

    useTouchLayout(this, { system: [SYS.info('KeyC'), SYS.sound('KeyM'), SYS.crt('KeyV')] });
    onInputChange(this, () => this.refresh());
    const offSettings = Settings.on((type) => { if (type === 'change') this.refresh(); });
    this.events.once('shutdown', offSettings);

    // Un gioco si è interrotto per un errore? Lo diciamo invece di bloccare tutto.
    const crash = this.registry.get('lastCrash');
    if (crash) {
      this.registry.remove('lastCrash');
      this.time.delayedCall(300, () => this.messageBox('OOPS!', [
        `${crash.game} stopped because of an error:`,
        crash.message.slice(0, 58),
        'Details are in the browser console (F12).',
      ]));
    }
  }

  // ─── Costruzione ──────────────────────────────────────────────────────────

  buildBackground() {
    const key = '__synthwave_sky';
    if (!this.textures.exists(key)) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const top = fromRgb(6, 4, 20), mid = fromRgb(46, 10, 66), bottom = fromRgb(12, 4, 26);
      for (let y = 0; y < H; y++) {
        const col = y < HORIZON_Y
          ? lerpColor(top, mid, (y / HORIZON_Y) ** 1.6)
          : lerpColor(mid, bottom, ((y - HORIZON_Y) / (H - HORIZON_Y)) ** 0.6);
        ctx.fillStyle = css(col);
        ctx.fillRect(0, y, W, 1);
      }
      ctx.fillStyle = css(fromRgb(255, 80, 200));
      ctx.fillRect(0, HORIZON_Y - 1, W, 2);
      this.textures.addCanvas(key, c);
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    // Stelle con seme fisso: stesso cielo a ogni avvio
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.floor(rnd() * W), y: Math.floor(rnd() * (HORIZON_Y - 10)),
      phase: rnd() * Math.PI * 2, size: rnd() < 0.75 ? 1 : 2,
    }));
    this.gBack = this.add.graphics().setDepth(1);
  }

  buildTitle() {
    this.title = ptext(this, W / 2, 34, 'RETRO ARCADE', 4, NEON_CYAN, 'center', { glow: true }).setDepth(5);
    this.subtitle = ptext(this, W / 2, 72, 'COLLECTION', 3, NEON_MAGENTA, 'center', { glow: true }).setDepth(5);
    this.version = ptext(this, 10, 8, `V${VERSION}`, 1, fromRgb(110, 90, 160)).setDepth(5);
    this.fps = ptext(this, W - 10, 8, '', 1, fromRgb(110, 200, 120), 'topright').setDepth(5);
  }

  buildTiles() {
    this.gTiles = this.add.graphics().setDepth(3);
    this.labels = this.rects.map((r, i) => ptext(this, r.x + 12, r.y + r.h - 17, GAMES[i].name.toUpperCase(), 2, TEXT_DIM, 'midleft').setDepth(4));
    this.stars2 = this.rects.map((r) => ptext(this, r.x + r.w - 12, r.y + r.h - 17, '★', 2, NEON_YELLOW, 'midright').setDepth(4));
    this.numbers = this.rects.map((r, i) => ptext(this, r.x + r.w - 8, r.y + 6, String(i + 1), 1, fromRgb(110, 90, 160), 'topright').setDepth(4));
  }

  buildInfoPanel() {
    this.gInfo = this.add.graphics().setDepth(6);
    this.infoName = ptext(this, INFO.x + 16, INFO.y + 12, '', 3, WHITE).setDepth(7);
    this.infoRecord = ptext(this, INFO.x + INFO.w - 16, INFO.y + 16, '', 2, NEON_YELLOW, 'topright').setDepth(7);
    this.infoDesc = this.add.text(INFO.x + 16, INFO.y + 38, '', { fontFamily: FONT, fontSize: '15px', color: css(TEXT) }).setDepth(7);
    this.infoCtrl = [0, 1].map((k) => this.add.text(INFO.x + 16, INFO.y + 59 + k * 16, '', {
      fontFamily: FONT, fontSize: '13px', color: css(TEXT_DIM),
    }).setDepth(7));
  }

  buildFooter() {
    this.footer = ptext(this, W / 2, H - 14, '', 1, TEXT_DIM, 'center').setDepth(7);
  }

  buildCredits() {
    this.creditsLayer = this.add.container(0, 0).setDepth(20).setVisible(false);
    const g = this.add.graphics();
    drawPanel(g, CREDITS_AREA.x, CREDITS_AREA.y, CREDITS_AREA.w, CREDITS_AREA.h, NEON_PURPLE, 200 / 255);
    const title = ptext(this, W / 2, 44, 'CREDITS', 5, NEON_YELLOW, 'center', { glow: true });
    this.creditsHint = ptext(this, W / 2, H - 30, '', 2, TEXT_DIM, 'center');
    this.creditItems = CREDITS.map(([kind, text]) => {
      if (kind === 'h') return ptext(this, W / 2, 0, text, 3, NEON_CYAN, 'midtop');
      return this.add.text(W / 2, 0, text, { fontFamily: FONT, fontSize: '17px', color: css(TEXT) }).setOrigin(0.5, 0);
    });
    this.creditsLayer.add([g, title, this.creditsHint, ...this.creditItems]);
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  setupInput() {
    const kb = this.input.keyboard;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    kb.on('keydown', (e) => this.onKey(e));
    this.input.on('pointermove', (p) => {
      if (this.state !== 'main' || this.modal || this.launching) return;
      const i = this.hitTile(p);
      if (i >= 0 && i !== this.selected) { this.selected = i; Audio.play('move', 0.4); this.refresh(); }
    });
    this.input.on('pointerdown', (p) => {
      if (this.modal || this.launching) return;
      if (this.state === 'credits') { this.closeCredits(); return; }
      const i = this.hitTile(p);
      if (i >= 0) this.launch(i);
    });
    this.events.once('shutdown', () => { kb.removeAllListeners('keydown'); this.input.removeAllListeners(); });
  }

  hitTile(p) {
    return this.rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  }

  onKey(e) {
    if (this.modal || this.launching) return;
    const code = e.code;
    if (this.state === 'credits') {
      if (!e.repeat && ['Escape', 'KeyB', 'KeyC', 'Enter', 'Space'].includes(code)) this.closeCredits();
      return;
    }
    if (e.repeat && !code.startsWith('Arrow')) return;
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.launch(this.selected);
    else if (code === 'ArrowRight' || code === 'KeyD') this.moveSelection(1, 0);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.moveSelection(-1, 0);
    else if (code === 'ArrowDown' || code === 'KeyS') this.moveSelection(0, 1);
    else if (code === 'ArrowUp' || code === 'KeyW') this.moveSelection(0, -1);
    else if (code === 'KeyC') this.openCredits();
    else if (code === 'KeyM') Settings.toggleSound();
    else if (code === 'KeyV') { Settings.toggleCrt(); Audio.play('select'); }
    else if (/^(Digit|Numpad)[1-9]$/.test(code)) {
      const idx = Number(code.slice(-1)) - 1;
      if (idx < GAMES.length) this.launch(idx);
    }
  }

  moveSelection(dc, dr) {
    const rows = Math.ceil(GAMES.length / COLS);
    const col = ((this.selected % COLS) + dc + COLS) % COLS;
    const row = ((Math.floor(this.selected / COLS)) + dr + rows) % rows;
    this.selected = Math.min(GAMES.length - 1, row * COLS + col);
    Audio.play('move');
    this.refresh();
  }

  openCredits() {
    Audio.play('select');
    this.state = 'credits';
    this.creditsScroll = CREDITS_AREA.h - 24;   // prime righe subito visibili
    this.creditsLayer.setVisible(true);
    this.refresh();
  }

  closeCredits() {
    Audio.play('back');
    this.state = 'main';
    this.creditsLayer.setVisible(false);
    this.refresh();
  }

  async messageBox(title, lines) {
    this.modal = true;
    await openMenu(this, { title, info: lines, options: [{ label: 'OK', value: 'ok' }], cancelValue: 'ok', titleColor: NEON_ORANGE });
    this.modal = false;
  }

  /** Dissolvenza in nero e avvio del gioco. */
  launch(index) {
    if (this.launching) return;   // doppio clic / INVIO ripetuto: un solo gioco
    this.launching = true;
    this.selected = index;
    this.store.setSetting('last_game', index);
    Audio.play('launch');
    this.refresh();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start(GAMES[index].scene));
  }

  // ─── Disegno ──────────────────────────────────────────────────────────────

  refresh() {
    const game = GAMES[this.selected];
    const main = this.state === 'main';
    this.labels.forEach((l, i) => l.setColor(i === this.selected ? WHITE : TEXT_DIM));
    this.stars2.forEach((s, i) => s.setVisible(!!GAMES[i].record(this.records)));
    // pannello informativo
    this.gInfo.clear();
    drawPanel(this.gInfo, INFO.x, INFO.y, INFO.w, INFO.h, game.accent, 215 / 255, 10);
    this.infoName.setText(game.name.toUpperCase()).setColor(game.accent);
    this.infoRecord.setText(game.record(this.records) || 'NO RECORD... YET!');
    this.infoDesc.setText(game.description);
    const ctrl = isTouchUI() ? game.touch : game.controls;
    this.infoCtrl.forEach((t, k) => t.setText(ctrl[k] || ''));
    this.footer.setText(isTouchUI()
      ? `TAP A GAME TO START · BUTTONS: CREDITS · SOUND ${Settings.sound ? 'ON' : 'OFF'} · RETRO`
      : `↑↓←→ PICK · ENTER PLAY · 1-9 QUICK START · C CREDITS · M SOUND ${Settings.sound ? 'ON' : 'OFF'} · V RETRO SCREEN · F11 FULL SCREEN`);
    this.creditsHint.setText(isTouchUI() ? 'TAP TO GO BACK TO THE MENU' : 'ESC / B / C: BACK TO THE MENU');
    // nel menu crediti si vede solo lo sfondo + il pannello dei crediti
    [this.title, this.subtitle, this.gTiles, this.gInfo, this.infoName, this.infoRecord, this.infoDesc,
      ...this.infoCtrl, this.footer, ...this.labels, ...this.numbers].forEach((o) => o.setVisible(main));
    this.stars2.forEach((s, i) => s.setVisible(main && !!GAMES[i].record(this.records)));
  }

  drawBackground(t) {
    const g = this.gBack;
    g.clear();
    for (const s of this.stars) {
      const b = Math.round(120 + 120 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.phase)));
      g.fillStyle(fromRgb(b, b, Math.min(255, b + 30)), 1);
      g.fillRect(s.x, s.y, s.size, s.size);
    }
    const grid = fromRgb(150, 40, 170);
    g.lineStyle(1, grid, 1);
    const depth = H - HORIZON_Y;
    for (let i = 0; i < 14; i++) {     // orizzontali: spaziatura prospettica, verso chi guarda
      const z = (i + this.scroll) / 14;
      const y = Math.round(HORIZON_Y + depth * z * z) + 0.5;
      g.lineBetween(0, y, W, y);
    }
    const vx = W / 2;
    for (let i = -12; i <= 12; i++) g.lineBetween(vx + i * 18, HORIZON_Y, vx + i * 130, H);   // verso il punto di fuga
  }

  drawTiles(t) {
    const g = this.gTiles;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const order = [...this.rects.keys()].filter((i) => i !== this.selected).concat(this.selected);
    for (const i of order) {
      const r = this.rects[i];
      const sel = i === this.selected;
      if (sel) {   // alone magenta pulsante
        for (let k = 0; k < 6; k++) {
          const alpha = ((14 + 14 * pulse) * (1 - k / 6)) / 255;
          const m = 18 - k * 3;
          g.fillStyle(NEON_MAGENTA, alpha);
          g.fillRoundedRect(r.x - m, r.y - m, r.w + 2 * m, r.h + 2 * m, 22 - k * 3);
        }
      }
      g.fillStyle(fromRgb(12, 8, 30), 235 / 255);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 12);
      const th = { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 40 };
      g.fillStyle(fromRgb(4, 2, 12), 1);
      g.fillRoundedRect(th.x, th.y, th.w, th.h, 6);
      THUMBS[i](g, th, sel ? t : 0);
      g.lineStyle(sel ? 3 : 2, sel ? NEON_CYAN : fromRgb(70, 45, 120), 1);
      g.strokeRoundedRect(r.x, r.y, r.w, r.h, 12);
    }
  }

  drawCredits(dt) {
    this.creditsScroll += dt * 45;
    const a = CREDITS_AREA;
    const lineH = 30;
    const total = CREDITS.length * lineH;
    const start = a.y + a.h - (this.creditsScroll % (total + a.h));
    const top = a.y + 10, bottom = a.y + a.h - 10;
    this.creditItems.forEach((item, k) => {
      const y = Math.round(start + k * lineH + (CREDITS[k][0] === 't' ? 2 : 0));
      const h = item.height || 20;
      const visible = y >= top && y + h <= bottom;
      item.setVisible(visible);
      if (!visible) return;
      const fade = Math.min(1, (y - top) / 24, (bottom - (y + h)) / 24);   // sfumano ai bordi
      item.setY(y).setAlpha(Math.max(0, fade));
    });
  }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.time0 += dt;
    this.scroll = (this.scroll + dt * 0.35) % 1;
    this.drawBackground(this.time0);
    if (this.state === 'credits') {
      this.drawCredits(dt);
    } else {
      this.drawTiles(this.time0);
    }
    this.fpsTimer = (this.fpsTimer || 0) + dt;
    if (this.fpsTimer >= 0.5) { this.fpsTimer = 0; this.fps.setText(`${Math.round(this.game.loop.actualFps)} FPS`); }
  }
}
