/* Productivity Hub service worker. Generated at build time by vite.config.ts. */
/* global self, caches, URL, Response */
const VERSION = "__VERSION__";
const CACHE = `productivity-hub-${VERSION}`;
const PRECACHE = __PRECACHE__;
const scope = self.registration.scope;
const INDEX_URL = new URL("index.html", scope).href;
// The OCR engine (~5 MB) is cached on first use in a cache that survives app
// updates; its folder name carries the engine version.
const OCR_DIR = "__OCR_DIR__";
const OCR_PREFIX = new URL(`${OCR_DIR}/`, scope).href;
const OCR_CACHE = `productivity-hub-ocr:${OCR_DIR}`;

self.addEventListener("install", (event) => {
  // Do not skipWaiting automatically: the page asks the user before activating
  // a new version so an open tab never mixes old and new files.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, scope).href))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => (key.startsWith("productivity-hub-") && key !== CACHE && !key.startsWith("productivity-hub-ocr:")) || (key.startsWith("productivity-hub-ocr:") && key !== OCR_CACHE))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return;

  if (request.mode === "navigate") {
    // Network first so users get updates; fall back to the cached app shell offline.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(INDEX_URL, { ignoreVary: true }).then((response) => response || new Response("Offline", { status: 503 })),
      ),
    );
    return;
  }

  if (url.href.startsWith(OCR_PREFIX)) {
    event.respondWith(
      caches.open(OCR_CACHE).then((cache) =>
        cache.match(request, { ignoreVary: true }).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Hashed build assets never change: cache first. ignoreVary because module
  // preloads carry an Origin header that the precache requests did not.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
