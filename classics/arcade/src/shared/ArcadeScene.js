/**
 * ArcadeScene — classe base di tutti i giochi.
 *
 * Mette in comune ciò che in Python sta in game_shared.py e nel contratto
 * `main(load_scores, save_scores) -> "menu" | "quit"`:
 *
 *   * ciclo di gioco a tempo reale: `tick(dt)` riceve i secondi trascorsi,
 *     limitati a MAX_DT, così la fisica è uguale a 30, 60 o 144 Hz e non
 *     "salta" dopo una pausa;
 *   * menu di pausa (ESC / P), schermata di fine partita, scelta della
 *     modalità prima di giocare (con l'ultima scelta ricordata);
 *   * particelle, testi a comparsa e screen shake;
 *   * tasti tenuti premuti (`isDown`), input bloccato mentre c'è un menu;
 *   * pausa automatica quando la scheda viene nascosta;
 *   * ritorno al launcher con dissolvenza.
 *
 * Una sottoclasse implementa (tutti facoltativi):
 *   setup()          costruisce il gioco (può essere async e usare selectMenu)
 *   newGame()        riporta lo stato a inizio partita (RICOMINCIA)
 *   tick(dt)         avanza la simulazione
 *   draw()           ridisegna la grafica dinamica
 *   onKey(event)     tasto premuto (event.code: 'ArrowLeft', 'KeyA', 'Space'…)
 *   onPointerDown/Move/Up(pointer)
 *   saveOnExit()     salva il record quando si esce a metà partita
 *   touchLayout()    controlli del gamepad virtuale
 *
 * NB: Phaser riusa la stessa istanza della scena a ogni avvio, quindi tutto
 * lo stato va (re)impostato in create()/setup(), mai nel costruttore.
 */
import Phaser from '../lib/phaser.esm.min.js';
import Audio from './Audio.js';
import Settings from './Settings.js';
import { openMenu } from './Menu.js';
import { Particles, FloatingTexts, ScreenShake } from './Fx.js';
import { useTouchLayout, SYS, pick } from './SceneKit.js';
import { findGame } from './catalog.js';
import { getStore } from '../core/scores.js';
import { BG, MAX_DT, NEON_CYAN, NEON_GREEN, NEON_MAGENTA } from '../core/palette.js';

export default class ArcadeScene extends Phaser.Scene {
  constructor(key) {
    super({ key });
    this.shakeMax = 8;
  }

  // ------------------------------------------------------------ lifecycle
  create() {
    this.info = findGame(this.scene.key) || { name: this.scene.key, controls: [], touch: [] };
    this.store = getStore();
    this.modal = false;
    this.ready = false;
    this._leaving = false;
    this._crashed = false;
    this.t = 0;
    this.held = new Set();

    const cam = this.cameras.main;
    cam.setBackgroundColor(BG);
    cam.setScroll(0, 0);
    cam.fadeIn(220, 0, 0, 0);

    this.particles = new Particles(this, 40);
    this.popups = new FloatingTexts(this, 45);
    this.shake = new ScreenShake(cam, this.shakeMax);

    const kb = this.input.keyboard;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE,TAB');
    kb.on('keydown', this._keyDown, this);
    kb.on('keyup', this._keyUp, this);
    this.input.on('pointerdown', (p) => { if (this.canInput()) this.onPointerDown?.(p); });
    this.input.on('pointermove', (p) => { if (this.canInput()) this.onPointerMove?.(p); });
    this.input.on('pointerup', (p) => { if (this.canInput()) this.onPointerUp?.(p); });
    this.input.on('pointerupoutside', (p) => { if (this.canInput()) this.onPointerUp?.(p); });

    this._onBlur = () => this.held.clear();
    window.addEventListener('blur', this._onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('blur', this._onBlur);
      kb.off('keydown', this._keyDown, this);
      kb.off('keyup', this._keyUp, this);
      this.input.removeAllListeners();
      this.shake.reset();
    });

    useTouchLayout(this, this.touchLayout());

