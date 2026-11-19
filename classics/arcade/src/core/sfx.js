/**
 * Effetti sonori chiptune procedurali: nessun file audio.
 *
 * Ogni suono viene *sintetizzato* da una piccola "ricetta" (forma d'onda,
 * glissando di frequenza, inviluppo), proprio come facevano i chip sonori
 * dei cabinati anni '80. Le ricette sono le stesse della versione Python.
 *
 * Questo modulo è puro (genera solo numeri): la riproduzione con la Web
 * Audio API sta in src/shared/Audio.js. Così la sintesi è testabile con Node.
 */
import { makeRng } from './util.js';

export const MASTER_VOLUME = 0.35;

/**
 * Una nota sintetizzata.
 * @param {number} freq      frequenza iniziale (Hz)
 * @param {number} dur       durata (s)
 * @param {object} [o]
 * @param {'square'|'triangle'|'saw'|'noise'} [o.wave='square']
 * @param {number} [o.endFreq]  frequenza finale (glissando lineare)
 * @param {number} [o.vol=1]    volume relativo 0..1
 * @param {number} [o.duty=0.5] duty cycle delle onde quadre (0.125 = suono sottile/nasale)
 * @param {number} [o.attack=0.004] tempo di attacco (s)
 * @param {number} [o.vibrato=0] profondità del vibrato (Hz)
 */
export const tone = (freq, dur, o = {}) => ({
  freq, dur, wave: 'square', endFreq: null, vol: 1, duty: 0.5, attack: 0.004, vibrato: 0, ...o,
});

/** "C5", "F#4"... -> frequenza in Hz (La4 = 440 Hz). */
export function note(name) {
  const names = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  const pitch = name.slice(0, -1);
  const octave = Number(name.slice(-1));
  return 440 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12);
}

/** Arpeggio/jingle da una lista di note separate da spazi. */
export const arp = (notes, step, wave = 'square', vol = 0.8, duty = 0.5) =>
  notes.split(' ').map((n) => tone(note(n), step, { wave, vol, duty }));

