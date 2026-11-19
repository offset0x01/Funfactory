/**
 * SceneKit — piccoli helper per i controlli touch e i testi d'aiuto.
 *
 * - useTouchLayout(): imposta i controlli touch della scena (e li rimuove allo shutdown)
 * - bindHint():       testo d'aiuto che cambia tra tastiera e touch
 * - pick():           sceglie al volo la stringa giusta per tastiera o touch
 * - SYS:              pulsanti di sistema pronti (pausa, riavvia, modalità…)
 */
import VirtualPad from '../ui/VirtualPad.js';

/** Pulsanti di sistema riutilizzabili nei layout touch. */
export const SYS = {
  pause:   (key = 'Escape') => ({ icon: 'pause',   label: 'Pause',    key }),
  restart: (key = 'KeyR')   => ({ icon: 'restart', label: 'Restart',  key }),
  menu:    (key = 'KeyM')   => ({ icon: 'menu',    label: 'Menu',     key }),
  mode:    (key = 'Tab')    => ({ icon: 'swap',    label: 'Mode', key }),
  info:    (key = 'KeyC')   => ({ icon: 'info',    label: 'Credits',  key }),
  sound:   (key = 'KeyM')   => ({ icon: 'sound',   label: 'Sound',    key }),
  crt:     (key = 'KeyV')   => ({ icon: 'crt',     label: 'Retro',      key }),
};

/**
 * Ignora l'auto-ripetizione della tastiera: tenendo premuto un tasto il sistema
 * operativo invia molti keydown di seguito, e un tasto "interruttore" (pausa,
 * modalità…) si accenderebbe e spegnerebbe da solo.
 */
export const noRepeat = (fn) => (event) => { if (event && event.repeat) return; fn(event); };

/** Imposta i controlli touch della scena; vengono rimossi automaticamente allo shutdown. */
export function useTouchLayout(scene, layout) {
  VirtualPad.setLayout(layout);
  scene.events.once('shutdown', () => VirtualPad.clearLayout(layout));
}

/** true se in questo momento è visibile l'interfaccia touch. */
export const isTouchUI = () => VirtualPad.touchUI;

/** Restituisce il testo per tastiera o per touch in base alla modalità attuale. */
export const pick = (keyboardText, touchText) => (VirtualPad.touchUI ? touchText : keyboardText);

/**
 * Collega un oggetto con setText() a due varianti (tastiera / touch) e lo
 * aggiorna da solo quando l'utente passa da un tipo di input all'altro.
 * Le varianti possono essere stringhe o funzioni che restituiscono stringhe.
 */
export function bindHint(scene, textObj, keyboardText, touchText) {
  const val = (v) => (typeof v === 'function' ? v() : v);
  const apply = () => {
    if (textObj.active) textObj.setText(VirtualPad.touchUI ? val(touchText) : val(keyboardText));
  };
  apply();
  const off = VirtualPad.onChange(apply);
  scene.events.once('shutdown', off);
  return apply;
}

/** Esegue fn ogni volta che l'utente passa da tastiera a touch (o viceversa), fino allo shutdown della scena. */
export function onInputChange(scene, fn) {
  const off = VirtualPad.onChange(fn);
  scene.events.once('shutdown', off);
}
