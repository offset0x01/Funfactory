/**
 * Menu neon generico (tastiera, mouse e touch), come _run_menu in Python.
 *
 * Usato per: menu di pausa, schermata di fine partita, scelta di modalità
 * e difficoltà prima di giocare, messaggi.
 *
 *   const value = await openMenu(scene, {
 *     title: 'PAUSA', subtitle: 'TETRIS', info: ['riga 1', 'riga 2'],
 *     options: [{ label: 'RIPRENDI', value: 'resume' }, ...],
 *     hotkeys: { KeyR: 'restart' }, cancelValue: 'resume',
 *   });
 *
 * - Valori speciali 'toggle_sound' e 'toggle_crt': cambiano l'impostazione
 *   senza chiudere il menu (l'etichetta si aggiorna da sola).
 * - `inputDelay` (secondi): ignora le conferme per un attimo, così chi sta
 *   martellando SPAZIO per sparare non salta per sbaglio il game over.
 * - Restituisce una Promise con il valore scelto.
 */
import Phaser from '../lib/phaser.esm.min.js';
import Audio from './Audio.js';
import Settings from './Settings.js';
import VirtualPad from '../ui/VirtualPad.js';
import { PixelText, ptext } from './PixelText.js';
import { drawPanel } from './Draw.js';
import {
  W, H, BG, WHITE, TEXT_DIM, NEON_CYAN, NEON_YELLOW, css, lerpColor,
} from '../core/palette.js';

const CONFIRM = new Set(['Enter', 'NumpadEnter', 'Space']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);

const labelOf = (opt) => (typeof opt.label === 'function' ? opt.label() : String(opt.label));

