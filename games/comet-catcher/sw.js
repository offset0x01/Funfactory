// Offline helper. After the first visit the game is saved on the device, so it opens from the
// Home Screen with no signal. Each launch shows the saved copy right away and quietly downloads
// any newer version for next time.
//
// Every game on the site shares one cache space, so this file only ever touches caches named
// after its own folder. Nothing here needs editing for a new game. Bump VERSION when the list
// of FILES changes.
const VERSION = 1;
const FOLDER = new URL('./', self.location).pathname.split('/').filter(Boolean).pop() || 'game';
const CACHE = `${FOLDER}-v${VERSION}`;
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // delete only this game's older caches, never another game's
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(FOLDER + '-v') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
