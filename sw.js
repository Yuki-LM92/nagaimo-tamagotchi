// ながいもくん Service Worker
const CACHE = 'nagaimo-v19';
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
  // Gemini API・外部リソースはSWを通さない
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    // ネットワーク優先：常に最新ファイルを取得し、キャッシュを更新
    // オフライン時のみキャッシュにフォールバック
    fetch(e.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
