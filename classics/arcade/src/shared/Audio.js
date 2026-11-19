/**
 * Riproduzione degli effetti chiptune con la Web Audio API.
 *
 * - I suoni vengono sintetizzati una sola volta (src/core/sfx.js) e
 *   trasformati in AudioBuffer alla frequenza della scheda audio.
 * - I browser permettono l'audio solo dopo un gesto dell'utente (clic,
 *   tocco, tasto): al primo gesto il contesto viene "sbloccato".
 * - Se l'audio non è disponibile ogni chiamata diventa silenziosa: il gioco
 *   non si blocca mai per colpa dell'audio.
 *
 * Approfondimento: https://developer.mozilla.org/docs/Web/API/Web_Audio_API
 */
import { RECIPES, synthesize } from '../core/sfx.js';

const state = {
  ctx: null,
  master: null,
  buffers: new Map(),
  enabled: true,
  failed: false,
  last: new Map(),   // nome -> istante dell'ultima riproduzione (evita raffiche identiche)
};

function ensureContext() {
  if (state.ctx || state.failed) return state.ctx;
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio non supportato');
    state.ctx = new Ctx({ latencyHint: 'interactive' });
    state.master = state.ctx.createGain();
    state.master.gain.value = 1;
    state.master.connect(state.ctx.destination);
  } catch {
    state.failed = true;
  }
  return state.ctx;
}

function bufferFor(name) {
  let buf = state.buffers.get(name);
  if (buf) return buf;
  const tones = RECIPES[name];
  const ctx = state.ctx;
  if (!tones || !ctx) return null;
  const data = synthesize(tones, ctx.sampleRate);
  buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.copyToChannel(data, 0);
  state.buffers.set(name, buf);
  return buf;
}

function unlock() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

const Audio = {
  /** Da chiamare una volta all'avvio. */
  init() {
    const opts = { capture: true, passive: true };
    ['pointerdown', 'keydown', 'touchend'].forEach((type) => window.addEventListener(type, unlock, opts));
    // Torna in pausa quando la scheda è nascosta (niente suoni "in sospeso")
    document.addEventListener('visibilitychange', () => {
      if (!state.ctx) return;
      if (document.hidden) state.ctx.suspend().catch(() => {});
      else state.ctx.resume().catch(() => {});
    });
  },

  /** Sintetizza tutto subito (evita un piccolo scatto al primo suono). */
  preload() {
    if (!ensureContext()) return false;
    Object.keys(RECIPES).forEach(bufferFor);
    return true;
  },

  /** Suona un effetto per nome. Nomi sconosciuti e audio mancante vengono ignorati. */
  play(name, volume = 1) {
    if (!state.enabled) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (state.last.get(name) ?? -1) < 0.012) return;   // stesso suono nello stesso istante
    state.last.set(name, now);
    const buf = bufferFor(name);
    if (!buf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      src.connect(gain).connect(state.master);
      src.start();
    } catch { /* mai bloccare il gioco per l'audio */ }
  },

  get enabled() { return state.enabled; },
  set enabled(v) { state.enabled = !!v; },
};

export default Audio;
