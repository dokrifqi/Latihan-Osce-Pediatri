// Service Worker — Latihan PPDS Pediatri (OSCE Anak)
// Strategy: NETWORK-FIRST for the app HTML (so a new deploy of osce-anak.html
// shows up immediately on next refresh, without the user clearing cache),
// CACHE-FIRST for static assets (icons/manifest) that rarely change.
const CACHE_VERSION = 'v2-' + '2026-10-20';
const CACHE_NAME = 'osce-anak-' + CACHE_VERSION;

const CORE_ASSETS = [
  './osce-anak.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

const HTML_FILE = './osce-anak.html';

// Install: pre-cache core assets, activate this SW immediately (no waiting
// for old tabs to close) so updates roll out fast.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: drop every cache from a previous version, take control of all
// open tabs right away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHtmlRequest(req, url) {
  return req.mode === 'navigate' ||
    url.pathname.endsWith('/osce-anak.html') ||
    url.pathname.endsWith('/') ;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // The app's main HTML: ALWAYS try the network first so a freshly
  // published osce-anak.html is picked up on the very next refresh.
  // Only fall back to the cached copy if the network is unreachable
  // (offline), and keep the cache updated with whatever we fetched.
  if (isSameOrigin && isHtmlRequest(req, url)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(HTML_FILE, resClone));
          return res;
        })
        .catch(() => caches.match(HTML_FILE))
    );
    return;
  }

  if (isSameOrigin) {
    // Static app assets (icons, manifest): cache-first, but refresh the
    // cache in the background so they self-heal if they ever change.
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    // External resources (e.g. Google Fonts): try network, fall back to
    // cache if offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});

// Let the page force this SW to activate immediately after a new version
// is installed, instead of waiting for all tabs to close.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
