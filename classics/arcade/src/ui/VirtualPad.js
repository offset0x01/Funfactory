/**
 * VirtualPad — gamepad virtuale (DOM) per smartphone e tablet.
 *
 * Idea chiave: i pulsanti a schermo generano eventi tastiera *sintetici* sul
 * `window`, che Phaser riceve esattamente come quelli di una tastiera fisica
 * (Phaser legge `event.keyCode` dagli eventi `keydown`/`keyup` del window).
 * Così ogni scena continua a gestire solo la tastiera e diventa giocabile
 * anche col touch, senza duplicare la logica di gioco.
 *
 * Il layout dei pulsanti viene scelto da ogni scena con `setLayout()`
 * (vedi `useTouchLayout()` in src/shared/SceneKit.js).
 *
 * Layout:
 * {
 *   system:   [{ icon, label, key }],              // pausa / riavvia / menu …
 *   dpad:     { up, down, left, right, mode, axis, delay, rate },
 *   actions:  [{ label | icon, sub, key, mode, big }],
 *   gestures: { swipe: { left, right, up, down }, step, lockAxis, tap, flickDown },
 * }
 * mode: 'tap'    → un keydown+keyup per pressione
 *       'repeat' → come 'tap' ma ripete tenendo premuto (delay/rate in ms)
 *       'hold'   → keydown alla pressione, keyup al rilascio (per i giochi che leggono key.isDown)
 */

// ─── Tastiera sintetica ────────────────────────────────────────────────────────

const SPECIAL_KEYS = {
  ArrowLeft: [37, 'ArrowLeft'], ArrowUp: [38, 'ArrowUp'],
  ArrowRight: [39, 'ArrowRight'], ArrowDown: [40, 'ArrowDown'],
  Space: [32, ' '], Enter: [13, 'Enter'], Escape: [27, 'Escape'], Tab: [9, 'Tab'],
};

