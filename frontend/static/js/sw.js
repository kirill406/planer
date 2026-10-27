// Service worker: offline app shell (network-first) + notification clicks.
const CACHE = "planer-shell-v1";
const SHELL = [
  "/app",
  "/static/css/base.css",
  "/static/css/app.css",
  "/static/js/app.js",
  "/static/js/engine.js",
  "/static/js/clock.js",
  "/static/js/coach.js",
  "/static/js/format.js",
  "/static/js/notify.js",
  "/static/js/store.js",
  "/static/js/strings.js",
  "/static/js/templates.js",
  "/static/js/track.js",
  "/static/img/icon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/admin")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const app = clients.find((client) => new URL(client.url).pathname === "/app");
      if (app) return app.focus();
      return self.clients.openWindow("/app#/run");
    }),
  );
});
