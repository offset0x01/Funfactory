/**
 * Palette e costanti dello schermo (identiche alla versione Python v3).
 *
 * I colori sono interi 0xRRGGBB, il formato che Phaser usa per Graphics,
 * tint e camere. `css()` li converte in stringhe "#rrggbb" per i Text e
 * per il disegno su Canvas 2D.
 *
 * Modulo "puro": niente Phaser, quindi è usabile anche nei test con Node.
 */

export const W = 800;
export const H = 600;
export const MAX_DT = 0.05;   // secondi: protegge la fisica dai picchi di frame

export const BG = 0x141428;          // sfondo "spaziale" scuro di tutti i giochi
export const BG_DARK = 0x0a0818;
export const PANEL_BG = 0x0e0c20;
export const WHITE = 0xffffff;
export const BLACK = 0x000000;
export const GRAY_DARK = 0x646464;
export const TEXT = 0xdcdcff;
export const TEXT_DIM = 0x8c8cb9;

// Palette neon (come il banner del README: ciano + magenta synthwave)
export const NEON_CYAN = 0x00f0ff;
export const NEON_MAGENTA = 0xff3cc8;
export const NEON_PURPLE = 0x9646ff;
export const NEON_GREEN = 0x3cff78;
export const NEON_YELLOW = 0xffe63c;
export const NEON_ORANGE = 0xff9628;
export const NEON_RED = 0xff465a;
export const NEON_BLUE = 0x3c82ff;

/** Componenti [r, g, b] di un colore intero. */
export const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Intero da componenti r, g, b (con arrotondamento e limiti). */
export const fromRgb = (r, g, b) =>
  (Math.max(0, Math.min(255, Math.round(r))) << 16)
  | (Math.max(0, Math.min(255, Math.round(g))) << 8)
  | Math.max(0, Math.min(255, Math.round(b)));

/** "#rrggbb" per Text e Canvas 2D. */
export const css = (c) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

/** "rgba(r,g,b,a)" per Canvas 2D. */
export const rgba = (c, a = 1) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };

/** Interpolazione lineare tra due colori (t tra 0 e 1). */
export function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
