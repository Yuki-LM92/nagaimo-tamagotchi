// ながいもくん Service Worker
const CACHE = 'nagaimo-v3';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './gemini.js',
  './memory.js',
  './character.js',
  './particles.js',
  './manifest.json',
  './assets/nagaimo.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Gemini API はキャッシュしない
  if (e.request.url.includes('generativelanguage.googleapis.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
