/**
 * Font bitmap 5x7 fatto a mano, per titoli arcade autentici.
 *
 * Perché un font bitmap invece di un font di sistema?
 *   Un font vettoriale ingrandito diventa sfocato; disegnare ogni lettera da
 *   una bitmap dà pixel quadrati e nitidi a qualsiasi scala intera, non serve
 *   nessun file font (stesso aspetto su Windows, macOS, Linux, Android, iOS)
 *   ed è identico alla versione Python.
 *
 * I caratteri non presenti vengono resi maiuscoli e privati degli accenti
 * ("è" -> "E"); se ancora sconosciuti diventano un quadratino.
 *
 * Modulo puro (niente Phaser né DOM): il disegno vero e proprio avviene
 * tramite una callback `fillRect`, così si può usare con Canvas 2D, con
 * Phaser.Graphics oppure nei test.
 */

export const GLYPH_HEIGHT = 7;
export const LETTER_SPACING = 1;   // colonne vuote tra due lettere (in pixel del font)

// Ogni glifo è un array di righe; "#" = pixel acceso. Larghezze variabili
// (la punteggiatura stretta sta molto meglio).
export const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  ',': ['..', '..', '..', '..', '##', '.#', '#.'],
  ':': ['..', '##', '##', '..', '##', '##', '..'],
  ';': ['..', '##', '##', '..', '##', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '|': ['#', '#', '#', '#', '#', '#', '#'],
  '·': ['..', '..', '..', '##', '##', '..', '..'],
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '##.##', '#...#'],
  '→': ['.....', '...#.', '....#', '#####', '....#', '...#.', '.....'],
  '←': ['.....', '.#...', '#....', '#####', '#....', '.#...', '.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
};

export const FALLBACK = ['###', '#.#', '#.#', '#.#', '#.#', '#.#', '###'];

/** Porta un carattere su una chiave della tabella (maiuscolo, senza accenti). */
export function normalizeChar(ch) {
  if (ch in GLYPHS) return ch;
  const up = ch.toUpperCase();
  if (up in GLYPHS) return up;
  // "È" -> "E" + accento combinante -> "E"
  const base = up.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  if (base && base[0] in GLYPHS) return base[0];
  return '\0';
}

/** Righe della bitmap usate per disegnare `ch` (un quadratino se sconosciuto). */
export function glyphFor(ch) {
  return GLYPHS[normalizeChar(ch)] || FALLBACK;
}

/** Dimensione in pixel [larghezza, altezza] che occuperebbe il testo. */
export function measure(text, scale = 1) {
  const chars = [...String(text)];
  if (!chars.length) return [0, GLYPH_HEIGHT * scale];
  let width = chars.reduce((sum, ch) => sum + glyphFor(ch)[0].length, 0);
  width += LETTER_SPACING * (chars.length - 1);
  return [width * scale, GLYPH_HEIGHT * scale];
}

/**
 * Disegna il testo chiamando `fillRect(x, y, w, h)` per ogni pixel acceso.
 * Le righe orizzontali consecutive vengono unite in un solo rettangolo
 * (molte meno chiamate: utile quando si disegna su Phaser.Graphics).
 */
export function drawGlyphs(text, scale, fillRect, ox = 0, oy = 0) {
  let x = ox;
  for (const ch of String(text)) {
    const rows = glyphFor(ch);
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      let start = -1;
      for (let rx = 0; rx <= row.length; rx++) {
        const on = rx < row.length && row[rx] === '#';
        if (on && start < 0) start = rx;
        if (!on && start >= 0) {
          fillRect(x + start * scale, oy + ry * scale, (rx - start) * scale, scale);
          start = -1;
        }
      }
    }
    x += (rows[0].length + LETTER_SPACING) * scale;
  }
}