function keyInfo(code) {
  if (SPECIAL_KEYS[code]) return SPECIAL_KEYS[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return [m[1].charCodeAt(0), m[1].toLowerCase()];
  m = /^Digit([0-9])$/.exec(code);
  if (m) return [48 + Number(m[1]), m[1]];
  throw new Error(`VirtualPad: tasto sconosciuto "${code}"`);
}

/** Invia un evento tastiera sintetico che Phaser tratta come uno reale. */
export function fireKey(type, code) {
  const [keyCode, key] = keyInfo(code);
  const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  // keyCode/which non sono impostabili dal costruttore: li definiamo sull'istanza
  Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
  Object.defineProperty(ev, 'which', { get: () => keyCode });
  window.dispatchEvent(ev);
}

const tapKey = (code) => { fireKey('keydown', code); fireKey('keyup', code); };

// Contatore per i tasti "hold": due dita sullo stesso tasto non generano keyup anticipati
const heldCount = new Map();
function holdDown(code) {
  const n = heldCount.get(code) || 0;
  heldCount.set(code, n + 1);
  if (n === 0) fireKey('keydown', code);
}
function holdUp(code) {
  const n = heldCount.get(code) || 0;
  if (n <= 1) { heldCount.delete(code); if (n === 1) fireKey('keyup', code); }
  else heldCount.set(code, n - 1);
}

function vibrate() {
  try { navigator.vibrate?.(8); } catch { /* non supportato: pazienza */ }
}

/** Avvia la pressione di un tasto virtuale; restituisce la funzione di rilascio. */
function startPress({ key, mode = 'tap', delay = 220, rate = 90 }) {
  vibrate();
  if (mode === 'hold') {
    holdDown(key);
    return () => holdUp(key);
  }
  tapKey(key);
  if (mode !== 'repeat') return () => {};
  let interval = null;
  const timeout = setTimeout(() => { interval = setInterval(() => tapKey(key), rate); }, delay);
  return () => { clearTimeout(timeout); clearInterval(interval); };
}

// ─── Icone (SVG inline, nessun asset esterno) ──────────────────────────────────

const svg = (body, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${fill
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

const ICONS = {
  pause:      svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', true),
  restart:    svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  menu:       svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  info:       svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  swap:       svg('<path d="M4 8h14l-4-4M20 16H6l4 4"/>'),
  rotate:     svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 3v6h-6"/><path d="M20 12a8 8 0 0 1-14 5.3"/>'),
  drop:       svg('<path d="M12 3v12M6 10l6 6 6-6M5 21h14"/>'),
  fire:       svg('<path d="M12 2l3 7h-6zM10 10h4v8h-4zM8 20h8"/>', true),
  play:       svg('<path d="M7 4l13 8-13 8z"/>', true),
  fullscreen: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fsExit:     svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  gamepad:    svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>'),
  hide:       svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M4 4l16 17"/>'),
  sound:      svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>'),
  crt:        svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M6 8.5h12M6 12.5h12"/>'),
  bulb:       svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  up:         svg('<path d="M12 6l7 10H5z"/>', true),
  down:       svg('<path d="M12 18L5 8h14z"/>', true),
  left:       svg('<path d="M6 12l10-7v14z"/>', true),
  right:      svg('<path d="M18 12L8 19V5z"/>', true),
};

// ─── Stato del modulo ──────────────────────────────────────────────────────────

const PREF_KEY = 'retro_pad_pref'; // 'on' | 'off' | (assente = automatico)

const state = {
  game: null,
  el: {},
  layout: null,
  mode: 'keyboard',           // ultimo tipo di input usato: 'touch' | 'keyboard'
  auto: true,                 // visibilità automatica in base al tipo di input
  manualVisible: false,
  visible: false,
  touchCapable: false,
  releases: new Set(),        // pressioni attive (per rilasciarle al cambio scena)
  listeners: new Set(),
  gestures: new Map(),        // pointerId → stato gesto sul canvas
  gesturesSuspended: false,   // true mentre è aperto un menu
};

function readPref() { try { return localStorage.getItem(PREF_KEY); } catch { return null; } }
function writePref(v) { try { v ? localStorage.setItem(PREF_KEY, v) : localStorage.removeItem(PREF_KEY); } catch { /* storage bloccato */ } }

function emitChange() { state.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

function releaseAll() {
  state.releases.forEach((rel) => rel());
  state.releases.clear();
  state.gestures.clear();
  document.querySelectorAll('#app .on').forEach((n) => n.classList.remove('on'));
}

// ─── Costruzione dei controlli ─────────────────────────────────────────────────

function h(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function makeButton(cls, spec) {
  const b = h('button', cls);
  b.type = 'button';
  b.tabIndex = -1; // non deve mai rubare il focus alla tastiera fisica
  const label = spec.label || spec.sub || '';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = (spec.icon ? ICONS[spec.icon] || '' : `<span class="txt">${spec.label}</span>`)
    + (spec.sub || (spec.icon && spec.label) ? `<span class="lbl">${spec.sub || spec.label}</span>` : '');
  return b;
}

/** Pulsante che invia tasti (tap / repeat / hold), multi-touch friendly. */
function bindKeyButton(b, spec) {
  const pressing = new Map();
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pressing.has(e.pointerId)) return;
    try { b.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const rel = startPress(spec);
    pressing.set(e.pointerId, rel);
    state.releases.add(rel);
    b.classList.add('on');
  });
  const end = (e) => {
    const rel = pressing.get(e.pointerId);
    if (!rel) return;
    pressing.delete(e.pointerId);
    state.releases.delete(rel);
    rel();
    if (!pressing.size) b.classList.remove('on');
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', end);
  return b;
}

/** Pulsante che esegue una funzione (schermo intero, mostra/nascondi pad). */
function bindActionButton(b, fn) {
  b.addEventListener('pointerdown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  return b;
}

/** D-pad unico: si può far scivolare il dito da una direzione all'altra. */
function buildDpad(spec) {
  const axis = spec.axis || 'both';
  const pad = h('div', `dpad axis-${axis}`);
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Directional pad');
  const dirs = axis === 'x' ? ['left', 'right'] : axis === 'y' ? ['up', 'down'] : ['up', 'down', 'left', 'right'];
  const arrows = {};
  dirs.forEach((d) => {
    if (!spec[d]) return;
    arrows[d] = h('div', `arr ${d}`, ICONS[d]);
    pad.appendChild(arrows[d]);
  });

  const active = new Map(); // pointerId → { dir, rel }
  const dirFrom = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < Math.min(r.width, r.height) * 0.12) return null; // zona morta centrale
    if (axis === 'x') return dx < 0 ? 'left' : 'right';
    if (axis === 'y') return dy < 0 ? 'up' : 'down';
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  };
  const refreshGlow = () => {
    const on = new Set([...active.values()].map((a) => a.dir));
    Object.entries(arrows).forEach(([d, n]) => n.classList.toggle('on', on.has(d)));
  };
  const setDir = (id, dir) => {
    const cur = active.get(id);
    if (cur && cur.dir === dir) return;
    if (cur?.rel) { cur.rel(); state.releases.delete(cur.rel); }
    if (dir && spec[dir]) {
      const rel = startPress({ key: spec[dir], mode: spec.mode, delay: spec.delay, rate: spec.rate });
      state.releases.add(rel);
      active.set(id, { dir, rel });
    } else {
      active.set(id, { dir: null, rel: null });
    }
    refreshGlow();
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ }
    setDir(e.pointerId, dirFrom(e));
  });
  pad.addEventListener('pointermove', (e) => { if (active.has(e.pointerId)) setDir(e.pointerId, dirFrom(e)); });
  const end = (e) => {
    const cur = active.get(e.pointerId);
    if (!cur) return;
    if (cur.rel) { cur.rel(); state.releases.delete(cur.rel); }
    active.delete(e.pointerId);
    refreshGlow();
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
  return pad;
}

// ─── Gesti (swipe / tap) direttamente sull'area di gioco ───────────────────────

function onGameDown(e) {
  const g = state.layout?.gestures;
  // While a menu is open the canvas taps belong to the menu, not to the game:
  // a gesture that *starts* during a menu is never tracked (no stray rotations
  // or moves right after tapping "RIPRENDI").
  if (!g || e.pointerType === 'mouse' || state.gesturesSuspended) return;
  const now = performance.now();
  state.gestures.set(e.pointerId, {
    sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY,
    t: now, moved: false, axis: null,
    hist: [{ t: now, x: e.clientX, y: e.clientY }],   // recent samples, for the release speed
  });
}

/** Speed (px/ms) of the finger in the last ~100 ms before it was lifted. */
function releaseVelocity(s, now) {
  const last = s.hist[s.hist.length - 1];
  if (now - last.t > 120) return { vx: 0, vy: 0 };   // the finger had stopped
  const first = s.hist.find((p) => last.t - p.t <= 100) || last;
  const dt = Math.max(1, last.t - first.t);
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

function onGameMove(e) {
  const g = state.layout?.gestures;
  const s = state.gestures.get(e.pointerId);
  if (!g || !s) return;
  s.hist.push({ t: performance.now(), x: e.clientX, y: e.clientY });
  if (s.hist.length > 12) s.hist.shift();
  const step = g.step || 30;
  let dx = e.clientX - s.ax, dy = e.clientY - s.ay;
  if (g.lockAxis && s.axis === 'x') dy = 0;
  if (g.lockAxis && s.axis === 'y') dx = 0;
  if (Math.abs(dx) < step && Math.abs(dy) < step) return;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const dir = horizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  s.axis = s.axis || (horizontal ? 'x' : 'y');
  s.moved = true;
  // ripartiamo dal punto attuale: un trascinamento lungo genera più passi
  if (horizontal) s.ax += Math.sign(dx) * step; else s.ay += Math.sign(dy) * step;
  const key = g.swipe?.[dir];
  if (key) { vibrate(); tapKey(key); }
}

function onGameUp(e) {
  const g = state.layout?.gestures;
  const s = state.gestures.get(e.pointerId);
  state.gestures.delete(e.pointerId);
  if (!g || !s) return;
  const now = performance.now();
  const dt = now - s.t;
  const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
  if (!s.moved && Math.hypot(dx, dy) < 12 && dt < 300 && g.tap) { vibrate(); tapKey(g.tap); return; }
  // "Flick": quick downward gesture, recognised by the finger speed when it is lifted
  // (a slow drag downwards is just a soft drop, not a hard drop)
  const { vx, vy } = releaseVelocity(s, now);
  if (g.flickDown && dy > 50 && vy > 0.4 && vy > Math.abs(vx) * 1.5) { vibrate(); tapKey(g.flickDown); }
}

// ─── Schermo intero ────────────────────────────────────────────────────────────

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

/*
 * ESC e schermo intero: i browser usano ESC per USCIRE dallo schermo intero e in quel
 * caso il tasto NON arriva alla pagina (quindi il gioco non andava in pausa).
 * - Chrome/Edge: la Keyboard Lock API "presta" ESC al gioco; per uscire dallo schermo
 *   intero si tiene premuto ESC (il browser stesso mostra il suggerimento).
 * - Altri browser: se lo schermo intero si chiude senza il nostro pulsante, il gioco
 *   va in pausa da solo, così ESC fa comunque quello che ci si aspetta.
 */
let exitingByButton = false;

async function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try { await req.call(el, { navigationUI: 'hide' }); } catch { return; }
  try { await navigator.keyboard?.lock?.(['Escape']); } catch { /* non supportato: c'è il fallback */ }
}

function exitFullscreen() {
  exitingByButton = true;
  try { navigator.keyboard?.unlock?.(); } catch { /* ok */ }
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  Promise.resolve(exit?.call(document)).catch(() => { exitingByButton = false; });
}

function toggleFullscreen() {
  if (fsElement()) exitFullscreen(); else enterFullscreen();
}

function onFullscreenChange() {
  if (!fsElement()) {
    try { navigator.keyboard?.unlock?.(); } catch { /* ok */ }
    // Uscita non chiesta dal nostro pulsante (ESC del browser, gesto di sistema…): pausa
    if (!exitingByButton) {
      state.game?.scene.getScenes(true).forEach((scene) => scene.autoPause?.());
    }
    exitingByButton = false;
  }
  render();
}

// ─── Rendering del layout ──────────────────────────────────────────────────────

function computeVisible() {
  state.visible = state.auto ? state.mode === 'touch' : state.manualVisible;
}

function togglePad() {
  state.auto = false;
  state.manualVisible = !state.visible;
  writePref(state.manualVisible ? 'on' : 'off');
  render();
}

function utilButtons() {
  const list = [];
  if (fsSupported()) {
    list.push(bindActionButton(
      makeButton('sys util', { icon: fsElement() ? 'fsExit' : 'fullscreen', label: 'Full screen' }),
      toggleFullscreen));
  }
  return list;
}

function render() {
  const { el } = state;
  if (!el.app) return;
  const wasVisible = state.visible;
  computeVisible();
  releaseAll();

  const L = state.layout || {};
  const full = !!(L.dpad || (L.actions && L.actions.length));
  el.app.classList.toggle('pad-off', !state.visible);
  el.app.classList.toggle('pad-full', state.visible && full);
  el.app.classList.toggle('pad-mini', state.visible && !full);

  // Pulsanti di sistema (pausa, riavvia, menu…)
  el.sys.replaceChildren(...(L.system || []).map((s) => bindKeyButton(makeButton('sys', s), s)));
  // Croce direzionale
  el.dpad.replaceChildren(...(L.dpad ? [buildDpad(L.dpad)] : []));
  // Pulsanti azione
  el.actions.replaceChildren(...(L.actions || []).map((a) =>
    bindKeyButton(makeButton(`btn${a.big ? ' big' : ''}`, a), a)));
  // Utilità: schermo intero + nascondi pad
  el.util.replaceChildren(
    ...utilButtons(),
    bindActionButton(makeButton('sys util', { icon: 'hide', label: 'Hide controls' }), togglePad),
  );

  // Pulsanti flottanti quando il pad è nascosto
  const fab = [...utilButtons()];
  if (state.touchCapable || !state.auto) {
    fab.push(bindActionButton(makeButton('sys util', { icon: 'gamepad', label: 'Show touch controls' }), togglePad));
  }
  el.fab.replaceChildren(...fab);
  el.fab.hidden = state.visible || fab.length === 0;
  // with touch it must stay visible (it's the only way to bring the pad back);
  // with the mouse it appears on movement and fades away (see init)
  el.fab.classList.toggle('pinned', state.mode === 'touch');

  // Il canvas deve adattarsi subito al nuovo spazio disponibile
  requestAnimationFrame(() => { try { state.game?.scale.refresh(); } catch { /* ok */ } });
  if (wasVisible !== state.visible) emitChange();
}

// ─── API pubblica ──────────────────────────────────────────────────────────────

const VirtualPad = {
  /** Da chiamare una volta, dopo `new Phaser.Game()`. */
  init(game) {
    state.game = game;
    state.el = {
      app: document.getElementById('app'),
      game: document.getElementById('game'),
      sys: document.getElementById('pad-sys'),
      dpad: document.getElementById('pad-dpad'),
      util: document.getElementById('pad-util'),
      actions: document.getElementById('pad-actions'),
      fab: document.getElementById('fab'),
    };
    if (!state.el.app) { console.warn('VirtualPad: markup mancante in index.html'); return; }

    state.touchCapable = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    state.mode = coarse ? 'touch' : 'keyboard';
    const pref = readPref();
    if (pref === 'on' || pref === 'off') { state.auto = false; state.manualVisible = pref === 'on'; }

    // Riconosce automaticamente il tipo di input usato
    window.addEventListener('pointerdown', (e) => {
      if ((e.pointerType === 'touch' || e.pointerType === 'pen') && state.mode !== 'touch') {
        state.mode = 'touch'; state.touchCapable = true; render();
      }
    }, true);
    window.addEventListener('keydown', (e) => {
      if (!e.isTrusted || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      if (state.mode !== 'keyboard') { state.mode = 'keyboard'; render(); }
    }, true);

    // Floating buttons: shown while the mouse moves, hidden after a few seconds
    let fabTimer = null;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      state.el.fab.classList.add('awake');
      clearTimeout(fabTimer);
      fabTimer = setTimeout(() => state.el.fab.classList.remove('awake'), 2500);
    }, { passive: true });

    // Gesti sull'area di gioco
    const g = state.el.game;
    g.addEventListener('pointerdown', onGameDown, { passive: true });
    g.addEventListener('pointermove', onGameMove, { passive: true });
    g.addEventListener('pointerup', onGameUp, { passive: true });
    g.addEventListener('pointercancel', (e) => state.gestures.delete(e.pointerId), { passive: true });

    // Niente menu contestuale / zoom accidentali durante il gioco
    state.el.app.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault()); // pinch-zoom su iOS

    // Rilascia i tasti virtuali se l'app va in background (niente tasti "incollati")
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    render();
  },

  /** Imposta i controlli touch della scena corrente. */
  setLayout(layout) {
    state.layout = layout || null;
    render();
  },

  /** Rimuove il layout solo se è ancora quello attivo. */
  clearLayout(layout) {
    if (state.layout === layout) { state.layout = null; render(); }
  },

  /** true se l'interfaccia touch è visibile (utile per adattare i testi d'aiuto). */
  get touchUI() { return state.visible; },

  /** Sospende i gesti sul canvas (swipe/tap) mentre è aperto un menu. */
  suspendGestures(on) {
    state.gesturesSuspended = !!on;
    if (on) state.gestures.clear();
  },

  /** Schermo intero on/off (stesso comportamento del pulsante ⛶). */
  toggleFullscreen,

  /** Rilascia tutti i tasti virtuali premuti (es. quando si apre un menu). */
  releaseAll,

  /** Registra una callback chiamata quando cambia la modalità di input; restituisce la funzione per rimuoverla. */
  onChange(fn) {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  },

  fireKey,
};

export default VirtualPad;
