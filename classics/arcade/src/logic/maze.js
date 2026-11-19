/**
 * Generazione e soluzione dei labirinti (porting di maze_runner.py).
 *
 * * Labirinti "perfetti" (esattamente un percorso tra due celle qualsiasi),
 *   scavati con una ricerca in profondità iterativa (recursive backtracker).
 * * Il suggerimento usa una ricerca in ampiezza (BFS): il percorso più breve.
 *
 * Approfondimenti: https://en.wikipedia.org/wiki/Maze_generation_algorithm
 *                  https://it.wikipedia.org/wiki/Ricerca_in_ampiezza
 */
import { choice } from '../core/util.js';

export const DIFFICULTIES = [
  { label: 'SMALL  21 X 15', key: 'small', cols: 21, rows: 15, dark: false },
  { label: 'MEDIUM  31 X 21', key: 'medium', cols: 31, rows: 21, dark: false },
  { label: 'LARGE  41 X 29', key: 'large', cols: 41, rows: 29, dark: false },
  { label: 'DARK  31 X 21', key: 'dark', cols: 31, rows: 21, dark: true },
];

/**
 * Scava un labirinto perfetto. Le celle con coordinate pari sono "stanze",
 * le altre sono muri abbattuti tra stanze vicine. `cols` e `rows` diventano
 * dispari, così il bordo è sempre pieno. Restituisce una griglia di righe
 * con 1 = muro e 0 = pavimento.
 */
export function generateMaze(cols, rows, rng = Math.random) {
  if (cols % 2 === 0) cols += 1;
  if (rows % 2 === 0) rows += 1;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const stack = [[0, 0]];
  grid[0][0] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const neighbours = [[2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === 1);
    if (neighbours.length) {
      const [nx, ny] = choice(rng, neighbours);
      grid[(y + ny) / 2][(x + nx) / 2] = 0;
      grid[ny][nx] = 0;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }
  return grid;
}

/** BFS: le celle da `start` a `goal` (incluse), oppure [] se non raggiungibile. */
export function shortestPath(grid, start, goal) {
  const rows = grid.length, cols = grid[0].length;
  const key = ([x, y]) => y * cols + x;
  const cameFrom = new Map([[key(start), null]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur[0] === goal[0] && cur[1] === goal[1]) break;
    const [x, y] = cur;
    for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const [nx, ny] = n;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[ny][nx] === 0 && !cameFrom.has(key(n))) {
        cameFrom.set(key(n), cur);
        queue.push(n);
      }
    }
  }
  if (!cameFrom.has(key(goal))) return [];
  const path = [goal];
  while (key(path[path.length - 1]) !== key(start)) path.push(cameFrom.get(key(path[path.length - 1])));
  return path.reverse();
}
