/**
 * Logica pura di Pong, Breakout e Space Invaders (le parti testabili):
 * previsione della traiettoria della palla, collisione cerchio-rettangolo,
 * livelli di Breakout, sprite e scudi distruttibili di Space Invaders.
 */
import {
  NEON_RED, NEON_ORANGE, NEON_YELLOW, NEON_GREEN, NEON_CYAN, NEON_BLUE, NEON_PURPLE, NEON_MAGENTA,
} from '../core/palette.js';

// ============================================================================
// Pong
// ============================================================================

export const PONG = {
  TOP: 14, BOTTOM: 600 - 14, PADDLE_W: 12, PADDLE_H: 90, PADDLE_X_MARGIN: 34, PADDLE_SPEED: 470,
  BALL_R: 8, BALL_START_SPEED: 380, BALL_MAX_SPEED: 950, SPEEDUP: 1.06,
  MAX_BOUNCE_ANGLE: (60 * Math.PI) / 180, WIN_SCORE: 11, SERVE_DELAY: 1,
};

/** Profili della CPU: velocità massima, errore di mira, tempo di reazione. */
export const AI_LEVELS = [
  { speed: 260, error: 70, reaction: 0.28 },
  { speed: 390, error: 34, reaction: 0.12 },
  { speed: 560, error: 10, reaction: 0.04 },
];

/**
 * Dove attraverserà la palla la linea x = targetX? I rimbalzi sui muri
 * vengono "srotolati": la traiettoria è una retta in uno spazio specchiato,
 * poi ripiegata in [top, bottom] con un modulo. Se non ci arriva: il centro.
 */
export function predictY(x, y, vx, vy, targetX, top = PONG.TOP + PONG.BALL_R, bottom = PONG.BOTTOM - PONG.BALL_R) {
  if (vx === 0 || (targetX - x) / vx < 0) return (top + bottom) / 2;
  const t = (targetX - x) / vx;
  const span = bottom - top;
  let py = (((y + vy * t - top) % (2 * span)) + 2 * span) % (2 * span);
  if (py > span) py = 2 * span - py;
  return top + py;
}

// ============================================================================
// Breakout
// ============================================================================

export const BREAKOUT = {
  HUD_H: 44, PADDLE_W: 104, PADDLE_W_WIDE: 156, PADDLE_H: 14, PADDLE_Y: 600 - 48, PADDLE_SPEED: 620,
  BALL_R: 7, BALL_SPEED: 340, BALL_SPEED_MAX: 640, MAX_ANGLE: (65 * Math.PI) / 180,
  START_LIVES: 3, MAX_LIVES: 5, POWERUP_CHANCE: 0.12, POWERUP_SPEED: 150, MAX_BALLS: 8,
  BRICK_COLS: 10, BRICK_W: 68, BRICK_H: 22, BRICK_GAP: 4,
};
BREAKOUT.FIELD = { x: 16, y: BREAKOUT.HUD_H + 4, w: 800 - 32, h: 600 - BREAKOUT.HUD_H - 4 };
BREAKOUT.BRICKS_X = Math.floor((800 - (BREAKOUT.BRICK_COLS * BREAKOUT.BRICK_W - BREAKOUT.BRICK_GAP)) / 2);
BREAKOUT.BRICKS_Y = BREAKOUT.HUD_H + 40;

export const ROW_COLORS = [NEON_RED, NEON_ORANGE, NEON_YELLOW, NEON_GREEN, NEON_CYAN, NEON_BLUE, NEON_PURPLE];

// '.' = vuoto, cifre = colpi necessari
export const LEVELS = [
  ['2222222222', '2222222222', '1111111111', '1111111111', '1111111111'],
  ['...1111...', '..122221..', '.12333321.', '..122221..', '...1111...'],
  ['1.1.1.1.1.', '.2.2.2.2.2', '3.3.3.3.3.', '.2.2.2.2.2', '1.1.1.1.1.'],
  ['3333333333', '1........1', '1.222222.1', '1.2.33.2.1', '1.222222.1', '1........1'],
  ['1........1', '21......12', '321....123', '2321..1232', '1232112321', '3333333333'],
];

