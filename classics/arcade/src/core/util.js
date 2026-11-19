/**
 * Piccole utilità condivise (modulo puro, testabile con Node).
 */

/** Formatta i secondi come "m:ss" (es. 75.4 -> "1:15"). */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Generatore casuale con seme (mulberry32): stessi numeri a ogni esecuzione.
 * Nei test rende ripetibili labirinti, mescolamenti e sacchetti di Tetris.
 * Restituisce una funzione () => numero in [0, 1), come Math.random.
 */
export function makeRng(seed = 1234) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const uniform = (rng, lo, hi) => lo + (hi - lo) * rng();
export const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));   // estremi inclusi
export const choice = (rng, list) => list[Math.floor(rng() * list.length)];

/** Mescola l'array sul posto (Fisher-Yates) e lo restituisce. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** k elementi distinti presi a caso dalla lista (come random.sample). */
export function sample(rng, list, k) {
  return shuffle(rng, [...list]).slice(0, k);
}

/** Cronometro guidato dai delta dei frame: le pause sono escluse da sole. */
export class Stopwatch {
  constructor() { this.elapsed = 0; this.running = true; }
  update(dt) { if (this.running) this.elapsed += dt; }
  stop() { this.running = false; }
  reset() { this.elapsed = 0; this.running = true; }
  toString() { return formatTime(this.elapsed); }
}
