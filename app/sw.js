// Cache-first: la app abre y funciona sin internet una vez instalada.
// Cambia VERSION cada vez que actualices los archivos.
const VERSION = 'ocv-v2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' ignora la caché HTTP del navegador: siempre guarda la versión recién publicada
  const reqs = FILES.map(f => new Request(f, { cache: 'reload' }));
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(reqs)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // la subida a Google pasa directo
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
