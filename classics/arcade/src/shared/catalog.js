/**
 * Catalogo dei giochi: un'unica tabella da cui derivano le tessere del
 * launcher, il pannello informativo, i record e l'avvio delle scene
 * (come la tupla GAMES di retro_arcade_interface.py).
 *
 * Aggiungere un decimo gioco = aggiungere una riga qui + la sua scena in main.js.
 */
import { formatTime } from '../core/util.js';
import {
  NEON_BLUE, NEON_GREEN, NEON_PURPLE, NEON_CYAN, NEON_ORANGE, NEON_MAGENTA, NEON_YELLOW,
} from '../core/palette.js';

const rec = (key, label = 'RECORD') => (s) => (s[key] ? `${label} ${s[key]}` : null);

function recTris(s) {
  const x = s.tris_x || 0, o = s.tris_o || 0, d = s.tris_draw || 0;
  return x || o || d ? `X ${x}  O ${o}  DRAW ${d}` : null;
}

function recMaze(s) {
  for (const [key, label] of [['maze_time_medium', 'MEDIUM'], ['maze_time_small', 'SMALL'],
    ['maze_time_large', 'LARGE'], ['maze_time_dark', 'DARK']]) {
    if (s[key]) return `RECORD ${formatTime(s[key])} (${label})`;
  }
  return null;
}

function recMemory(s) {
  const v = s.memory_moves_normal || s.memory_moves_easy || s.memory_moves_hard;
  return v ? `FEWEST MOVES ${v}` : null;
}

function recPuzzle(s) {
  if (!s.puzzle15_moves) return null;
  return `MOVES ${s.puzzle15_moves}  TIME ${formatTime(s.puzzle15_time || 0)}`;
}

export const GAMES = [
  {
    name: 'Tic Tac Toe', scene: 'TicTacToeScene', accent: NEON_BLUE, record: recTris,
    description: 'Play a friend or an unbeatable computer. Get three in a row!',
    controls: ['Mouse or arrows + ENTER: place your mark',
      'TAB: change mode   1/2/3: CPU level   ESC: pause'],
    touch: ['Tap a square to place your mark',
      'Mode: VS CPU / 2 players   CPU: level'],
  },
  {
    name: 'Snake', scene: 'SnakeScene', accent: NEON_GREEN, record: rec('snake'),
    description: 'Eat, grow, never bite your tail. The blue fruit gives +5 but fades!',
    controls: ['Arrows or WASD: move the snake', 'ESC or P: pause'],
    touch: ['D-pad or swipe on the field', 'Pause button: pause menu'],
  },
  {
    name: 'Block Drop', scene: 'TetrisScene', accent: NEON_PURPLE, record: rec('tetris'),
    description: 'Stack falling blocks. Save one for later and see the next 3.',
    controls: ['←/→ move  ↓ slow drop  SPACE fast drop  ↑/X turn  Z turn back',
      'C or SHIFT: hold   ESC or P: pause'],
    touch: ['Drag: move   Tap: turn   Quick swipe down: fast drop',
      'Buttons: Turn · Drop · Hold'],
  },
  {
    name: 'Pong', scene: 'PongScene', accent: NEON_CYAN, record: rec('pong_wins', 'WINS VS CPU'),
    description: 'The first arcade video game. Play the CPU (3 levels) or a friend.',
    controls: ['Player 1: W/S   Player 2: arrows ↑/↓',
      'ESC or P: pause   First to 11 wins'],
    touch: ['Drag on the left half (P1) or right half (P2)',
      'Two players on one tablet!   First to 11 wins'],
  },
  {
    name: 'Breakout', scene: 'BreakoutScene', accent: NEON_ORANGE, record: rec('breakout'),
    description: 'Smash the bricks, catch power-ups and beat every level.',
    controls: ['Mouse or arrows/A-D: move   SPACE/click: launch the ball',
      'Power-ups: L long  M multi-ball  S slow  ♥ life   ESC: pause'],
    touch: ['Drag: move the paddle   Tap: launch the ball',
      'Power-ups: L long  M multi-ball  S slow  ♥ life'],
  },
  {
    name: 'Star Defenders', scene: 'SpaceInvadersScene', accent: NEON_GREEN, record: rec('space_invaders'),
    description: 'Waves of aliens, shields that break and a mystery bonus UFO.',
    controls: ['Arrows or A/D: move   SPACE: shoot (hold it down)', 'ESC or P: pause'],
    touch: ['Drag to move, keep your finger down to shoot', 'Or D-pad + Fire button'],
  },
  {
    name: 'Maze Runner', scene: 'MazeRunnerScene', accent: NEON_BLUE, record: recMaze,
    description: 'Random mazes, even dark ones, with a hint to show the way.',
    controls: ['Arrows or WASD: move (hold to run)',
      'H: hint (+10 s)   ESC: pause'],
    touch: ['D-pad (hold to run) or swipe',
      'H button: hint (+10 s)'],
  },
  {
    name: 'Memory Game', scene: 'MemoryGameScene', accent: NEON_MAGENTA, record: recMemory,
    description: 'Find the pairs in as few moves as you can. Three grid sizes.',
    controls: ['Mouse: flip cards   Arrows + ENTER: play with the keyboard', 'ESC: pause'],
    touch: ['Tap two cards to flip them', 'Combo: match pairs in a row!'],
  },
  {
    name: 'Puzzle 15', scene: 'Puzzle15Scene', accent: NEON_YELLOW, record: recPuzzle,
    description: 'Slide the numbered tiles into order. Click to move a whole row!',
    controls: ['Click a tile (or a row of tiles) or use the arrows',
      'Tiles in the right place light up   R: shuffle   ESC: pause'],
    touch: ['Tap a tile in the same row or column as the gap',
      'Several tiles can slide at once'],
  },
];

export const findGame = (sceneKey) => GAMES.find((g) => g.scene === sceneKey);
