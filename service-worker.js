const CACHE_NAME = "daily-expenses-tracker-v6";
const CACHE_VERSION = "v=6";
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
  "./icons/icon.png",
  "./icons/penny-petal-192.png"
].map((file) => `${file}?${CACHE_VERSION}`);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) =>
            (cacheName.startsWith("penny-petal-") || cacheName.startsWith("daily-expenses-tracker-")) &&
            cacheName !== CACHE_NAME
          )
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request, { ignoreSearch: true }))
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          }
          return response;
        });
      })
      .catch(() => {
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