export const RECIPES = {
  // --- UI ---
  select: [tone(660, 0.04, { duty: 0.25, vol: 0.6 }), tone(990, 0.05, { duty: 0.25, vol: 0.6 })],
  move: [tone(520, 0.025, { duty: 0.25, vol: 0.35 })],
  back: [tone(500, 0.04, { duty: 0.25, vol: 0.5 }), tone(330, 0.06, { duty: 0.25, vol: 0.5 })],
  launch: arp('C5 E5 G5 C6', 0.055, 'square', 0.8, 0.25),
  pause: [tone(880, 0.05, { wave: 'triangle' }), tone(660, 0.07, { wave: 'triangle' })],
  // --- eventi generici ---
  blip: [tone(880, 0.03, { duty: 0.25, vol: 0.5 })],
  hit: [tone(520, 0.045, { duty: 0.5, vol: 0.7 })],
  wall: [tone(260, 0.04, { duty: 0.5, vol: 0.55 })],
  score: [tone(660, 0.07, { endFreq: 1320, duty: 0.25, vol: 0.7 })],
  bonus: arp('E5 G5 B5 E6', 0.05, 'square', 0.7, 0.125),
  powerup: [tone(400, 0.25, { endFreq: 1600, duty: 0.25, vol: 0.6, vibrato: 25 })],
  hurt: [tone(420, 0.28, { endFreq: 90, duty: 0.5, vol: 0.8 })],
  explosion: [tone(1800, 0.35, { wave: 'noise', endFreq: 120, vol: 0.9 })],
  small_explosion: [tone(2400, 0.12, { wave: 'noise', endFreq: 500, vol: 0.6 })],
  shoot: [tone(1400, 0.11, { endFreq: 350, duty: 0.25, vol: 0.45 })],
  enemy_shoot: [tone(700, 0.09, { endFreq: 250, duty: 0.125, vol: 0.3 })],
  ufo: [tone(900, 0.4, { wave: 'triangle', vol: 0.45, vibrato: 120 })],
  win: arp('C5 E5 G5 C6 G5 C6', 0.09, 'square', 0.8, 0.25),
  lose: [...arp('G4 E4 C4', 0.14, 'square', 0.8, 0.5), tone(note('C3'), 0.3, { wave: 'triangle' })],
  record: arp('G5 C6 E6 G6 E6 G6', 0.07, 'square', 0.8, 0.125),
  error: [tone(150, 0.12, { duty: 0.5, vol: 0.6 }), tone(120, 0.12, { duty: 0.5, vol: 0.6 })],
  // --- specifici dei giochi ---
  eat: [tone(600, 0.06, { endFreq: 1100, duty: 0.25, vol: 0.6 })],
  rotate: [tone(700, 0.03, { wave: 'triangle', vol: 0.5 })],
  drop: [tone(3000, 0.06, { wave: 'noise', endFreq: 800, vol: 0.5 })],
  line: arp('C5 G5 C6', 0.05, 'square', 0.8, 0.25),
  tetris: arp('C5 E5 G5 C6 E6 G6', 0.05, 'square', 0.8, 0.125),
  levelup: arp('G4 C5 E5 G5', 0.07, 'square', 0.8, 0.25),
  flip: [tone(480, 0.04, { wave: 'triangle', endFreq: 620, vol: 0.5 })],
  match: arp('E5 B5', 0.07, 'triangle'),
  brick: [tone(780, 0.04, { duty: 0.25, vol: 0.5 })],
  slide: [tone(300, 0.04, { wave: 'triangle', endFreq: 200, vol: 0.5 })],
  step: [tone(note('A2'), 0.07, { wave: 'triangle', vol: 0.8 })],
  step2: [tone(note('G2'), 0.07, { wave: 'triangle', vol: 0.8 })],
  step3: [tone(note('F2'), 0.07, { wave: 'triangle', vol: 0.8 })],
  step4: [tone(note('E2'), 0.07, { wave: 'triangle', vol: 0.8 })],
  place_x: [tone(500, 0.05, { duty: 0.25, vol: 0.6 })],
  place_o: [tone(380, 0.05, { wave: 'triangle', vol: 0.7 })],
};

/**
 * Trasforma una lista di note in campioni mono float (-1..1).
 * Funzione pura e deterministica (il rumore usa un generatore con seme).
 * @returns {Float32Array}
 */
export function synthesize(tones, rate, seed = 1234) {
  const rng = makeRng(seed);
  const total = tones.reduce((n, t) => n + Math.max(1, Math.floor(t.dur * rate)), 0);
  const out = new Float32Array(total);
  let k = 0;
  for (const t of tones) {
    const n = Math.max(1, Math.floor(t.dur * rate));
    const attackN = Math.max(1, Math.floor(t.attack * rate));
    const end = t.endFreq ?? t.freq;
    let phase = 0;
    let noiseVal = 0;
    let noiseCounter = 0;
    for (let i = 0; i < n; i++) {
      let freq = t.freq + (end - t.freq) * (i / n);
      if (t.vibrato) freq += t.vibrato * Math.sin(2 * Math.PI * 7 * i / rate);
      phase = (phase + freq / rate) % 1;
      let s;
      if (t.wave === 'square') s = phase < t.duty ? 1 : -1;
      else if (t.wave === 'triangle') s = 4 * Math.abs(phase - 0.5) - 1;
      else if (t.wave === 'saw') s = 2 * phase - 1;
      else {   // rumore "sample and hold": la frequenza decide ogni quanto cambia valore
        noiseCounter += freq / rate;
        if (noiseCounter >= 1) { noiseCounter -= 1; noiseVal = rng() * 2 - 1; }
        s = noiseVal;
      }
      // Inviluppo: breve attacco lineare, poi decadimento lineare fino a zero
      const env = i < attackN ? i / attackN : 1 - (i - attackN) / Math.max(1, n - attackN);
      out[k++] = s * env * t.vol * MASTER_VOLUME;
    }
  }
  return out;
}