    Promise.resolve()
      .then(() => this.setup())
      .then(() => { if (!this._leaving) this.ready = true; })
      .catch((err) => this._crash(err));
  }

  update(_time, delta) {
    if (!this.ready || this.modal) return;
    const dt = Math.min(delta / 1000, MAX_DT);
    this.t += dt;
    try {
      this.tick(dt);
      this.particles.update(dt);
      this.popups.update(dt);
      this.shake.update(dt);
      this.draw();
      this.particles.draw();
    } catch (err) {
      this._crash(err);
    }
  }

  // ------------------------------------------------------------ overridable
  setup() {}
  newGame() {}
  tick() {}
  draw() {}
  saveOnExit() {}
  touchLayout() { return { system: [SYS.pause(), SYS.restart()] }; }

  /** Righe dei comandi mostrate nel menu di pausa (tastiera o touch). */
  commandLines() { return pick(this.info.controls, this.info.touch) || []; }

  // ------------------------------------------------------------ input
  canInput() { return this.ready && !this.modal && !this._leaving; }

  isDown(...codes) { return codes.some((c) => this.held.has(c)); }

  _keyDown(event) {
    this.held.add(event.code);
    if (!this.canInput()) return;
    if (!event.repeat && (event.code === 'Escape' || event.code === 'KeyP')) { this.pause(); return; }
    if (!event.repeat && event.code === 'KeyR' && this.restartKey !== false) {
      Audio.play('select');
      this.restart();
      return;
    }
    this.onKey?.(event);
  }

  _keyUp(event) { this.held.delete(event.code); }

  // ------------------------------------------------------------ menus
  /** Apre un menu bloccando il gioco; restituisce il valore scelto. */
  async menu(config) {
    this.modal = true;
    this.held.clear();
    try {
      return await openMenu(this, config);
    } finally {
      this.modal = this._leaving;
    }
  }

  /** Menu di pausa sopra il frame di gioco congelato. */
  async pause() {
    if (!this.canInput()) return;
    Audio.play('pause');
    const choice = await this.menu({
      title: 'PAUSED',
      subtitle: this.info.name.toUpperCase(),
      info: this.commandLines(),
      options: [
        { label: 'RESUME', value: 'resume' },
        { label: 'RESTART', value: 'restart' },
        { label: () => `SOUND: ${Audio.enabled ? 'ON' : 'OFF'}`, value: 'toggle_sound' },
        { label: () => `RETRO SCREEN: ${Settings.crt ? 'ON' : 'OFF'}`, value: 'toggle_crt' },
        { label: 'BACK TO MENU', value: 'menu' },
      ],
      hotkeys: { KeyR: 'restart', KeyM: 'menu', KeyP: 'resume' },
      cancelValue: 'resume',
      titleColor: NEON_CYAN,
    });
    if (choice === 'restart') this.restart();
    else if (choice === 'menu') this.toMenu();
  }

  /** Pausa automatica (scheda nascosta, telefono bloccato, uscita dallo schermo intero). */
  autoPause() { if (this.canInput()) this.pause(); }

  /**
   * Schermata di fine partita o di vittoria sopra l'ultimo frame.
   * Gestisce da sola "gioca ancora" / "torna al menu".
   */
  async endScreen(title, lines = [], { newRecord = false, win = false } = {}) {
    Audio.play(newRecord ? 'record' : (win ? 'win' : 'lose'));
    const choice = await this.menu({
      title,
      info: lines,
      titleColor: win ? NEON_GREEN : NEON_MAGENTA,
      subtitle: newRecord ? '★ NEW RECORD! ★' : null,
      options: [{ label: 'PLAY AGAIN', value: 'restart' }, { label: 'BACK TO MENU', value: 'menu' }],
      hotkeys: { KeyR: 'restart', KeyM: 'menu' },
      cancelValue: 'menu',
      inputDelay: 0.6,
    });
    if (choice === 'menu') this.toMenu();
    else this.restart();
    return choice;
  }

  /**
   * Scelta prima di giocare (modalità, difficoltà...). Ricorda l'ultima scelta.
   * @returns l'indice scelto, oppure null se il giocatore torna al menu.
   */
  async selectMenu(title, labels, info = [], defaultIndex = 0, color = NEON_CYAN) {
    const key = `mode_${this.scene.key}`;
    const remembered = Number(this.store.getSetting(key, defaultIndex));
    const choice = await this.menu({
      title, info, titleColor: color, backdrop: 'opaque',
      options: labels.map((label, i) => ({ label, value: i })),
      cancelValue: 'menu',
      defaultIndex: Number.isInteger(remembered) && remembered < labels.length ? remembered : defaultIndex,
    });
    if (choice === 'menu' || choice === undefined) { this.toMenu(); return null; }
    this.store.setSetting(key, choice);
    return choice;
  }

  // ------------------------------------------------------------ flow
  restart() {
    this.particles.clear();
    this.popups.clear();
    this.shake.reset();
    this.newGame();
  }

  /** Torna al launcher con una dissolvenza. */
  toMenu() {
    if (this._leaving) return;
    this._leaving = true;
    this.modal = true;
    try { this.saveOnExit(); } catch (err) { console.error(err); }
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(220, () => this.scene.start('LauncherScene'));
  }

  /** Un errore dentro un gioco non deve bloccare tutta la raccolta. */
  _crash(err) {
    console.error(`[${this.scene.key}]`, err);
    if (this._crashed) return;
    this._crashed = true;
    this.registry.set('lastCrash', { game: this.info?.name || this.scene.key, message: String(err?.message || err) });
    this._leaving = false;
    this.toMenu();
  }
}
