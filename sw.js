// Service worker: guarda o app no aparelho para abrir sem internet.
const VERSION = 'habitos-v2';
const FILES = [
  './',
  "css/app.css",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/app.js",
  "js/habits/body.js",
  "js/habits/index.js",
  "js/habits/meals.js",
  "js/habits/reading.js",
  "js/habits/water.js",
  "js/habits/workout.js",
  "js/pdfimport.js",
  "js/store.js",
  "js/util.js",
  "js/views/evolution.js",
  "js/views/history.js",
  "js/views/lock.js",
  "js/views/settings.js",
  "js/views/today.js",
  "manifest.webmanifest",
  "vendor/pdf.min.mjs",
  "vendor/pdf.worker.min.mjs",
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Responde do cache na hora e atualiza em segundo plano (a nova versão vale na próxima abertura).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await c.match('./')) || Response.error();
  }));
});
