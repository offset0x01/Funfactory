/**
 * Impostazioni globali (audio, filtro CRT) e notifiche a comparsa.
 *
 * Le impostazioni vengono salvate nello stesso documento dei record
 * (vedi src/core/scores.js), quindi sopravvivono alla chiusura del browser.
 * Le notifiche ("AUDIO OFF", "SCREENSHOT SALVATO"...) vengono disegnate in
 * basso a destra dalla OverlayScene, sopra a qualsiasi scena.
 */
import Audio from './Audio.js';
import { getStore } from '../core/scores.js';

const values = { sound: true, crt: true };
let loaded = false;
const listeners = new Set();

function emit(type, payload) {
  listeners.forEach((fn) => { try { fn(type, payload); } catch (e) { console.error(e); } });
}

const Settings = {
  /** Legge le impostazioni salvate (una volta sola) e le applica. */
  load() {
    if (loaded) return;
    loaded = true;
    const store = getStore();
    values.sound = !!store.getSetting('sound', true);
    values.crt = !!store.getSetting('crt', true);
    Audio.enabled = values.sound;
  },

  get sound() { return values.sound; },
  get crt() { return values.crt; },

  /** Accende/spegne l'audio, salva la scelta e restituisce il nuovo stato. */
  toggleSound() {
    values.sound = !values.sound;
    Audio.enabled = values.sound;
    getStore().setSetting('sound', values.sound);
    if (values.sound) Audio.play('select');
    Settings.notify(values.sound ? 'SOUND ON' : 'SOUND OFF');
    emit('change', 'sound');
    return values.sound;
  },

  /** Accende/spegne il filtro CRT (scanline + vignettatura). */
  toggleCrt() {
    values.crt = !values.crt;
    getStore().setSetting('crt', values.crt);
    Settings.notify(values.crt ? 'RETRO SCREEN ON' : 'RETRO SCREEN OFF');
    emit('change', 'crt');
    return values.crt;
  },

  /** Mostra un breve messaggio in basso a destra. */
  notify(text, seconds = 1.6) { emit('notify', { text, seconds }); },

  /** Registra un ascoltatore; restituisce la funzione per rimuoverlo. */
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export default Settings;
