/**
 * OverlayScene — sempre attiva, disegnata sopra a qualsiasi altra scena.
 *
 *   * filtro CRT (scanline + vignettatura), pre-renderizzato una volta sola;
 *   * notifiche a comparsa in basso a destra ("AUDIO OFF", "SCREENSHOT SALVATO"...);
 *   * tasti globali: F11 / Alt+Invio schermo intero, F9 screenshot PNG.
 *     (Nel browser F12 apre gli Strumenti per sviluppatori, quindi lo
 *     screenshot usa F9 invece del F12 della versione Python.)
 */
import Phaser from '../lib/phaser.esm.min.js';
import Settings from '../shared/Settings.js';
import Audio from '../shared/Audio.js';
import VirtualPad from '../ui/VirtualPad.js';
import { PixelText } from '../shared/PixelText.js';
import { W, H, NEON_YELLOW, BG_DARK } from '../core/palette.js';

const CRT_KEY = '__crt_overlay';

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Scanline ogni 3 pixel + vignettatura agli angoli (come build_crt_overlay). */
function buildCrtCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.135)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  const steps = 60;
  ctx.lineWidth = 1;
  for (let i = 0; i < steps; i++) {
    const alpha = (70 * (1 - i / steps) ** 3) / 255;
    if (alpha <= 0.002) continue;
    ctx.strokeStyle = `rgba(0,0,0,${alpha.toFixed(4)})`;
    roundedRectPath(ctx, i + 0.5, i + 0.5, w - 2 * i - 1, h - 2 * i - 1, 24);
    ctx.stroke();
  }
  return c;
}

function timestamp() {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default class OverlayScene extends Phaser.Scene {
  constructor() { super({ key: 'OverlayScene', active: true }); }

  create() {
    if (!this.textures.exists(CRT_KEY)) this.textures.addCanvas(CRT_KEY, buildCrtCanvas());
    this.crt = this.add.image(0, 0, CRT_KEY).setOrigin(0, 0).setDepth(0);
    this.crt.setVisible(Settings.crt);

    this.toastBox = this.add.graphics().setDepth(1);
    this.toastText = new PixelText(this, 0, 0, '', { scale: 2, color: NEON_YELLOW, anchor: 'center' }).setDepth(2);
    this.toastUntil = 0;
    this.toastTotal = 0;

    this.off = Settings.on((type, payload) => {
      if (type === 'change') this.crt.setVisible(Settings.crt);
      if (type === 'notify') this.showToast(payload.text, payload.seconds);
    });
    this.events.once('shutdown', () => this.off());

    this.onKey = (e) => {
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
        e.preventDefault();
        VirtualPad.toggleFullscreen();
      } else if (e.code === 'F9') {
        e.preventDefault();
        this.screenshot();
      }
    };
    window.addEventListener('keydown', this.onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', this.onKey));
  }

  showToast(text, seconds = 1.6) {
    this.toastText.setText(text);
    this.toastUntil = this.time.now + seconds * 1000;
    this.toastTotal = seconds * 1000;
    this.drawToast();
  }

  drawToast() {
    const g = this.toastBox;
    g.clear();
    const remaining = this.toastUntil - this.time.now;
    if (remaining <= 0 || !this.toastText.text) { this.toastText.setVisible(false); return; }
    const alpha = Math.min(1, remaining / 300);
    const tw = this.toastText.width;
    const th = this.toastText.height;
    const bw = tw + 18;
    const bh = th + 14;
    const bx = W - 14 - bw;
    const by = H - 14 - bh;
    g.fillStyle(BG_DARK, (220 / 255) * alpha);
    g.fillRoundedRect(bx, by, bw, bh, 6);
    g.lineStyle(2, NEON_YELLOW, alpha);
    g.strokeRoundedRect(bx + 1, by + 1, bw - 2, bh - 2, 6);
    this.toastText.setPosition(Math.round(bx + bw / 2), Math.round(by + bh / 2)).setAlpha(alpha).setVisible(true);
  }

  /** Salva il frame attuale come PNG (scaricato dal browser). */
  screenshot() {
    try {
      this.game.renderer.snapshot((image) => {
        const a = document.createElement('a');
        a.href = image.src;
        a.download = `retro_arcade_${timestamp()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        Audio.play('blip');
        Settings.notify('SCREENSHOT SAVED');
      });
    } catch {
      Settings.notify('SCREENSHOT FAILED');
    }
  }

  update() {
    // Sempre in cima: le altre scene vengono avviate e fermate di continuo
    if (this.scene.getIndex() !== this.scene.manager.scenes.length - 1) this.scene.bringToTop();
    if (this.toastUntil) this.drawToast();
  }
}
