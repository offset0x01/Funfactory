/**
 * Logica pura del gioco del quindici (porting di puzzle15.py).
 *
 * Regola di risolvibilità per una griglia N x N (0 = buco):
 *   * larghezza dispari: risolvibile se le inversioni sono pari;
 *   * larghezza pari: risolvibile se inversioni + riga del buco contata dal
 *     basso (partendo da 1) è DISPARI.
 * La prima versione usava il test opposto, quindi ogni partita era impossibile.
 *
 * Approfondimento: https://it.wikipedia.org/wiki/Gioco_del_quindici
 */
import { shuffle as shuffleInPlace } from '../core/util.js';

export const SIZE = 4;
export const SOLVED = [...Array.from({ length: SIZE * SIZE - 1 }, (_, i) => i + 1), 0];

/** Coppie (a, b) con a prima di b ma a > b, ignorando il buco. */
export function inversions(tiles) {
  const nums = tiles.filter((t) => t);
  let inv = 0;
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) inv++;
  return inv;
}

export function isSolvable(tiles, size = SIZE) {
  const inv = inversions(tiles);
  if (size % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = size - Math.floor(tiles.indexOf(0) / size);
  return (inv + blankRowFromBottom) % 2 === 1;
}

export function isSolved(tiles) {
  return tiles.every((v, i) => v === (i === tiles.length - 1 ? 0 : i + 1));
}

/** Una disposizione casuale, risolvibile e non già risolta. */
export function shuffled(rng = Math.random, size = SIZE) {
  const tiles = [...Array.from({ length: size * size - 1 }, (_, i) => i + 1), 0];
  for (;;) {
    shuffleInPlace(rng, tiles);
    if (isSolvable(tiles, size) && !isSolved(tiles)) return [...tiles];
  }
}

/**
 * Fa scorrere la tessera in `index` (e quelle tra lei e il buco) verso il buco,
 * se sono sulla stessa riga o colonna. Modifica `tiles` sul posto.
 * @returns quante tessere si sono mosse (0 = mossa impossibile).
 */
export function slide(tiles, index, size = SIZE) {
  const blank = tiles.indexOf(0);
  const br = Math.floor(blank / size), bc = blank % size;
  const r = Math.floor(index / size), c = index % size;
  if (index === blank || (r !== br && c !== bc)) return 0;
  const step = r === br ? (c > bc ? 1 : -1) : (r > br ? size : -size);
  let moved = 0;
  let pos = blank;
  while (pos !== index) {
    const next = pos + step;
    [tiles[pos], tiles[next]] = [tiles[next], tiles[pos]];
    pos = next;
    moved++;
  }
  return moved;
}

/** Freccia: la tessera accanto al buco si sposta nella direzione (dx, dy). */
export function push(tiles, dx, dy, size = SIZE) {
  const blank = tiles.indexOf(0);
  const br = Math.floor(blank / size), bc = blank % size;
  const r = br - dy, c = bc - dx;   // la tessera che entrerà nel buco
  if (r >= 0 && r < size && c >= 0 && c < size) return slide(tiles, r * size + c, size);
  return 0;
}
