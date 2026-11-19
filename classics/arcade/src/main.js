import Phaser from './lib/phaser.esm.min.js';
import VirtualPad from './ui/VirtualPad.js';
import Audio from './shared/Audio.js';
import Settings from './shared/Settings.js';

import LauncherScene   from './scenes/LauncherScene.js';
import SnakeScene      from './scenes/SnakeScene.js';
import TetrisScene     from './scenes/TetrisScene.js';
import PongScene       from './scenes/PongScene.js';
import BreakoutScene   from './scenes/BreakoutScene.js';
import SpaceInvScene   from './scenes/SpaceInvadersScene.js';
import MazeScene       from './scenes/MazeRunnerScene.js';
import MemoryScene     from './scenes/MemoryGameScene.js';
import Puzzle15Scene   from './scenes/Puzzle15Scene.js';
import TicTacToeScene  from './scenes/TicTacToeScene.js';
import OverlayScene    from './scenes/OverlayScene.js';

// Impostazioni salvate (audio, filtro CRT) + sblocco dell'audio al primo gesto
Settings.load();
Audio.init();

// Phaser globale: comodo per fare debug dalla console del browser
window.Phaser = Phaser;

const config = {
  // AUTO = WebGL quando disponibile, Canvas 2D sui dispositivi/browser senza WebGL
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#0a0818',
  // pixel nitidi (niente sfocature sui testi in pixel-art), come pygame
  pixelArt: true,
  input: {
    activePointers: 3,       // multi-touch (es. due giocatori sullo stesso tablet a Pong)
  },
  scene: [
    LauncherScene,
    SnakeScene,
    TetrisScene,
    PongScene,
    BreakoutScene,
    SpaceInvScene,
    MazeScene,
    MemoryScene,
    Puzzle15Scene,
    TicTacToeScene,
    OverlayScene,            // ultima = disegnata sopra a tutte (filtro CRT, notifiche)
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// Gamepad virtuale per i dispositivi touch
VirtualPad.init(game);

// Piccolo aggancio per il debug e per lo smoke test (tests/smoke/smoke.mjs)
window.__retro = {
  game,
  activeScene: () => game.scene.getScenes(true).map((s) => s.scene.key).find((k) => k !== 'OverlayScene'),
};

game.events.once('ready', () => {
  document.getElementById('boot')?.remove();
  Audio.preload();   // sintetizza gli effetti adesso, così il primo suono non "scatta"
});

// Pausa automatica quando la scheda viene nascosta / il telefono si blocca / arriva una chiamata
game.events.on('hidden', () => {
  game.scene.getScenes(true).forEach((scene) => scene.autoPause?.());
});

// Gioco offline + app installabile (solo su HTTPS, mai su localhost per non avere cache vecchie in sviluppo)
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isLocal) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker non registrato:', err));
  });
}
