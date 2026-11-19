/**
 * Record e impostazioni persistenti, salvati in `localStorage`.
 *
 * Stessi obiettivi della versione Python (scores.py):
 *   * **Mai perdere dati**: `localStorage.setItem` scrive tutto o niente
 *     (è già atomico), e il documento viene riletto prima di ogni scrittura,
 *     così due giochi non si sovrascrivono a vicenda.
 *   * **Mai bloccare il gioco**: un salvataggio danneggiato viene spostato
 *     in `<chiave>.corrupt` e si riparte da zero. Se lo storage non è
 *     disponibile (navigazione privata, cookie bloccati) si gioca lo stesso
 *     con uno store in memoria.
 *   * **Disaccoppiato**: i giochi usano solo `load()` / `save()` e le
 *     funzioni `recordBest()` / `getBest()`; nei test si passa uno storage
 *     finto (`memoryStorage()`).
 *
 * Formato salvato sotto la chiave "retro_arcade":
 *
 *   { "version": 1,
 *     "scores":   { "snake": 120, "tetris": 4200, ... },
 *     "settings": { "sound": true, "crt": true, "last_game": 4 } }
 *
 * Migrazione: la versione 1.x salvava un oggetto "piatto" sotto la chiave
 * "retro_scores" (solo Snake e Tetris). Al primo avvio viene importato.
 *
 * Modulo puro: niente Phaser né DOM (lo storage viene passato dall'esterno).
 */

export const STORAGE_KEY = 'retro_arcade';
export const LEGACY_KEY = 'retro_scores';
export const SCHEMA_VERSION = 1;

const emptyDoc = () => ({ version: SCHEMA_VERSION, scores: {}, settings: {} });
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Storage in memoria con la stessa interfaccia di localStorage. */
export function memoryStorage(initial = {}) {
  const box = new Map(Object.entries(initial));
  return {
    getItem: (k) => (box.has(k) ? box.get(k) : null),
    setItem: (k, v) => { box.set(k, String(v)); },
    removeItem: (k) => { box.delete(k); },
    get size() { return box.size; },
    keys: () => [...box.keys()],
  };
}

/** localStorage se usabile, altrimenti uno storage in memoria. */
export function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__retro_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

export class ScoreStore {
  constructor(storage = defaultStorage(), key = STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  // ------------------------------------------------------------------ io
  _readAll() {
    let raw;
    try { raw = this.storage.getItem(this.key); } catch { return emptyDoc(); }
    if (raw == null) return this._migrateLegacy();
    let data;
    try {
      data = JSON.parse(raw);
      if (!isObject(data)) throw new Error('root is not an object');
    } catch {
      this._quarantine(raw);
      return emptyDoc();
    }
    // Formato piatto {"snake": 10, ...}
    if (!('scores' in data) && !('settings' in data)) data = { scores: data, settings: {} };
    if (!isObject(data.scores)) data.scores = {};
    if (!isObject(data.settings)) data.settings = {};
    data.version = SCHEMA_VERSION;
    return data;
  }

  _migrateLegacy() {
    const doc = emptyDoc();
    try {
      const legacy = JSON.parse(this.storage.getItem(LEGACY_KEY) || 'null');
      if (isObject(legacy)) {
        for (const [k, v] of Object.entries(legacy)) {
          if (typeof v === 'number' && Number.isFinite(v)) doc.scores[k] = v;
        }
      }
    } catch { /* vecchio salvataggio illeggibile: si parte puliti */ }
    return doc;
  }

  /** Sposta da parte un salvataggio danneggiato, per poterlo ispezionare. */
  _quarantine(raw) {
    try {
      this.storage.setItem(`${this.key}.corrupt`, raw);
      this.storage.removeItem(this.key);
    } catch { /* pazienza */ }
  }

  _writeAll(data) {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (err) {   // quota piena, storage bloccato... si continua a giocare
      console.warn('[scores] Impossibile salvare:', err);
      return false;
    }
  }

  // -------------------------------------------------------------- scores
  /** Una *copia* dei record. */
  load() { return { ...this._readAll().scores }; }

  /** Unisce `scores` a quelli salvati (le altre chiavi restano). */
  save(scores) {
    const data = this._readAll();
    Object.assign(data.scores, scores);
    this._writeAll(data);
  }

  // ------------------------------------------------------------ settings
  getSetting(key, fallback = undefined) {
    const value = this._readAll().settings[key];
    return value === undefined ? fallback : value;
  }

  setSetting(key, value) {
    const data = this._readAll();
    data.settings[key] = value;
    this._writeAll(data);
  }

  /** Cancella tutti i record (le impostazioni restano). */
  clearScores() {
    const data = this._readAll();
    data.scores = {};
    this._writeAll(data);
  }
}

/**
 * Salva `value` sotto `key` se batte il record attuale.
 * @param lowerIsBetter true per tempi e numero di mosse.
 * @returns true se è un nuovo record (ed è stato salvato).
 */
export function recordBest(store, key, value, lowerIsBetter = false) {
  let current;
  try { current = store.load()[key]; } catch { current = undefined; }
  let better;
  if (current === undefined || current === null) better = value > 0 || lowerIsBetter;
  else if (lowerIsBetter) better = value < current;
  else better = value > current;
  if (better) {
    try { store.save({ [key]: value }); } catch { return false; }
  }
  return better;
}

/** Legge un singolo record, senza mai lanciare eccezioni. */
export function getBest(store, key, fallback = null) {
  try {
    const v = store.load()[key];
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

// Store condiviso dall'applicazione (creato al primo utilizzo).
let shared = null;
export function getStore() {
  if (!shared) shared = new ScoreStore();
  return shared;
}
/** Solo per i test: sostituisce lo store condiviso. */
export function setStore(store) { shared = store; }
