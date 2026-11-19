/**
 * Dati e regole del Memory (porting di memory_game.py): dimensioni della
 * griglia, 12 icone in pixel-art 7x7 e distribuzione delle carte.
 */
import { sample, shuffle } from '../core/util.js';
import {
  NEON_RED, NEON_YELLOW, NEON_CYAN, NEON_GREEN, NEON_PURPLE, NEON_MAGENTA, NEON_ORANGE, NEON_BLUE, fromRgb,
} from '../core/palette.js';

export const HUD_H = 44;
export const GAP = 12;
export const FLIP_SPEED = 5;        // giri al secondo
export const MISMATCH_DELAY = 0.75; // secondi in cui le due carte sbagliate restano visibili

export const SIZES = [
  { label: 'EASY  4 X 3', key: 'easy', cols: 4, rows: 3 },
  { label: 'NORMAL  6 X 3', key: 'normal', cols: 6, rows: 3 },
  { label: 'HARD  6 X 4', key: 'hard', cols: 6, rows: 4 },
];

// Icone 7x7, ognuna con il suo colore
export const ICONS = {
  heart: [['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'], NEON_RED],
  star: [['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'], NEON_YELLOW],
  diamond: [['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'], NEON_CYAN],
  club: [['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'], NEON_GREEN],
  spade: [['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'], NEON_PURPLE],
  moon: [['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'], fromRgb(180, 200, 255)],
  note: [['...###.', '...#.##', '...#...', '...#...', '.###...', '####...', '.##....'], NEON_MAGENTA],
  bolt: [['...###.', '..###..', '.###...', '#######', '...###.', '..###..', '.##....'], NEON_ORANGE],
  smile: [['.#####.', '#######', '##.#.##', '#######', '#.###.#', '##...##', '.#####.'], fromRgb(200, 255, 60)],
  mushroom: [['..###..', '.#.#.#.', '#######', '#.###.#', '..#.#..', '..#.#..', '..###..'], fromRgb(255, 120, 170)],
  crown: [['#..#..#', '##.#.##', '#######', '#######', '#######', '.......', '#######'], fromRgb(255, 200, 40)],
  ghost: [['..###..', '.#####.', '##.#.##', '#######', '#######', '#######', '#.#.#.#'], NEON_BLUE],
};

/** Mescola le icone e dispone le carte in una griglia centrata. */
export function deal(size, rng = Math.random, W = 800, H = 600) {
  const pairs = (size.cols * size.rows) / 2;
  const names = shuffle(rng, sample(rng, Object.keys(ICONS), pairs).flatMap((n) => [n, n]));
  const card = Math.min(Math.floor((W - 80) / size.cols) - GAP, Math.floor((H - HUD_H - 70) / size.rows) - GAP, 130);
  const totalW = size.cols * card + (size.cols - 1) * GAP;
  const totalH = size.rows * card + (size.rows - 1) * GAP;
  const ox = Math.floor((W - totalW) / 2);
  const oy = HUD_H + Math.floor((H - HUD_H - totalH) / 2);
  const cards = [];
  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      cards.push({
        icon: names[r * size.cols + c],
        rect: { x: ox + c * (card + GAP), y: oy + r * (card + GAP), w: card, h: card },
        faceUp: false, matched: false, flip: 0, glow: 0, wrong: false,
      });
    }
  }
  return cards;
}
