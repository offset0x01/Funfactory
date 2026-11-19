/*
 * Service worker — gioco giocabile anche offline e installabile come app.
 * Strategia "network first": se c'è rete si scarica sempre la versione più
 * recente (niente file vecchi dopo un aggiornamento); senza rete si usa la cache.
 * Viene registrato da src/main.js solo su HTTPS (es. GitHub Pages), mai su localhost.
 */
const CACHE = 'funfactory-classic-arcade-v1';   // cambia a ogni versione: i vecchi file vengono eliminati

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon-32.png',
  './src/main.js',
  './src/lib/phaser.esm.min.js',
  './src/core/palette.js',
  './src/core/pixelFont.js',
  './src/core/scores.js',
  './src/core/sfx.js',
  './src/core/util.js',
  './src/logic/arcade.js',
  './src/logic/gameAI.js',
  './src/logic/maze.js',
  './src/logic/memory.js',
  './src/logic/puzzle15.js',
  './src/logic/snake.js',
  './src/logic/tetris.js',
  './src/scenes/BreakoutScene.js',
  './src/scenes/LauncherScene.js',
  './src/scenes/MazeRunnerScene.js',
  './src/scenes/MemoryGameScene.js',
  './src/scenes/OverlayScene.js',
  './src/scenes/PongScene.js',
  './src/scenes/Puzzle15Scene.js',
  './src/scenes/SnakeScene.js',
  './src/scenes/SpaceInvadersScene.js',
  './src/scenes/TetrisScene.js',
  './src/scenes/TicTacToeScene.js',
  './src/shared/ArcadeScene.js',
  './src/shared/Audio.js',
  './src/shared/Draw.js',
  './src/shared/Fx.js',
  './src/shared/Menu.js',
  './src/shared/PixelText.js',
  './src/shared/SceneKit.js',
  './src/shared/Settings.js',
  './src/shared/catalog.js',
  './src/ui/VirtualPad.js',
  './src/ui/virtual-pad.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((cached) => cached || caches.match('./index.html'))
      )
  );
});
