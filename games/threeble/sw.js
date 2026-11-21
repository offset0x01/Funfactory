// Offline helper. After the first visit the game is saved on the device, so it opens from the
// Home Screen with no signal.
//   - The game page itself comes from the internet first (waiting up to 3 s), so an update shows up
//     on the next visit; with no signal (or a very slow one) the saved copy opens instead.
//   - Everything else (icons, manifest) opens from the saved copy right away and quietly
//     refreshes for next time.
//
// Every game on the site shares one cache space, so this file only ever touches caches named
// after its own folder. Nothing here needs editing for a new game. Bump VERSION when the list
// of FILES changes.
const VERSION = 2;
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
  const page = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(e.request.url).pathname);
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request, page ? { cache: 'no-cache' } : {})
      .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    fresh.catch(() => {}); // offline is fine: the saved copy is used below
    if (!page) return cached || fresh.catch(() => cached);
    // the game page: the newest copy if it arrives within 3 s, otherwise the saved one
    const late = new Promise(done => setTimeout(done, 3000)).then(() => cached);
    try { return (await Promise.race([fresh, late])) || await fresh; } catch { return cached || Response.error(); }
  }));
});