/** Mattoni del livello (da 1; dopo il quinto i livelli ricominciano). */
export function buildBricks(level) {
  const B = BREAKOUT;
  const layout = LEVELS[(level - 1) % LEVELS.length];
  const bricks = [];
  layout.forEach((line, row) => [...line.slice(0, B.BRICK_COLS)].forEach((ch, col) => {
    if (/[1-9]/.test(ch)) {
      const hp = Number(ch);
      bricks.push({
        x: B.BRICKS_X + col * B.BRICK_W, y: B.BRICKS_Y + row * (B.BRICK_H + B.BRICK_GAP),
        w: B.BRICK_W - B.BRICK_GAP, h: B.BRICK_H, hp, maxHp: hp, color: ROW_COLORS[row % ROW_COLORS.length],
      });
    }
  }));
  return bricks;
}

/** true se il cerchio (x, y, r) si sovrappone al rettangolo. */
export function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

// ============================================================================
// Space Invaders
// ============================================================================

export const SPRITES = {
  squid: [
    ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
    ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
  ],
  crab: [
    ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########',
      '#.#######.#', '#.#.....#.#', '...##.##...'],
    ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########',
      '.#########.', '..#.....#..', '.#.......#.'],
  ],
  octopus: [
    ['....####....', '.##########.', '############', '###..##..###', '############',
      '...##..##...', '..##.##.##..', '##........##'],
    ['....####....', '.##########.', '############', '###..##..###', '############',
      '..###..###..', '.##..##..##.', '..##....##..'],
  ],
};
export const PLAYER_ART = ['......#......', '.....###.....', '.....###.....', '.###########.',
  '#############', '#############', '#############', '#############'];
export const UFO_ART = ['.....######.....', '...##########...', '..############..', '.##.##.##.##.##.',
  '################', '..###..##..###..', '...#........#...'];
export const EXPLOSION_ART = ['#...#...#', '.#..#..#.', '..#...#..', '##.....##', '..#...#..',
  '.#..#..#.', '#...#...#'];
export const BUNKER_ART = ['....############....', '...##############...', '..################..',
  '.##################.', '####################', '####################',
  '####################', '####################', '####################',
  '######........######', '#####..........#####', '####............####',
  '####............####'];

export const ROW_TYPES = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
export const TYPE_POINTS = { squid: 30, crab: 20, octopus: 10 };
export const TYPE_COLORS = { squid: NEON_MAGENTA, crab: NEON_CYAN, octopus: NEON_GREEN };
export const BUNKER_CELL = 4;

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Scudo distruttibile fatto di piccole celle quadrate. */
export class Bunker {
  constructor(x, y, rng = Math.random) {
    this.x = x;
    this.y = y;
    this.rng = rng;
    this.cells = new Set();
    BUNKER_ART.forEach((row, cy) => [...row].forEach((ch, cx) => { if (ch === '#') this.cells.add(`${cx},${cy}`); }));
    this.dirty = true;   // la grafica va ridisegnata
  }

  get bounds() {
    return { x: this.x, y: this.y, w: BUNKER_ART[0].length * BUNKER_CELL, h: BUNKER_ART.length * BUNKER_CELL };
  }

  cellRect(cx, cy) { return { x: this.x + cx * BUNKER_CELL, y: this.y + cy * BUNKER_CELL, w: BUNKER_CELL, h: BUNKER_CELL }; }

  /** Erode le celle toccate da `rect`. Restituisce true se ha colpito qualcosa. */
  hit(rect, splash = 2) {
    if (!this.cells.size || !overlap(rect, this.bounds)) return false;
    const touched = [...this.cells].map((k) => k.split(',').map(Number)).filter(([cx, cy]) => overlap(this.cellRect(cx, cy), rect));
    if (!touched.length) return false;
    for (const [cx, cy] of touched) {
      for (let dx = -splash; dx <= splash; dx++) {
        for (let dy = -splash; dy <= splash; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= splash && this.rng() < 0.65) this.cells.delete(`${cx + dx},${cy + dy}`);
        }
      }
      this.cells.delete(`${cx},${cy}`);
    }
    this.dirty = true;
    return true;
  }
}

export { overlap as rectsOverlap };
