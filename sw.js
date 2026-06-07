/* Səsim service worker — offline dəstəyi */
const VERSION = 'sesim-v1';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

/* Tətbiqin əsas qabığı — quraşdırma zamanı keşlənir */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* Offline işləməli xarici mənbələr (font, emoji, piktoqram) bu host-lardan gəlir */
const RUNTIME_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'static.arasaac.org',
  'api.arasaac.org'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Naviqasiya (index.html): şəbəkə-əvvəl, offline → keşdən qabıq */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  /* Eyni mənbə (öz fayllarımız): keş-əvvəl */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  /* Xarici mənbələr (font/emoji/piktoqram): stale-while-revalidate */
  if (RUNTIME_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.open(RUNTIME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            /* ok və ya opaque (no-cors) cavabları keşlə; 404 və s. keşləmə */
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