export function openMenu(scene, {
  title,
  titleColor = NEON_CYAN,
  subtitle = null,
  subtitleColor = NEON_YELLOW,
  info = [],
  options = [],
  hotkeys = {},
  cancelValue = null,
  backdrop = 'dim',          // 'dim' = scurisce il gioco sotto, 'opaque' = sfondo pieno
  defaultIndex = 0,
  inputDelay = 0,
  depth = 1000,
} = {}) {
  return new Promise((resolve) => {
    const objs = [];
    const add = (o) => { o.setScrollFactor?.(0); o.setDepth?.(depth); objs.push(o); return o; };
    let selected = Math.max(0, Math.min(defaultIndex, options.length - 1));
    let closed = false;
    let elapsed = 0;

    // ------------------------------------------------------------ layout
    const shade = add(scene.add.graphics());
    if (backdrop === 'opaque') { shade.fillStyle(BG, 1); shade.fillRect(0, 0, W, H); }
    else { shade.fillStyle(0x04020e, 170 / 255); shade.fillRect(0, 0, W, H); }
    // Blocca i clic diretti al gioco sotto il menu
    add(scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive());

    const titleScale = [...title].length <= 16 ? 4 : 3;
    const titleTxt = new PixelText(scene, W / 2, 0, title,
      { scale: titleScale, color: titleColor, glow: true, anchor: 'midtop' });
    add(titleTxt);
    const infoTexts = info.map((line) => add(scene.add.text(W / 2, 0, line, {
      fontFamily: 'ui-monospace, Consolas, "DejaVu Sans Mono", monospace', fontSize: '16px', color: css(TEXT_DIM),
    }).setOrigin(0.5, 0)));

    const optH = 34;
    const infoH = info.length * 22 + (info.length ? 12 : 0);
    const subH = subtitle ? 30 : 0;
    const widths = [460, titleTxt.width + 60, ...infoTexts.map((t) => t.width + 60)];
    const panelW = Math.min(Math.max(...widths), W - 40);
    const panelH = 40 + titleTxt.height + subH + infoH + options.length * optH + 44;
    const px = Math.round((W - panelW) / 2);
    const py = Math.round((H - panelH) / 2);

    const panel = add(scene.add.graphics());
    drawPanel(panel, px, py, panelW, panelH, titleColor);
    titleTxt.setDepth(depth + 1);

    let y = py + 22;
    titleTxt.setY(y);
    y += titleTxt.height + 6;
    let subTxt = null;
    if (subtitle) {
      subTxt = add(new PixelText(scene, W / 2, y + 6, subtitle, { scale: 2, color: subtitleColor, anchor: 'midtop' }));
      subTxt.setDepth(depth + 1);
      y += subH;
    }
    infoTexts.forEach((t) => { t.setY(y).setDepth(depth + 1); y += 22; });
    if (info.length) y += 12;

    const highlight = add(scene.add.graphics()).setDepth(depth + 1);
    const rows = options.map((opt, i) => {
      const rw = panelW - 80;
      const rh = optH - 6;
      const rx = Math.round(W / 2 - rw / 2);
      const ry = y;
      y += optH;
      const label = add(ptext(scene, W / 2, ry + rh / 2, labelOf(opt), 2, TEXT_DIM, 'center')).setDepth(depth + 2);
      const zone = add(scene.add.zone(rx, ry, rw, rh).setOrigin(0, 0)).setDepth(depth + 3);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { if (selected !== i) { selected = i; Audio.play('move', 0.5); refresh(); } });
      zone.on('pointerdown', () => { zone._armed = true; });
      zone.on('pointerout', () => { zone._armed = false; });
      zone.on('pointerup', () => {
        if (!zone._armed) return;   // il clic che ha aperto il menu non conta
        zone._armed = false;
        if (elapsed < inputDelay) return;
        selected = i;
        choose(opt.value);
      });
      return { opt, label, rx, ry, rw, rh };
    });

    const hint = add(ptext(scene, W / 2, py + panelH - 22, '', 1, TEXT_DIM, 'center')).setDepth(depth + 1);
    const hintText = () => (VirtualPad.touchUI
      ? `TAP AN OPTION${cancelValue !== null ? '   PAUSE: BACK' : ''}`
      : `↑↓ CHOOSE   ENTER SELECT${cancelValue !== null ? '   ESC BACK' : ''}`);

    function refresh() {
      highlight.clear();
      rows.forEach(({ opt, label, rx, ry, rw, rh }, i) => {
        const text = labelOf(opt);
        if (i === selected) {
          highlight.fillStyle(titleColor, 40 / 255);
          highlight.fillRoundedRect(rx, ry, rw, rh, 6);
          highlight.lineStyle(2, titleColor, 1);
          highlight.strokeRoundedRect(rx, ry, rw, rh, 6);
          label.setText(`> ${text} <`).setColor(WHITE);
        } else {
          label.setText(text).setColor(TEXT_DIM);
        }
      });
      hint.setText(hintText());
    }
    refresh();
    const offPad = VirtualPad.onChange(refresh);

    // ------------------------------------------------------------- input
    const kb = scene.input.keyboard;
    function onKey(event) {
      if (closed || event.repeat) return;
      const code = event.code;
      if (UP.has(code)) { selected = (selected - 1 + options.length) % options.length; Audio.play('move'); refresh(); return; }
      if (DOWN.has(code)) { selected = (selected + 1) % options.length; Audio.play('move'); refresh(); return; }
      if (elapsed < inputDelay) return;
      if (CONFIRM.has(code)) { choose(options[selected].value); return; }
      if (code === 'Escape' && cancelValue !== null) { Audio.play('back'); close(cancelValue); return; }
      if (code in hotkeys) choose(hotkeys[code]);
    }
    kb.on('keydown', onKey);

    function onUpdate(_time, delta) {
      elapsed += delta / 1000;
      if (subTxt) {
        const pulse = 0.6 + 0.4 * Math.sin(elapsed * 6);
        subTxt.setColor(lerpColor(BG, subtitleColor, pulse));
      }
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

    function choose(value) {
      if (closed) return;
      if (value === 'toggle_sound') { Settings.toggleSound(); refresh(); return; }
      if (value === 'toggle_crt') { Settings.toggleCrt(); Audio.play('select'); refresh(); return; }
      Audio.play('select');
      close(value);
    }

    function cleanup() {
      kb.off('keydown', onKey);
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
      offPad();
      objs.forEach((o) => o.destroy());   // include il "blocker" dei clic
      VirtualPad.suspendGestures(false);
    }

    function close(value) {
      if (closed) return;
      closed = true;
      cleanup();
      resolve(value);
    }

    // La scena può chiudersi mentre il menu è aperto (es. pulsante Menu): pulizia
    function onShutdown() { if (!closed) { closed = true; cleanup(); } }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

    VirtualPad.releaseAll();
    VirtualPad.suspendGestures(true);
  });
}
